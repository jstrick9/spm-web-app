import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { can } from '../lib/rbac.js';
import { inviteTrackingRepo } from '../db/repos/inviteTracking.js';
import { eventsRepo, guestsRepo } from '../db/repos/index.js';
import { BadRequest, Forbidden, NotFound } from '../lib/errors.js';

export async function inviteTrackingRoutes(app: FastifyInstance) {
  // ─── List tracking for event ──────────────────────────
  app.get('/api/events/:eventId/invite-tracking', { preHandler: requireAuth }, async (req) => {
    const { eventId } = req.params as { eventId: string };
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'invites.view', orgMap)) throw Forbidden();
    return {
      tracking: inviteTrackingRepo.listForEvent(eventId),
      statusMap: inviteTrackingRepo.statusMap(eventId),
      counts: inviteTrackingRepo.counts(eventId),
    };
  });

  // ─── Bulk send (mark all as sent) ────────────────────
  app.post('/api/events/:eventId/invite-tracking/send', { preHandler: requireAuth }, async (req) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound();
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'invites.send', orgMap)) throw Forbidden();

    const guests = guestsRepo.listForEvent(eventId);
    const guestIds = guests.map(g => g.id);
    const count = inviteTrackingRepo.bulkSend(event.organization_id, eventId, guestIds);
    return { sent: count };
  });

  // ─── Update single guest invite status ────────────────
  app.patch('/api/events/:eventId/invite-tracking/:guestId', { preHandler: requireAuth }, async (req) => {
    const { eventId, guestId } = req.params as { eventId: string; guestId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound();
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'invites.manage', orgMap)) throw Forbidden();

    const parsed = z.object({
      status: z.enum(['not_sent', 'sent', 'opened', 'bounced']),
    }).safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);

    const tracking = inviteTrackingRepo.upsert({
      organizationId: event.organization_id, eventId, guestId,
      status: parsed.data.status,
    });
    return { tracking };
  });
}
