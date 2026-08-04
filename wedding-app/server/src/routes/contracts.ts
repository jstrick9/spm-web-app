import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../db/database.js';
import { requireAuth } from '../middleware/auth.js';
import { can } from '../lib/rbac.js';
import { contractsRepo } from '../db/repos/contracts.js';
import { eventsRepo, auditRepo, financialLegalOpsRepo, paymentLinksRepo, integrationsRepo, jobsRepo, orgsRepo } from '../db/repos/index.js';
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
const obligationDecisionSchema = z.object({
  status: z.enum(['approved', 'dismissed']),
});

function audit(req: any, orgId: string, action: string, targetType: string, targetId: string, details?: Record<string, unknown>) {
  auditRepo.log({
    organizationId: orgId, actorUserId: req.auth!.userId, actorLabel: req.auth!.email,
    action, targetType, targetId, ip: req.ip, details,
  });
}

/** MODULE-06 FI-12: best-effort email delivery when the org has SMTP + a recipient. */
function deliverContractEmail(contract: Awaited<ReturnType<typeof contractsRepo.findById>>) {
  if (!contract?.recipient_email) return false;
  const smtp = integrationsRepo.findByOrgProvider(contract.organization_id, 'email_smtp');
  if (smtp?.status !== 'connected') return false;
  const org = orgsRepo.findById(contract.organization_id);
  jobsRepo.enqueue({
    kind: 'email.send',
    organizationId: contract.organization_id,
    payload: {
      integrationId: smtp.id,
      to: contract.recipient_email,
      subject: `Contract: ${contract.title}`,
      text: [
        `Dear ${contract.recipient_name},`,
        '',
        `Please review your ${contract.title} (${contract.amount_cents != null ? `$${(contract.amount_cents / 100).toFixed(2)}` : 'amount TBD'}).`,
        '',
        '—',
        contract.content || '',
      ].join('\n'),
      headers: { 'X-WVI-Email-Type': 'contract-send' },
    },
    maxAttempts: 3,
  });
  return true;
}

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
    // MODULE-06 FI-05: GET is pure — obligation extraction happens on contract
    // create/update and via the explicit POST /contracts/:id/extract-obligations.
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
    // MODULE-06 FI-11: raising escalations is an explicit ops action granted
    // via financial_legal.escalate (manager/planner/owner/admin) — view-only
    // roles (staff, couple) must not be able to raise blocked go/no-go flags.
    if (!can(req.auth!.memberships, { eventId }, 'financial_legal.escalate', orgMap)) throw Forbidden();
    const parsed = escalationSchema.safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    const escalation = financialLegalOpsRepo.createEscalation({ orgId: event.organization_id, eventId, ...parsed.data, createdBy: req.auth!.userId });
    audit(req, event.organization_id, 'financial_legal.escalation.create', 'event', eventId, { escalationId: escalation.id, severity: escalation.severity, label: escalation.label });
    const flag = parsed.data.createGoNoGoFlag ? financialLegalOpsRepo.createGoNoGoFlag({ orgId: event.organization_id, eventId, sourceType: parsed.data.sourceType, sourceId: parsed.data.sourceId, label: parsed.data.label, detail: parsed.data.detail, severity: parsed.data.severity === 'warning' ? 'warning' : 'blocked', createdBy: req.auth!.userId }) : undefined;
    if (flag) audit(req, event.organization_id, 'financial_legal.go_no_go.create', 'event', eventId, { flagId: flag.id, severity: flag.severity, label: flag.label });
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
    audit(req, event.organization_id, 'financial_legal.go_no_go.create', 'event', eventId, { flagId: flag.id, severity: flag.severity, label: flag.label });
    return reply.code(201).send({ flag });
  });

  // ─── Go/No-Go flag lifecycle (MODULE-06 FI-03) ────────
  app.post('/api/events/:eventId/financial-legal/go-no-go-flags/:flagId/approve', { preHandler: requireAuth }, async (req, reply) => {
    const { eventId, flagId } = req.params as { eventId: string; flagId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound();
    const flag = db.prepare(`SELECT * FROM event_go_no_go_flags WHERE id = ? AND event_id = ?`).get(flagId, eventId) as any;
    if (!flag) throw NotFound('go-no-go-flag-not-found');
    // Owner/admin only may clear a blocked flag (roleKey check — owner/admin
    // are system roles; custom roles must escalate to the owner). This is the
    // SOLE gate: approving is an owner act, not a contracts.manage act.
    const isOwnerAdmin = req.auth!.memberships.some((m: any) =>
      (m.organizationId === event.organization_id || m.eventId === eventId) &&
      ['owner', 'admin'].includes(String(m.roleKey ?? '').toLowerCase()));
    if (!isOwnerAdmin) throw Forbidden('owner-approval-required');
    const updated = financialLegalOpsRepo.approveGoNoGoFlag(flagId, req.auth!.userId);
    audit(req, event.organization_id, 'financial_legal.go_no_go.approve', 'event', eventId, { flagId, label: flag.label });
    broadcastSSE(event.organization_id, 'financial_legal.updated', { eventId, flagId }, req.auth!.userId);
    return reply.code(200).send({ flag: updated });
  });

  app.post('/api/events/:eventId/financial-legal/go-no-go-flags/:flagId/resolve', { preHandler: requireAuth }, async (req, reply) => {
    const { eventId, flagId } = req.params as { eventId: string; flagId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound();
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    // Symmetry with creation: anyone who can raise flags (financial_legal.escalate)
    // can resolve them once the underlying issue clears.
    if (!can(req.auth!.memberships, { eventId }, 'financial_legal.escalate', orgMap)) throw Forbidden();
    const flag = db.prepare(`SELECT * FROM event_go_no_go_flags WHERE id = ? AND event_id = ?`).get(flagId, eventId) as any;
    if (!flag) throw NotFound('go-no-go-flag-not-found');
    db.prepare(`UPDATE event_go_no_go_flags SET status = 'resolved', updated_at = datetime('now') WHERE id = ?`).run(flagId);
    audit(req, event.organization_id, 'financial_legal.go_no_go.resolve', 'event', eventId, { flagId, label: flag.label });
    broadcastSSE(event.organization_id, 'financial_legal.updated', { eventId, flagId }, req.auth!.userId);
    return reply.code(200).send({ flag: db.prepare(`SELECT * FROM event_go_no_go_flags WHERE id = ?`).get(flagId) });
  });

  // ─── Contract obligation decision (MODULE-06 FI-04) ───
  app.post('/api/contracts/:id/obligations/:obligationId', { preHandler: requireAuth }, async (req, reply) => {
    const { id, obligationId } = req.params as { id: string; obligationId: string };
    const contract = contractsRepo.findById(id);
    if (!contract) throw NotFound();
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId: contract.event_id }, 'contracts.manage', orgMap)) throw Forbidden();
    const extract = db.prepare(`SELECT * FROM contract_obligation_extracts WHERE id = ? AND contract_id = ?`).get(obligationId, id) as any;
    if (!extract) throw NotFound('obligation-not-found');
    const parsed = obligationDecisionSchema.safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    db.prepare(`UPDATE contract_obligation_extracts SET status = ?, approved_by = ?, approved_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`)
      .run(parsed.data.status, parsed.data.status === 'approved' ? req.auth!.userId : null, obligationId);
    audit(req, contract.organization_id, 'financial_legal.obligation.decide', 'contract', id, { obligationId, obligationKey: extract.obligation_key, status: parsed.data.status });
    return reply.code(200).send({ obligation: db.prepare(`SELECT * FROM contract_obligation_extracts WHERE id = ?`).get(obligationId) });
  });

  app.post('/api/contracts/:id/extract-obligations', { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const contract = contractsRepo.findById(id);
    if (!contract) throw NotFound();
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId: contract.event_id }, 'contracts.view', orgMap)) throw Forbidden();
    const extracts = financialLegalOpsRepo.upsertContractObligations(contract);
    audit(req, contract.organization_id, 'financial_legal.obligation.extract', 'contract', id, { count: extracts.length });
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
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId: contract.event_id }, 'contracts.manage', orgMap)) throw Forbidden();
    const parsed = createSchema.partial().safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    const updated = contractsRepo.update(id, parsed.data);
    if (updated) financialLegalOpsRepo.upsertContractObligations(updated);
    audit(req, contract.organization_id, 'contract.update', 'contract', id, { fields: Object.keys(parsed.data) });
    broadcastSSE(contract.organization_id, 'contract.updated', { eventId: contract.event_id, contractId: id }, req.auth!.userId);
    return { contract: updated };
  });

  // ─── Send (mark as sent + best-effort email) ─────────
  app.post('/api/contracts/:id/send', { preHandler: requireAuth }, async (req) => {
    const { id } = req.params as { id: string };
    const contract = contractsRepo.findById(id);
    if (!contract) throw NotFound();
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId: contract.event_id }, 'contracts.manage', orgMap)) throw Forbidden();
    const updated = contractsRepo.update(id, { status: 'sent', sentAt: new Date().toISOString() });
    const emailed = deliverContractEmail(contract);
    audit(req, contract.organization_id, 'contract.send', 'contract', id, { emailed });
    broadcastSSE(contract.organization_id, 'contract.updated', { eventId: contract.event_id, contractId: id, status: 'sent' }, req.auth!.userId);
    return { contract: updated, emailed };
  });

  // ─── Sign (e-signature) ───────────────────────────────
  app.post('/api/contracts/:id/sign', { preHandler: requireAuth }, async (req) => {
    const { id } = req.params as { id: string };
    const contract = contractsRepo.findById(id);
    if (!contract) throw NotFound();
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId: contract.event_id }, 'contracts.sign', orgMap)) throw Forbidden();
    const parsed = signSchema.safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    // MODULE-06 FI-09: an e-signature is evidentiary — never overwrite one.
    if (contract.status === 'signed') throw BadRequest('contract-already-signed');
    const updated = contractsRepo.update(id, {
      status: 'signed', signature: parsed.data.signature,
      signedAt: new Date().toISOString(), signerIp: req.ip,
    });
    audit(req, contract.organization_id, 'contract.sign', 'contract', id, { signer: parsed.data.signature });
    broadcastSSE(contract.organization_id, 'contract.signed', { eventId: contract.event_id, contractId: id }, req.auth!.userId);
    return { contract: updated };
  });

  app.delete('/api/contracts/:id', { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const contract = contractsRepo.findById(id);
    if (!contract) throw NotFound();
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId: contract.event_id }, 'contracts.manage', orgMap)) throw Forbidden();
    contractsRepo.delete(id);
    audit(req, contract.organization_id, 'contract.delete', 'contract', id, { title: contract.title });
    broadcastSSE(contract.organization_id, 'contract.deleted', { eventId: contract.event_id, contractId: id }, req.auth!.userId);
    return reply.code(204).send();
  });
}
