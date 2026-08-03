import { coupleRequestsRepo, eventsRepo, portalConfigRepo } from '../../db/repos/index.js';
import { db } from '../../db/database.js';
import { uuid } from '../../lib/crypto.js';
import { requireAuth } from '../../middleware/auth.js';
import { can } from '../../lib/rbac.js';
import { z } from 'zod';
import { BadRequest, Forbidden, NotFound } from '../../lib/errors.js';
import type { FastifyInstance } from 'fastify';
import { notificationPrefsSchema, parseEventMetadata, safeRequest } from './shared.js';

export async function couplePortalRoutes(app: FastifyInstance) {
  app.get('/api/events/:eventId/couple-notification-preferences', { preHandler: requireAuth }, async (req) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound('event-not-found');
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'events.view', orgMap)) throw Forbidden();
    const existing = db.prepare(`SELECT * FROM couple_notification_preferences WHERE event_id = ? AND user_id = ?`).get(eventId, req.auth!.userId) as any;
    if (existing) return { preferences: existing };
    const id = uuid();
    db.prepare(`INSERT INTO couple_notification_preferences (id, organization_id, event_id, user_id) VALUES (?, ?, ?, ?)`).run(id, event.organization_id, eventId, req.auth!.userId);
    return { preferences: db.prepare(`SELECT * FROM couple_notification_preferences WHERE id = ?`).get(id) };
  });

  app.patch('/api/events/:eventId/couple-notification-preferences', { preHandler: requireAuth }, async (req) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound('event-not-found');
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'events.view', orgMap)) throw Forbidden();
    const parsed = notificationPrefsSchema.safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    const id = (db.prepare(`SELECT id FROM couple_notification_preferences WHERE event_id = ? AND user_id = ?`).get(eventId, req.auth!.userId) as any)?.id || uuid();
    db.prepare(`INSERT OR IGNORE INTO couple_notification_preferences (id, organization_id, event_id, user_id) VALUES (?, ?, ?, ?)`).run(id, event.organization_id, eventId, req.auth!.userId);
    const p = parsed.data;
    db.prepare(`UPDATE couple_notification_preferences SET email_enabled = COALESCE(?, email_enabled), sms_enabled = COALESCE(?, sms_enabled), in_app_enabled = COALESCE(?, in_app_enabled), digest_frequency = COALESCE(?, digest_frequency), quiet_hours = COALESCE(?, quiet_hours), decision_alerts = COALESCE(?, decision_alerts), due_task_alerts = COALESCE(?, due_task_alerts), message_alerts = COALESCE(?, message_alerts), updated_at = datetime('now') WHERE id = ?`)
      .run(p.emailEnabled === undefined ? null : Number(p.emailEnabled), p.smsEnabled === undefined ? null : Number(p.smsEnabled), p.inAppEnabled === undefined ? null : Number(p.inAppEnabled), p.digestFrequency ?? null, p.quietHours ? JSON.stringify(p.quietHours) : null, p.decisionAlerts === undefined ? null : Number(p.decisionAlerts), p.dueTaskAlerts === undefined ? null : Number(p.dueTaskAlerts), p.messageAlerts === undefined ? null : Number(p.messageAlerts), id);
    return { preferences: db.prepare(`SELECT * FROM couple_notification_preferences WHERE id = ?`).get(id) };
  });

  app.get('/api/events/:eventId/couple-guest-portal', { preHandler: requireAuth }, async (req) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound('event-not-found');
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'events.view', orgMap)) throw Forbidden();
    const cfg = portalConfigRepo.getForEvent(eventId) as any;
    const config = cfg ? (typeof cfg.config === 'string' ? JSON.parse(cfg.config || '{}') : (cfg.config || {})) : {};
    const requests = coupleRequestsRepo.listForRequester(eventId, req.auth!.userId).map(safeRequest);
    const approval = requests.find((r) => r.requestType === 'guest_portal_update' && ['pending','approved'].includes(r.status));
    const reminder = requests.find((r) => r.requestType === 'rsvp_reminder_request' && ['pending','approved'].includes(r.status));
    const baseUrl = (process.env.PUBLIC_APP_URL || process.env.BASE_URL || 'http://localhost:5173').replace(/\/+$/, '');
    return {
      portal: {
        enabled: !!cfg?.enabled,
        publicUrl: `${baseUrl}/#/portal/${eventId}`,
        couplePlanningPortalUrl: `${baseUrl}/#/couple/events/${eventId}`,
        rsvpDeadline: config.rsvpDeadline || parseEventMetadata(event).rsvpDeadline || event.rsvp_deadline || null,
        editWindowDays: config.rsvpEditWindowDays ?? null,
        access: cfg ? { startsAt: cfg.access_starts_at ?? null, endsAt: cfg.access_ends_at ?? null, gracePeriodHours: cfg.grace_period_hours ?? null } : null,
        config,
      },
      approvalStatus: approval?.status ?? 'not_requested',
      reminderStatus: reminder?.status ?? 'not_requested',
      guestsWillSee: ['Welcome message', 'Schedule and sub-events shared by the venue', 'RSVP questions', 'Meal/dietary/accessibility fields', 'Travel, registry, dress code, parking, shuttle, hotel/lodging, FAQ, and seating if enabled'],
      guestsWillNotSee: ['Couple planning checklist', 'Private couple profile', 'Venue internal notes', 'Staff assignments', 'Payment details', 'Audit logs', 'Other weddings'],
      mobileQa: ['Open the guest RSVP portal on iPhone Safari', 'Open on Android Chrome', 'Submit a test RSVP for one household', 'Confirm registry/travel links open', 'Confirm accessibility/dietary notes are clear', 'Confirm edit-window/deadline copy is visible'],
      qrPayload: `WVI-RSVP:${eventId}:${event.slug}`,
    };
  });

  app.post('/api/events/:eventId/couple-guest-portal/request-update', { preHandler: requireAuth }, async (req, reply) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound('event-not-found');
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'events.view', orgMap)) throw Forbidden();
    const parsed = z.object({ config: z.record(z.unknown()), note: z.string().max(2000).optional() }).safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    const request = coupleRequestsRepo.create({ organizationId: event.organization_id, eventId, requesterUserId: req.auth!.userId, requestType: 'guest_portal_update', note: parsed.data.note, metadata: { config: parsed.data.config, source: 'couple_guest_portal_editor' } });
    return reply.code(201).send({ request: safeRequest(request) });
  });

  app.post('/api/events/:eventId/couple-guest-portal/reminder-request', { preHandler: requireAuth }, async (req, reply) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound('event-not-found');
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'events.view', orgMap)) throw Forbidden();
    const parsed = z.object({ sendAt: z.string().optional(), audience: z.enum(['not_responded','missing_meal','all_guests']).default('not_responded'), messagePreview: z.string().max(2000) }).safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    const request = coupleRequestsRepo.create({ organizationId: event.organization_id, eventId, requesterUserId: req.auth!.userId, requestType: 'rsvp_reminder_request', note: parsed.data.messagePreview, metadata: { sendAt: parsed.data.sendAt, audience: parsed.data.audience, source: 'couple_rsvp_reminder_builder' } });
    return reply.code(201).send({ request: safeRequest(request) });
  });

}
