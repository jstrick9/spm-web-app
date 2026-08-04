import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../db/database.js';
import { requireAuth } from '../middleware/auth.js';
import { can } from '../lib/rbac.js';
import { budgetRepo } from '../db/repos/budget.js';
import { eventsRepo, auditRepo } from '../db/repos/index.js';
import { BadRequest, Forbidden, NotFound } from '../lib/errors.js';
import { broadcastSSE } from './sse.js';

const itemSchema = z.object({
  category:    z.string().min(1).max(100),
  title:       z.string().min(1).max(200),
  plannedCents: z.number().int().min(0),
  actualCents: z.number().int().min(0).nullable().optional(),
  paidCents:   z.number().int().min(0).optional(),
  vendorId:    z.string().nullable().optional(),
  notes:       z.string().max(2000).optional(),
  sortOrder:   z.number().int().optional(),
});

export async function budgetRoutes(app: FastifyInstance) {
  // ─── List budget items for event ─────────────────────
  app.get('/api/events/:eventId/budget', { preHandler: requireAuth }, async (req) => {
    const { eventId } = req.params as { eventId: string };
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'budget.view', orgMap)) throw Forbidden();
    return {
      items: budgetRepo.listForEvent(eventId),
      totals: budgetRepo.totalsForEvent(eventId),
    };
  });

  // ─── Create budget item ──────────────────────────────
  app.post('/api/events/:eventId/budget', { preHandler: requireAuth }, async (req, reply) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound();
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'budget.manage', orgMap)) throw Forbidden();
    const parsed = itemSchema.safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    if (parsed.data.vendorId) {
      const vendor = db.prepare(`SELECT id FROM vendors WHERE id = ? AND organization_id = ?`).get(parsed.data.vendorId, event.organization_id);
      if (!vendor) throw BadRequest('vendor-not-in-org', { vendorId: parsed.data.vendorId });
    }
    const item = budgetRepo.create(event.organization_id, eventId, parsed.data, req.auth!.userId);
    auditRepo.log({
      organizationId: event.organization_id, actorUserId: req.auth!.userId,
      actorLabel: req.auth!.email, action: 'budget.create',
      targetType: 'budget_item', targetId: item.id, ip: req.ip,
    });
    broadcastSSE(event.organization_id, 'budget.updated', { eventId, itemId: item.id }, req.auth!.userId);
    return reply.code(201).send({ item });
  });

  // ─── Update budget item ──────────────────────────────
  app.patch('/api/budget/:id', { preHandler: requireAuth }, async (req) => {
    const { id } = req.params as { id: string };
    const item = budgetRepo.findById(id);
    if (!item) throw NotFound();
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId: item.event_id }, 'budget.manage', orgMap)) throw Forbidden();
    const parsed = itemSchema.partial().safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    if (parsed.data.vendorId) {
      const vendor = db.prepare(`SELECT id FROM vendors WHERE id = ? AND organization_id = ?`).get(parsed.data.vendorId, item.organization_id);
      if (!vendor) throw BadRequest('vendor-not-in-org', { vendorId: parsed.data.vendorId });
    }
    const updated = budgetRepo.update(id, parsed.data);
    auditRepo.log({
      organizationId: item.organization_id, actorUserId: req.auth!.userId,
      actorLabel: req.auth!.email, action: 'budget.update',
      targetType: 'budget_item', targetId: id, ip: req.ip, details: { fields: Object.keys(parsed.data) },
    });
    broadcastSSE(item.organization_id, 'budget.updated', { eventId: item.event_id, itemId: id }, req.auth!.userId);
    return { item: updated };
  });

  // ─── Delete budget item ──────────────────────────────
  app.delete('/api/budget/:id', { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const item = budgetRepo.findById(id);
    if (!item) throw NotFound();
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId: item.event_id }, 'budget.manage', orgMap)) throw Forbidden();
    budgetRepo.delete(id);
    auditRepo.log({
      organizationId: item.organization_id, actorUserId: req.auth!.userId,
      actorLabel: req.auth!.email, action: 'budget.delete',
      targetType: 'budget_item', targetId: id, ip: req.ip, details: { title: item.title },
    });
    broadcastSSE(item.organization_id, 'budget.updated', { eventId: item.event_id }, req.auth!.userId);
    return reply.code(204).send();
  });
}
