/**
 * Guest list & RSVP routes.
 *
 * Includes a PUBLIC endpoint (POST /api/portal/:eventId/rsvp) that does
 * NOT require auth — guests submit RSVPs without an account. That route
 * is rate-limited by IP (TODO: wire @fastify/rate-limit in production).
 */
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { can } from '../lib/rbac.js';
import { auditRepo, eventsRepo, guestsRepo, rsvpRepo } from '../db/repos.js';

const addGuestSchema = z.object({
  eventId: z.string().min(1),
  fullName: z.string().min(1).max(200),
  email: z.string().email().max(254).optional(),
  plusOneAllowed: z.boolean().optional(),
});

const submitRsvpSchema = z.object({
  guestId: z.string().optional(),
  fullName: z.string().min(1).max(200).optional(),
  attending: z.boolean(),
  mealChoice: z.string().max(60).optional(),
  plusOneName: z.string().max(200).optional(),
  notes: z.string().max(2000).optional(),
});

export async function guestRoutes(app: FastifyInstance) {
  // ─── GET /api/events/:eventId/guests ────────────────────────
  app.get(
    '/api/events/:eventId/guests',
    { preHandler: requireAuth },
    async (req, reply) => {
      const { eventId } = req.params as { eventId: string };
      const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);

      if (!can(req.auth!.memberships, { eventId }, 'guests.view', orgMap)) {
        return reply.code(403).send({ error: 'forbidden' });
      }
      return { guests: guestsRepo.listForEvent(eventId) };
    }
  );

  // ─── POST /api/guests ───────────────────────────────────────
  app.post('/api/guests', { preHandler: requireAuth }, async (req, reply) => {
    const parsed = addGuestSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid-input', issues: parsed.error.issues });
    }

    const event = eventsRepo.findById(parsed.data.eventId);
    if (!event) return reply.code(404).send({ error: 'event-not-found' });

    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId: event.id }, 'guests.manage', orgMap)) {
      return reply.code(403).send({ error: 'forbidden' });
    }

    const guest = guestsRepo.create({
      organizationId: event.organization_id,
      eventId: event.id,
      fullName: parsed.data.fullName,
      email: parsed.data.email,
      plusOneAllowed: parsed.data.plusOneAllowed,
    });

    auditRepo.log({
      organizationId: event.organization_id,
      actorUserId: req.auth!.userId,
      actorLabel: req.auth!.email,
      action: 'guest.create',
      targetType: 'guest',
      targetId: guest.id,
      ip: req.ip,
    });

    return reply.code(201).send({ guest });
  });

  // ─── GET /api/events/:eventId/rsvps (authed list) ───────────
  app.get(
    '/api/events/:eventId/rsvps',
    { preHandler: requireAuth },
    async (req, reply) => {
      const { eventId } = req.params as { eventId: string };
      const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
      if (!can(req.auth!.memberships, { eventId }, 'rsvp.view', orgMap)) {
        return reply.code(403).send({ error: 'forbidden' });
      }
      return { rsvps: rsvpRepo.listForEvent(eventId) };
    }
  );

  // ─── POST /api/portal/:eventId/rsvp (PUBLIC) ────────────────
  // The Guest Portal calls this without auth. We rate-limit it in app.ts.
  app.post('/api/portal/:eventId/rsvp', async (req, reply) => {
    const { eventId } = req.params as { eventId: string };
    const parsed = submitRsvpSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid-input', issues: parsed.error.issues });
    }

    const event = eventsRepo.findById(eventId);
    if (!event) return reply.code(404).send({ error: 'event-not-found' });

    // Optional: if guestId supplied, validate it belongs to this event.
    if (parsed.data.guestId) {
      const g = guestsRepo.findById(parsed.data.guestId);
      if (!g || g.event_id !== eventId) {
        return reply.code(400).send({ error: 'guest-not-in-event' });
      }
      if (!g.allow_portal_access) {
        return reply.code(403).send({ error: 'portal-access-revoked' });
      }
    }

    const rsvpId = rsvpRepo.submit({
      organizationId: event.organization_id,
      eventId: event.id,
      guestId: parsed.data.guestId,
      attending: parsed.data.attending,
      mealChoice: parsed.data.mealChoice,
      plusOneName: parsed.data.plusOneName,
      notes: parsed.data.notes,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });

    auditRepo.log({
      organizationId: event.organization_id,
      actorUserId: undefined,
      actorLabel: parsed.data.fullName ?? '(public)',
      action: 'rsvp.submit',
      targetType: 'rsvp',
      targetId: rsvpId,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });

    return reply.code(201).send({ ok: true, rsvpId });
  });

  // ─── GET /api/portal/:eventId/info (PUBLIC) ─────────────────
  // Minimal event info for the guest portal landing page.
  // ALSO returns a sparse {id, full_name} list of guests so the portal
  // can render a "pick your name" dropdown without exposing PII like
  // emails, dietary notes, or table assignments. (In production this
  // would be replaced by per-guest tokenized URLs.)
  app.get('/api/portal/:eventId/info', async (req, reply) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) return reply.code(404).send({ error: 'event-not-found' });

    const guestList = guestsRepo
      .listForEvent(event.id)
      .filter((g) => g.allow_portal_access)
      .map((g) => ({ id: g.id, fullName: g.full_name }));

    return {
      event: {
        id: event.id,
        title: event.title,
        startDate: event.start_date,
        endDate: event.end_date,
      },
      guests: guestList,
    };
  });
}
