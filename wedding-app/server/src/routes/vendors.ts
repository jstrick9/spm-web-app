import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { can } from '../lib/rbac.js';
import { vendorsRepo, auditRepo } from '../db/repos/index.js';
import { BadRequest, Forbidden, NotFound } from '../lib/errors.js';

const vendorSchema = z.object({
  name:                 z.string().min(1).max(200),
  category:             z.string().max(40).optional(),
  contactName:          z.string().max(200).optional(),
  email:                z.string().email().max(254).optional().or(z.literal('')),
  phone:                z.string().max(40).optional(),
  websiteUrl:           z.string().url().max(2000).optional().or(z.literal('')),
  contractAmountCents:  z.number().int().min(0).optional(),
  isPreferred:          z.boolean().optional(),
  notes:                z.string().max(4000).optional(),
  metadata:             z.record(z.unknown()).optional(),
  eventId:              z.string().nullable().optional(),
});

const paymentSchema = z.object({
  amountCents: z.number().int().positive(),
  paidAt:      z.string().min(1),
  method:      z.string().max(40).optional(),
  notes:       z.string().max(2000).optional(),
});

export async function vendorRoutes(app: FastifyInstance) {
  // ─── Public Portal Endpoints ───────────────────────
  app.get('/api/portal/vendors/:id/info', async (req, reply) => {
    const { id } = req.params as { id: string };
    const v = vendorsRepo.findById(id);
    if (!v) throw NotFound();
    
    // We need the event and timeline
    let event = null;
    let timeline: any[] = [];
    let layouts: any[] = [];
    
    if (v.event_id) {
       const { eventsRepo, timelineRepo, layoutsRepo } = await import('../db/repos/index.js');
       event = eventsRepo.findById(v.event_id);
       if (event) {
         timeline = timelineRepo.listForEvent(v.event_id);
         layouts = layoutsRepo.listForOrg(event.organization_id, { eventId: v.event_id });
       }
    }
    
    return {
      vendor: v,
      event,
      timeline,
      layouts,
    };
  });

  app.get('/api/orgs/:orgId/vendors', { preHandler: requireAuth }, async (req) => {
    const { orgId } = req.params as { orgId: string };
    const { eventId } = req.query as { eventId?: string };
    if (!can(req.auth!.memberships, { organizationId: orgId }, 'vendors.view')) throw Forbidden();
    return { vendors: vendorsRepo.listForOrg(orgId, { eventId }) };
  });

  app.post('/api/orgs/:orgId/vendors', { preHandler: requireAuth }, async (req, reply) => {
    const { orgId } = req.params as { orgId: string };
    if (!can(req.auth!.memberships, { organizationId: orgId }, 'vendors.manage')) throw Forbidden();
    const parsed = vendorSchema.safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    const vendor = vendorsRepo.create(orgId, parsed.data);
    auditRepo.log({
      organizationId: orgId, actorUserId: req.auth!.userId, actorLabel: req.auth!.email,
      action: 'vendor.create', targetType: 'vendor', targetId: vendor.id, ip: req.ip,
    });
    return reply.code(201).send({ vendor });
  });

  app.patch('/api/vendors/:id', { preHandler: requireAuth }, async (req) => {
    const { id } = req.params as { id: string };
    const v = vendorsRepo.findById(id);
    if (!v) throw NotFound();
    if (!can(req.auth!.memberships, { organizationId: v.organization_id }, 'vendors.manage')) throw Forbidden();
    const parsed = vendorSchema.partial().safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    return { vendor: vendorsRepo.update(id, parsed.data) };
  });

  app.delete('/api/vendors/:id', { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const v = vendorsRepo.findById(id);
    if (!v) throw NotFound();
    if (!can(req.auth!.memberships, { organizationId: v.organization_id }, 'vendors.manage')) throw Forbidden();
    vendorsRepo.softDelete(id);
    return reply.code(204).send();
  });

  // Payments
  app.get('/api/vendors/:id/payments', { preHandler: requireAuth }, async (req) => {
    const { id } = req.params as { id: string };
    const v = vendorsRepo.findById(id);
    if (!v) throw NotFound();
    if (!can(req.auth!.memberships, { organizationId: v.organization_id }, 'vendors.view')) throw Forbidden();
    return { payments: vendorsRepo.listPayments(id) };
  });

  app.post('/api/vendors/:id/payments', { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const v = vendorsRepo.findById(id);
    if (!v) throw NotFound();
    if (!can(req.auth!.memberships, { organizationId: v.organization_id }, 'vendors.manage')) throw Forbidden();
    const parsed = paymentSchema.safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    return reply.code(201).send({ payment: vendorsRepo.addPayment(id, parsed.data) });
  });

  app.post('/api/portal/vendors/:id/questionnaire', async (req, reply) => {
    const { id } = req.params as { id: string };
    const { vendorsRepo } = await import('../db/repos/index.js');
    const v = vendorsRepo.findById(id);
    if (!v) throw NotFound();

    const parsed = z.record(z.unknown()).safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);

    let meta: Record<string, unknown> = {};
    try {
      meta = JSON.parse(v.metadata);
    } catch { }

    meta.questionnaire = {
      ...(meta.questionnaire as Record<string, unknown> || {}),
      ...parsed.data,
      submittedAt: new Date().toISOString()
    };

    const updated = vendorsRepo.update(id, { metadata: meta });
    return { ok: true, vendor: updated };
  });

  app.get('/api/portal/vendors/:id/messages', async (req) => {
    const { id } = req.params as { id: string };
    const v = vendorsRepo.findById(id);
    if (!v) throw NotFound();
    if (!v.event_id) return { messages: [] };

    const { messagesRepo } = await import('../db/repos/index.js');
    const threadId = `${v.event_id}:vendor-${v.id}`;
    return {
      messages: messagesRepo.listForThread(threadId)
    };
  });

  app.post('/api/portal/vendors/:id/messages', async (req, reply) => {
    const { id } = req.params as { id: string };
    const v = vendorsRepo.findById(id);
    if (!v) throw NotFound();
    if (!v.event_id) throw BadRequest('Vendor is not linked to any event.');

    const parsed = z.object({
      body: z.string().min(1).max(10000),
    }).safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);

    const { messagesRepo } = await import('../db/repos/index.js');
    const threadId = `${v.event_id}:vendor-${v.id}`;
    const message = messagesRepo.send({
      threadId,
      senderId: v.id,
      senderRole: 'vendor',
      body: parsed.data.body
    });

    return reply.code(201).send({ message });
  });
}
