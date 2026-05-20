/**
 * Event management routes.
 *
 * Every route checks an explicit permission via lib/rbac.ts — never
 * inspects role strings directly. This is the pattern that the original
 * front-end review flagged as missing.
 */
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { auditRepo, eventsRepo, orgsRepo } from '../db/repos.js';
import { requireAuth } from '../middleware/auth.js';
import { can } from '../lib/rbac.js';

const createEventSchema = z.object({
  organizationId: z.string().min(1),
  title: z.string().min(1).max(200),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

export async function eventRoutes(app: FastifyInstance) {
  // ─── GET /api/orgs ──────────────────────────────────────────
  app.get('/api/orgs', { preHandler: requireAuth }, async (req) => {
    return { organizations: orgsRepo.listForUser(req.auth!.userId) };
  });

  // ─── GET /api/orgs/:orgId/events ────────────────────────────
  app.get(
    '/api/orgs/:orgId/events',
    { preHandler: requireAuth },
    async (req, reply) => {
      const { orgId } = req.params as { orgId: string };

      if (!can(req.auth!.memberships, { organizationId: orgId }, 'events.view')) {
        return reply.code(403).send({ error: 'forbidden' });
      }

      return { events: eventsRepo.listForOrg(orgId) };
    }
  );

  // ─── POST /api/events ───────────────────────────────────────
  app.post('/api/events', { preHandler: requireAuth }, async (req, reply) => {
    const parsed = createEventSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid-input', issues: parsed.error.issues });
    }
    const { organizationId, title, startDate, endDate } = parsed.data;

    if (!can(req.auth!.memberships, { organizationId }, 'events.create')) {
      return reply.code(403).send({ error: 'forbidden' });
    }

    const event = eventsRepo.create({
      organizationId,
      title,
      slug: `${slugify(title)}-${Date.now().toString(36)}`,
      startDate,
      endDate,
      createdBy: req.auth!.userId,
    });

    auditRepo.log({
      organizationId,
      actorUserId: req.auth!.userId,
      actorLabel: req.auth!.email,
      action: 'event.create',
      targetType: 'event',
      targetId: event.id,
      details: { title },
      ip: req.ip,
    });

    return reply.code(201).send({ event });
  });

  // ─── GET /api/events/:eventId ───────────────────────────────
  app.get(
    '/api/events/:eventId',
    { preHandler: requireAuth },
    async (req, reply) => {
      const { eventId } = req.params as { eventId: string };
      const event = eventsRepo.findById(eventId);
      if (!event) return reply.code(404).send({ error: 'not-found' });

      const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
      if (!can(req.auth!.memberships, { eventId }, 'events.view', orgMap)) {
        return reply.code(403).send({ error: 'forbidden' });
      }
      return { event };
    }
  );
}
