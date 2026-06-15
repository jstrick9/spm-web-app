import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { can } from '../lib/rbac.js';
import { contractsRepo } from '../db/repos/contracts.js';
import { eventsRepo, auditRepo, financialLegalOpsRepo, paymentLinksRepo } from '../db/repos/index.js';
import { BadRequest, Forbidden, NotFound } from '../lib/errors.js';
import { broadcastSSE } from './sse.js';

const createSchema = z.object({
  title: z.string().min(1).max(200),
  recipientName: z.string().min(1).max(200),
  recipientEmail: z.string().email().optional(),
  amountCents: z.number().int().min(0).optional(),
  content: z.string().max(50000).optional(),
});

const signSchema = z.object({
  signature: z.string().min(1).max(200),
});

const escalationSchema = z.object({
  sourceType: z.enum(['contract', 'payment', 'legal', 'manual']).optional(),
  sourceId: z.string().optional(),
  severity: z.enum(['info', 'warning', 'blocked']).optional(),
  label: z.string().min(1).max(1000),
  detail: z.string().max(4000).optional(),
  createGoNoGoFlag: z.boolean().optional(),
});
const goNoGoSchema = z.object({
  sourceType: z.enum(['contract', 'payment', 'legal', 'manual']).optional(),
  sourceId: z.string().optional(),
  severity: z.enum(['warning', 'blocked']).optional(),
  label: z.string().min(1).max(1000),
  detail: z.string().max(4000).optional(),
});

export async function contractRoutes(app: FastifyInstance) {
  app.get('/api/events/:eventId/contracts', { preHandler: requireAuth }, async (req) => {
    const { eventId } = req.params as { eventId: string };
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'contracts.view', orgMap)) throw Forbidden();
    return { contracts: contractsRepo.listForEvent(eventId) };
  });

  app.get('/api/events/:eventId/financial-legal', { preHandler: requireAuth }, async (req) => {
    const { eventId } = req.params as { eventId: string };
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'contracts.view', orgMap) &&
        !can(req.auth!.memberships, { eventId }, 'budget.view', orgMap)) throw Forbidden();
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound();
    for (const contract of contractsRepo.listForEvent(eventId)) {
      financialLegalOpsRepo.upsertContractObligations(contract);
    }
    const payments = paymentLinksRepo.listForEvent(eventId);
    return {
      financialLegal: {
        ...financialLegalOpsRepo.listForEvent(eventId),
        paymentDueRisk: financialLegalOpsRepo.paymentDueRisk(payments),
      },
    };
  });

  app.post('/api/events/:eventId/financial-legal/escalations', { preHandler: requireAuth }, async (req, reply) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound();
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'contracts.manage', orgMap) &&
        !can(req.auth!.memberships, { eventId }, 'budget.view', orgMap)) throw Forbidden();
    const parsed = escalationSchema.safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    const escalation = financialLegalOpsRepo.createEscalation({ orgId: event.organization_id, eventId, ...parsed.data, createdBy: req.auth!.userId });
    const flag = parsed.data.createGoNoGoFlag ? financialLegalOpsRepo.createGoNoGoFlag({ orgId: event.organization_id, eventId, sourceType: parsed.data.sourceType, sourceId: parsed.data.sourceId, label: parsed.data.label, detail: parsed.data.detail, severity: parsed.data.severity === 'warning' ? 'warning' : 'blocked', createdBy: req.auth!.userId }) : undefined;
    return reply.code(201).send({ escalation, flag });
  });

  app.post('/api/events/:eventId/financial-legal/go-no-go-flags', { preHandler: requireAuth }, async (req, reply) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound();
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'contracts.manage', orgMap)) throw Forbidden();
    const parsed = goNoGoSchema.safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    const flag = financialLegalOpsRepo.createGoNoGoFlag({ orgId: event.organization_id, eventId, ...parsed.data, createdBy: req.auth!.userId });
    return reply.code(201).send({ flag });
  });

  app.post('/api/contracts/:id/extract-obligations', { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const contract = contractsRepo.findById(id);
    if (!contract) throw NotFound();
    if (!can(req.auth!.memberships, { organizationId: contract.organization_id }, 'contracts.view')) throw Forbidden();
    const extracts = financialLegalOpsRepo.upsertContractObligations(contract);
    return reply.code(201).send({ extracts });
  });

  app.post('/api/events/:eventId/contracts', { preHandler: requireAuth }, async (req, reply) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound();
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'contracts.manage', orgMap)) throw Forbidden();
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    const contract = contractsRepo.create({
      organizationId: event.organization_id, eventId,
      ...parsed.data, createdBy: req.auth!.userId,
    });
    financialLegalOpsRepo.upsertContractObligations(contract);
    auditRepo.log({
      organizationId: event.organization_id, actorUserId: req.auth!.userId,
      actorLabel: req.auth!.email, action: 'contract.create',
      targetType: 'contract', targetId: contract.id, ip: req.ip,
    });
    broadcastSSE(event.organization_id, 'contract.created', { eventId, contractId: contract.id }, req.auth!.userId);
    return reply.code(201).send({ contract });
  });

  app.patch('/api/contracts/:id', { preHandler: requireAuth }, async (req) => {
    const { id } = req.params as { id: string };
    const contract = contractsRepo.findById(id);
    if (!contract) throw NotFound();
    if (!can(req.auth!.memberships, { organizationId: contract.organization_id }, 'contracts.manage')) throw Forbidden();
    const parsed = createSchema.partial().safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    const updated = contractsRepo.update(id, parsed.data);
    if (updated) financialLegalOpsRepo.upsertContractObligations(updated);
    return { contract: updated };
  });

  // ─── Send (mark as sent) ──────────────────────────────
  app.post('/api/contracts/:id/send', { preHandler: requireAuth }, async (req) => {
    const { id } = req.params as { id: string };
    const contract = contractsRepo.findById(id);
    if (!contract) throw NotFound();
    if (!can(req.auth!.memberships, { organizationId: contract.organization_id }, 'contracts.manage')) throw Forbidden();
    return { contract: contractsRepo.update(id, { status: 'sent', sentAt: new Date().toISOString() }) };
  });

  // ─── Sign (e-signature) ───────────────────────────────
  app.post('/api/contracts/:id/sign', { preHandler: requireAuth }, async (req) => {
    const { id } = req.params as { id: string };
    const contract = contractsRepo.findById(id);
    if (!contract) throw NotFound();
    if (!can(req.auth!.memberships, { organizationId: contract.organization_id }, 'contracts.sign')) throw Forbidden();
    const parsed = signSchema.safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    const updated = contractsRepo.update(id, {
      status: 'signed', signature: parsed.data.signature,
      signedAt: new Date().toISOString(), signerIp: req.ip,
    });
    broadcastSSE(contract.organization_id, 'contract.signed', { eventId: contract.event_id, contractId: id }, req.auth!.userId);
    return { contract: updated };
  });

  app.delete('/api/contracts/:id', { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const contract = contractsRepo.findById(id);
    if (!contract) throw NotFound();
    if (!can(req.auth!.memberships, { organizationId: contract.organization_id }, 'contracts.manage')) throw Forbidden();
    contractsRepo.delete(id);
    return reply.code(204).send();
  });
}
