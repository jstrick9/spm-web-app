import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { can } from '../lib/rbac.js';
import {
  auditRepo, eventsRepo, orgsRepo, subEventsRepo,
} from '../db/repos/index.js';
import { Forbidden, NotFound, BadRequest } from '../lib/errors.js';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const createEventSchema = z.object({
  organizationId: z.string().min(1),
  title:          z.string().min(1).max(200),
  status:         z.enum(['lead','hold','booked','planning','completed','cancelled','lost']).optional(),
  startDate:      isoDate.optional(),
  endDate:        isoDate.optional(),
  guestCount:     z.number().int().min(0).optional(),
  budgetCents:    z.number().int().min(0).optional(),
  primaryContactUserId: z.string().optional(),
});

const updateEventSchema = createEventSchema.partial().omit({ organizationId: true });

const subEventSchema = z.object({
  title:       z.string().min(1).max(200),
  startsAt:    z.string().min(1),
  endsAt:      z.string().optional(),
  venueId:     z.string().optional(),
  inviteOnly:  z.boolean().optional(),
});

export async function eventRoutes(app: FastifyInstance) {
  // ─── Organizations ──────────────────────────────────────
  app.get('/api/orgs', { preHandler: requireAuth }, async (req) => ({
    organizations: orgsRepo.listForUser(req.auth!.userId),
  }));

  app.get('/api/orgs/:orgId', { preHandler: requireAuth }, async (req, reply) => {
    const { orgId } = req.params as { orgId: string };
    if (!can(req.auth!.memberships, { organizationId: orgId }, 'org.view')) {
      throw Forbidden();
    }
    const org = orgsRepo.findById(orgId);
    if (!org) throw NotFound();
    return { organization: org };
  });

  app.put('/api/orgs/:orgId/branding', { preHandler: requireAuth }, async (req, reply) => {
    const { orgId } = req.params as { orgId: string };
    if (!can(req.auth!.memberships, { organizationId: orgId }, 'org.branding.manage')) {
      throw Forbidden();
    }
    orgsRepo.updateBranding(orgId, (req.body as Record<string, unknown>) ?? {});
    auditRepo.log({
      organizationId: orgId, actorUserId: req.auth!.userId, actorLabel: req.auth!.email,
      action: 'org.branding.update', ip: req.ip,
    });
    return { branding: orgsRepo.getBranding(orgId) };
  });

  // ─── Events ─────────────────────────────────────────────
  app.get('/api/orgs/:orgId/events', { preHandler: requireAuth }, async (req) => {
    const { orgId } = req.params as { orgId: string };
    if (!can(req.auth!.memberships, { organizationId: orgId }, 'events.view')) {
      throw Forbidden();
    }
    return { events: eventsRepo.listForOrg(orgId) };
  });

  app.post('/api/events', { preHandler: requireAuth }, async (req, reply) => {
    const parsed = createEventSchema.safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    if (!can(req.auth!.memberships, { organizationId: parsed.data.organizationId }, 'events.create')) {
      throw Forbidden();
    }
    const event = eventsRepo.create({
      organizationId: parsed.data.organizationId,
      title: parsed.data.title,
      status: parsed.data.status,
      startDate: parsed.data.startDate,
      endDate: parsed.data.endDate,
      guestCount: parsed.data.guestCount,
      budgetCents: parsed.data.budgetCents,
      primaryContactUserId: parsed.data.primaryContactUserId,
      createdBy: req.auth!.userId,
    });
    auditRepo.log({
      organizationId: parsed.data.organizationId, actorUserId: req.auth!.userId,
      actorLabel: req.auth!.email, action: 'event.create',
      targetType: 'event', targetId: event.id, ip: req.ip,
    });
    return reply.code(201).send({ event });
  });

  app.get('/api/events/:eventId', { preHandler: requireAuth }, async (req) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound();
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'events.view', orgMap)) throw Forbidden();
    return { event };
  });

  app.patch('/api/events/:eventId', { preHandler: requireAuth }, async (req) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound();
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'events.edit', orgMap)) throw Forbidden();
    const parsed = updateEventSchema.safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    // Only forward fields the client actually sent. Without this filter
    // we'd write NULL for every omitted field.
    const dataIn = parsed.data as Record<string, unknown>;
    const patch: Record<string, unknown> = {};
    const keyMap: Record<string, string> = {
      title: 'title', status: 'status',
      startDate: 'start_date', endDate: 'end_date',
      guestCount: 'guest_count', budgetCents: 'budget_cents',
      primaryContactUserId: 'primary_contact_user_id',
    };
    for (const [k, col] of Object.entries(keyMap)) {
      if (k in dataIn && dataIn[k] !== undefined) patch[col] = dataIn[k];
    }
    const updated = eventsRepo.update(eventId, patch as never);
    auditRepo.log({
      organizationId: event.organization_id, actorUserId: req.auth!.userId,
      actorLabel: req.auth!.email, action: 'event.update',
      targetType: 'event', targetId: eventId, ip: req.ip,
    });
    return { event: updated };
  });

  app.delete('/api/events/:eventId', { preHandler: requireAuth }, async (req, reply) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound();
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'events.delete', orgMap)) throw Forbidden();
    eventsRepo.softDelete(eventId);
    auditRepo.log({
      organizationId: event.organization_id, actorUserId: req.auth!.userId,
      actorLabel: req.auth!.email, action: 'event.delete',
      targetType: 'event', targetId: eventId, ip: req.ip,
    });
    return reply.code(204).send();
  });

  // ─── Sub-events ────────────────────────────────────────
  app.get('/api/events/:eventId/sub-events', { preHandler: requireAuth }, async (req) => {
    const { eventId } = req.params as { eventId: string };
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'events.view', orgMap)) throw Forbidden();
    return { subEvents: subEventsRepo.listForEvent(eventId) };
  });

  app.post('/api/events/:eventId/sub-events', { preHandler: requireAuth }, async (req, reply) => {
    const { eventId } = req.params as { eventId: string };
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'events.edit', orgMap)) throw Forbidden();
    const parsed = subEventSchema.safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    const subEvent = subEventsRepo.create({ eventId, ...parsed.data });
    return reply.code(201).send({ subEvent });
  });

  app.delete('/api/sub-events/:subId', { preHandler: requireAuth }, async (req, reply) => {
    const { subId } = req.params as { subId: string };
    subEventsRepo.delete(subId);
    return reply.code(204).send();
  });
}
