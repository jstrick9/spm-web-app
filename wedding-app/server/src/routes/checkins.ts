import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { can } from '../lib/rbac.js';
import { checkinsRepo } from '../db/repos/checkins.js';
import { eventsRepo } from '../db/repos/index.js';
import { db } from '../db/database.js';
import { BadRequest, Forbidden, NotFound } from '../lib/errors.js';
import { broadcastSSE } from './sse.js';

const statusSchema = z.object({
  vendorId: z.string().min(1),
  status: z.enum(['expected', 'arrived', 'setup', 'completed', 'departed', 'late']),
  notes: z.string().max(500).optional(),
});

export async function checkinRoutes(app: FastifyInstance) {
  // ─── List check-in status for event ───────────────────
  app.get('/api/events/:eventId/checkins', { preHandler: requireAuth }, async (req) => {
    const { eventId } = req.params as { eventId: string };
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'vendors.checkin.view', orgMap)) throw Forbidden();
    return {
      checkins: checkinsRepo.listForEvent(eventId),
      statusMap: checkinsRepo.statusMap(eventId),
      counts: checkinsRepo.counts(eventId),
    };
  });

  // ─── Update vendor check-in status ────────────────────
  app.post('/api/events/:eventId/checkins', { preHandler: requireAuth }, async (req, reply) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound();
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'vendors.checkin.manage', orgMap)) throw Forbidden();
    const parsed = statusSchema.safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);

    // The vendor must actually be assigned to this event — otherwise a staff
    // member could check a different event's vendor into this board and
    // poison the UNIQUE(event_id, vendor_id) row (VE-01).
    const vendor = db.prepare(`SELECT id FROM vendors WHERE id = ? AND event_id = ? AND deleted_at IS NULL`).get(parsed.data.vendorId, eventId);
    if (!vendor) throw BadRequest('vendor-not-in-event');

    const checkin = checkinsRepo.upsert({
      organizationId: event.organization_id,
      eventId,
      vendorId: parsed.data.vendorId,
      status: parsed.data.status,
      checkedInBy: req.auth!.userId,
      notes: parsed.data.notes,
    });

    broadcastSSE(event.organization_id, 'vendor.checkin', {
      eventId, vendorId: parsed.data.vendorId, status: parsed.data.status,
    }, req.auth!.userId);

    return reply.code(200).send({ checkin });
  });
}
