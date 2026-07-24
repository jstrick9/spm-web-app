import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { can } from '../lib/rbac.js';
import { webhooksRepo } from '../db/repos/webhooks.js';
import { BadRequest, Forbidden, NotFound } from '../lib/errors.js';
import { auditRepo } from '../db/repos/index.js';
import { isSafeOutboundUrl } from '../lib/outboundUrl.js';

const createSchema = z.object({
  url: z.string().url().refine(isSafeOutboundUrl, 'Webhook URL must use HTTP(S) and cannot target a local or private address'),
  secret: z.string().max(256).optional(),
  eventTypes: z.array(z.string().min(1)).optional(),
  description: z.string().max(500).optional(),
});

const updateSchema = createSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export async function webhookRoutes(app: FastifyInstance) {
  // ─── List webhooks for org ────────────────────────────
  app.get('/api/orgs/:orgId/webhooks', { preHandler: requireAuth }, async (req) => {
    const { orgId } = req.params as { orgId: string };
    if (!can(req.auth!.memberships, { organizationId: orgId }, 'integrations.view')) throw Forbidden();
    return { webhooks: webhooksRepo.listForOrg(orgId) };
  });

  // ─── Create webhook ──────────────────────────────────
  app.post('/api/orgs/:orgId/webhooks', { preHandler: requireAuth }, async (req, reply) => {
    const { orgId } = req.params as { orgId: string };
    if (!can(req.auth!.memberships, { organizationId: orgId }, 'integrations.manage')) throw Forbidden();
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    const webhook = webhooksRepo.create({
      organizationId: orgId,
      url: parsed.data.url,
      secret: parsed.data.secret,
      eventTypes: parsed.data.eventTypes,
      description: parsed.data.description,
      createdBy: req.auth!.userId,
    });
    auditRepo.log({
      organizationId: orgId, actorUserId: req.auth!.userId,
      actorLabel: req.auth!.email, action: 'webhook.create',
      targetType: 'webhook', targetId: webhook.id, ip: req.ip,
    });
    return reply.code(201).send({ webhook });
  });

  // ─── Update webhook ──────────────────────────────────
  app.patch('/api/webhooks/:id', { preHandler: requireAuth }, async (req) => {
    const { id } = req.params as { id: string };
    const webhook = webhooksRepo.findById(id);
    if (!webhook) throw NotFound();
    if (!can(req.auth!.memberships, { organizationId: webhook.organization_id }, 'integrations.manage')) throw Forbidden();
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    return { webhook: webhooksRepo.update(id, parsed.data) };
  });

  // ─── Delete webhook ──────────────────────────────────
  app.delete('/api/webhooks/:id', { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const webhook = webhooksRepo.findById(id);
    if (!webhook) throw NotFound();
    if (!can(req.auth!.memberships, { organizationId: webhook.organization_id }, 'integrations.manage')) throw Forbidden();
    webhooksRepo.delete(id);
    auditRepo.log({
      organizationId: webhook.organization_id, actorUserId: req.auth!.userId,
      actorLabel: req.auth!.email, action: 'webhook.delete',
      targetType: 'webhook', targetId: id, ip: req.ip,
    });
    return reply.code(204).send();
  });

  // ─── List deliveries for a webhook ────────────────────
  app.get('/api/webhooks/:id/deliveries', { preHandler: requireAuth }, async (req) => {
    const { id } = req.params as { id: string };
    const webhook = webhooksRepo.findById(id);
    if (!webhook) throw NotFound();
    if (!can(req.auth!.memberships, { organizationId: webhook.organization_id }, 'integrations.view')) throw Forbidden();
    return { deliveries: webhooksRepo.listDeliveries(id) };
  });

  // ─── Replay a terminal delivery through the durable retry worker ─────────
  app.post('/api/webhooks/:id/deliveries/:deliveryId/replay', { preHandler: requireAuth }, async (req, reply) => {
    const { id, deliveryId } = req.params as { id: string; deliveryId: string };
    const webhook = webhooksRepo.findById(id);
    if (!webhook) throw NotFound();
    if (!can(req.auth!.memberships, { organizationId: webhook.organization_id }, 'integrations.manage')) throw Forbidden();
    if (!webhooksRepo.replayTerminalDelivery(id, deliveryId)) throw NotFound('terminal-delivery-not-found');
    auditRepo.log({ organizationId: webhook.organization_id, actorUserId: req.auth!.userId, actorLabel: req.auth!.email, action: 'webhook.delivery.replay', targetType: 'webhook_delivery', targetId: deliveryId, ip: req.ip });
    return reply.code(202).send({ ok: true, queued: true });
  });

  // ─── Test webhook (fires a test payload) ──────────────
  app.post('/api/webhooks/:id/test', { preHandler: requireAuth }, async (req) => {
    const { id } = req.params as { id: string };
    const webhook = webhooksRepo.findById(id);
    if (!webhook) throw NotFound();
    if (!can(req.auth!.memberships, { organizationId: webhook.organization_id }, 'integrations.manage')) throw Forbidden();

    // Import dispatcher dynamically to avoid circular deps
    const { broadcastWebhook } = await import('../webhooks/dispatcher.js');
    broadcastWebhook(webhook.organization_id, 'webhook.test', {
      webhookId: id,
      message: 'This is a test delivery from Wedding Venue Intelligence.',
      timestamp: new Date().toISOString(),
    });
    return { ok: true, message: 'Test webhook dispatched. Check deliveries for results.' };
  });
}
