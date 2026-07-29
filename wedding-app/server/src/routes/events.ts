import type { FastifyInstance } from 'fastify';
import { broadcastSSE } from "./sse.js";
import { z } from 'zod';
import { db } from '../db/database.js';
import { requireAuth } from '../middleware/auth.js';
import { can } from '../lib/rbac.js';
import {
  auditRepo, eventsRepo, orgsRepo, subEventsRepo,
} from '../db/repos/index.js';
import { Forbidden, NotFound, BadRequest } from '../lib/errors.js';
import { runTrigger } from '../jobs/lifecycleEmails.js';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const createEventSchema = z.object({
  organizationId: z.string().min(1),
  title:          z.string().min(1).max(200),
  status:         z.enum(['lead','hold','booked','planning','final_review','completed','cancelled','lost']).optional(),
  startDate:      isoDate.optional(),
  endDate:        isoDate.optional(),
  guestCount:     z.number().int().min(0).optional(),
  budgetCents:    z.number().int().min(0).optional(),
  primaryContactUserId: z.string().optional(),
  leadSource: z.enum(['website','referral','the_knot','weddingwire','facebook','instagram','google','walk_in','other']).optional(),
  rsvpDeadline: z.string().optional(),
  venueId: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

const updateEventSchema = createEventSchema.extend({
  metadata: z.record(z.any()).optional(),
}).partial().omit({ organizationId: true });

const subEventSchema = z.object({
  title:       z.string().min(1).max(200),
  startsAt:    z.string().min(1),
  endsAt:      z.string().optional(),
  venueId:     z.string().optional(),
  inviteOnly:  z.boolean().optional(),
  metadata:    z.record(z.unknown()).optional(),
});

function finalReviewReadiness(event: any) {
  const metadata = (() => { try { return JSON.parse(event.metadata || '{}'); } catch { return {}; } })() as Record<string, any>;
  const approvedLayouts = db.prepare(`SELECT id, payload FROM layouts WHERE event_id = ? AND approval_status = 'approved'`).all(event.id) as Array<{ id: string; payload: string }>;
  const hasAccessibleRoute = approvedLayouts.some((layout) => { try { return (JSON.parse(layout.payload || '{}').zones || []).some((zone: any) => zone.type === 'accessible_route'); } catch { return false; } });
  const timelineCount = Number((db.prepare(`SELECT COUNT(*) AS count FROM timeline_events WHERE event_id = ?`).get(event.id) as any).count);
  const timelineReviewed = Number((db.prepare(`SELECT COUNT(*) AS count FROM timeline_approvals WHERE event_id = ? AND status = 'approved'`).get(event.id) as any).count) > 0;
  const vendorCount = Number((db.prepare(`SELECT COUNT(*) AS count FROM vendors WHERE event_id = ? AND deleted_at IS NULL`).get(event.id) as any).count);
  const staffCount = Number((db.prepare(`SELECT COUNT(*) AS count FROM event_memberships em JOIN roles r ON r.id = em.role_id WHERE em.event_id = ? AND em.status = 'active' AND r.key IN ('staff','planner')`).get(event.id) as any).count);
  const packetCount = approvedLayouts.length ? Number((db.prepare(`SELECT COUNT(*) AS count FROM layout_setup_packets WHERE layout_id IN (${approvedLayouts.map(() => '?').join(',')}) AND revoked_at IS NULL`).get(...approvedLayouts.map((layout) => layout.id) as any[]) as any).count) : 0;
  const checks = [
    { key: 'approved_layout', label: 'Approved layout', complete: approvedLayouts.length > 0 },
    { key: 'confirmed_guest_count', label: 'Confirmed guest count', complete: event.guest_count > 0 && metadata.finalGuestCountConfirmed === true },
    { key: 'reviewed_timeline', label: 'Reviewed timeline', complete: timelineCount > 0 && timelineReviewed },
    { key: 'vendor_assignments', label: 'Vendor assignments', complete: vendorCount > 0 },
    { key: 'staffing_readiness', label: 'Staffing readiness', complete: staffCount > 0 && metadata.staffingReady === true },
    { key: 'setup_packet', label: 'Detailed setup packet', complete: packetCount > 0 },
    { key: 'inventory_readiness', label: 'Inventory readiness', complete: metadata.inventoryReady === true },
    { key: 'accessibility_checks', label: 'Accessibility checks', complete: hasAccessibleRoute && metadata.accessibilityChecked === true },
    { key: 'rain_plan_checks', label: 'Rain-plan checks', complete: metadata.rainPlanRequired !== true || metadata.rainPlanChecked === true },
  ];
  return { ready: checks.every((check) => check.complete), checks };
}

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
    const q = req.query as {
      status?: string; search?: string;
      startsAfter?: string; startsBefore?: string;
      limit?: string; offset?: string;
    };
    const statusList = q.status
      ? q.status.split(',').filter(Boolean) as Array<'lead'|'hold'|'booked'|'planning'|'final_review'|'completed'|'cancelled'|'lost'>
      : undefined;
    const events = eventsRepo.listForOrg(orgId, {
      status: statusList,
      search: q.search,
      startsAfter: q.startsAfter,
      startsBefore: q.startsBefore,
      limit: q.limit ? Number(q.limit) : undefined,
      offset: q.offset ? Number(q.offset) : undefined,
    });
    const counts = eventsRepo.countByStatus(orgId);
    return { events, counts };
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
      leadSource: parsed.data.leadSource,
      rsvpDeadline: parsed.data.rsvpDeadline,
      venueId: parsed.data.venueId,
      metadata: parsed.data.metadata,
      createdBy: req.auth!.userId,
    });
    auditRepo.log({
      organizationId: parsed.data.organizationId, actorUserId: req.auth!.userId,
      actorLabel: req.auth!.email, action: 'event.create',
      targetType: 'event', targetId: event.id, ip: req.ip,
    });
    broadcastSSE(parsed.data.organizationId, "event.created", { eventId: event.id, title: event.title }, req.auth!.userId);
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

  app.get('/api/events/:eventId/final-review/change-requests', { preHandler: requireAuth }, async (req) => {
    const { eventId } = req.params as { eventId: string }; const event = eventsRepo.findById(eventId); if (!event) throw NotFound();
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId); if (!can(req.auth!.memberships, { eventId }, 'events.view', orgMap)) throw Forbidden();
    return { requests: db.prepare(`SELECT id, requested_role, detail, status, manager_note, decided_at, created_at FROM final_review_change_requests WHERE event_id = ? ORDER BY created_at DESC`).all(eventId) };
  });

  app.post('/api/events/:eventId/final-review/change-requests', { preHandler: requireAuth }, async (req, reply) => {
    const { eventId } = req.params as { eventId: string }; const event = eventsRepo.findById(eventId); if (!event) throw NotFound();
    const detail = z.object({ detail: z.string().min(3).max(2000) }).safeParse(req.body); if (!detail.success) throw BadRequest('invalid-input', detail.error.issues);
    const membership = req.auth!.memberships.find((item: any) => item.eventId === eventId && ['couple', 'planner'].includes(String(item.roleKey).toLowerCase()));
    const isManager = req.auth!.memberships.some((item: any) => item.organizationId === event.organization_id && ['owner', 'manager'].includes(String(item.roleKey).toLowerCase()));
    if (!membership && !isManager) throw Forbidden();
    const requestedRole = isManager ? 'manager' : String(membership!.roleKey).toLowerCase(); const id = crypto.randomUUID();
    db.prepare(`INSERT INTO final_review_change_requests (id, organization_id, event_id, requested_by, requested_role, detail) VALUES (?, ?, ?, ?, ?, ?)`).run(id, event.organization_id, eventId, req.auth!.userId, requestedRole, detail.data.detail);
    auditRepo.log({ organizationId: event.organization_id, actorUserId: req.auth!.userId, actorLabel: req.auth!.email, action: 'event.final_review.change_requested', targetType: 'event', targetId: eventId, ip: req.ip, details: { requestId: id, requestedRole } });
    return reply.code(201).send({ request: db.prepare(`SELECT * FROM final_review_change_requests WHERE id = ?`).get(id) });
  });

  app.patch('/api/events/:eventId/final-review/change-requests/:requestId', { preHandler: requireAuth }, async (req) => {
    const { eventId, requestId } = req.params as { eventId: string; requestId: string }; const event = eventsRepo.findById(eventId); if (!event) throw NotFound();
    const isManager = req.auth!.memberships.some((item: any) => item.organizationId === event.organization_id && ['owner', 'manager'].includes(String(item.roleKey).toLowerCase())); if (!isManager) throw Forbidden();
    const parsed = z.object({ status: z.enum(['accepted', 'declined', 'resolved']), managerNote: z.string().max(2000).optional() }).safeParse(req.body); if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    const existing = db.prepare(`SELECT id FROM final_review_change_requests WHERE id = ? AND event_id = ?`).get(requestId, eventId); if (!existing) throw NotFound('final-review-change-request-not-found');
    db.prepare(`UPDATE final_review_change_requests SET status = ?, manager_note = ?, decided_by = ?, decided_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`).run(parsed.data.status, parsed.data.managerNote ?? null, req.auth!.userId, requestId);
    auditRepo.log({ organizationId: event.organization_id, actorUserId: req.auth!.userId, actorLabel: req.auth!.email, action: 'event.final_review.change_decided', targetType: 'event', targetId: eventId, ip: req.ip, details: { requestId, status: parsed.data.status } });
    return { request: db.prepare(`SELECT * FROM final_review_change_requests WHERE id = ?`).get(requestId) };
  });

  app.get('/api/events/:eventId/final-review', { preHandler: requireAuth }, async (req) => {
    const { eventId } = req.params as { eventId: string }; const event = eventsRepo.findById(eventId); if (!event) throw NotFound();
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId); if (!can(req.auth!.memberships, { eventId }, 'events.view', orgMap)) throw Forbidden();
    return { finalReview: finalReviewReadiness(event) };
  });

  app.post('/api/events/:eventId/stage', { preHandler: requireAuth }, async (req) => {
    const { eventId } = req.params as { eventId: string }; const event = eventsRepo.findById(eventId); if (!event) throw NotFound();
    const roleKeys = req.auth!.memberships.filter((membership: any) => membership.organizationId === event.organization_id).map((membership: any) => String(membership.roleKey).toLowerCase());
    if (!roleKeys.some((key: string) => ['owner','manager'].includes(key))) throw Forbidden();
    const parsed = z.object({ status: z.enum(['lead','hold','booked','planning','final_review','completed','cancelled','lost']) }).safeParse(req.body); if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    if (parsed.data.status === 'final_review') { const finalReview = finalReviewReadiness(event); if (!finalReview.ready) throw BadRequest('final-review-not-ready', { checks: finalReview.checks.filter((check) => !check.complete) }); }
    const updated = eventsRepo.update(eventId, { status: parsed.data.status });
    auditRepo.log({ organizationId: event.organization_id, actorUserId: req.auth!.userId, actorLabel: req.auth!.email, action: 'event.stage.transition', targetType: 'event', targetId: eventId, ip: req.ip, details: { from: event.status, to: parsed.data.status } });
    return { event: updated };
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
      leadSource: 'lead_source',
      rsvpDeadline: 'rsvp_deadline',
      venueId: 'venue_id',
    };
    for (const [k, col] of Object.entries(keyMap)) {
      if (k in dataIn && dataIn[k] !== undefined) patch[col] = dataIn[k];
    }
    if ('metadata' in dataIn && dataIn.metadata !== undefined) {
      patch.metadata = dataIn.metadata as Record<string, unknown>;
    }
    const updated = eventsRepo.update(eventId, patch as never);
    auditRepo.log({
      organizationId: event.organization_id, actorUserId: req.auth!.userId,
      actorLabel: req.auth!.email, action: 'event.update',
      targetType: 'event', targetId: eventId, ip: req.ip,
    });
    broadcastSSE(event.organization_id, "event.updated", { eventId, title: updated?.title }, req.auth!.userId);

    // Lifecycle email: when an event transitions INTO 'completed', fire the
    // thank-you automation (no-op if the org hasn't configured/enabled one or
    // has no connected SMTP integration). Idempotent — only on the transition.
    if (patch.status === 'completed' && event.status !== 'completed') {
      try { runTrigger(eventId, 'thank_you'); } catch (e) { req.log.error(e); }
    }
    return { event: updated };
  });


  // ─── Duplicate event (copy as template) ───────────────
  app.post("/api/events/:eventId/duplicate", { preHandler: requireAuth }, async (req, reply) => {
    const { eventId } = req.params as { eventId: string };
    const source = eventsRepo.findById(eventId);
    if (!source) throw NotFound();
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { organizationId: source.organization_id }, "events.create", orgMap)) throw Forbidden();

    const sourceMetadata = source.metadata ? (typeof source.metadata === 'string' ? JSON.parse(source.metadata) : source.metadata) : {};
    const metadata = {
      ...sourceMetadata,
      contract_status: "draft",
      rsvp_deadline: null,
      portal_enabled: 0,
    };

    const event = eventsRepo.create({
      organizationId: source.organization_id,
      title: `${source.title} (Copy)`,
      status: "lead",
      startDate: source.start_date ?? undefined,
      endDate: source.end_date ?? undefined,
      guestCount: source.guest_count,
      budgetCents: source.budget_cents ?? undefined,
      metadata,
      createdBy: req.auth!.userId,
    });

    auditRepo.log({
      organizationId: source.organization_id, actorUserId: req.auth!.userId,
      actorLabel: req.auth!.email, action: "event.duplicate",
      targetType: "event", targetId: event.id, ip: req.ip,
      details: { sourceEventId: eventId },
    });

    broadcastSSE(source.organization_id, "event.created", { eventId: event.id, title: event.title }, req.auth!.userId);
    return reply.code(201).send({ event });
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

  app.patch('/api/sub-events/:subId', { preHandler: requireAuth }, async (req) => {
    const { subId } = req.params as { subId: string };
    const sub = subEventsRepo.findById(subId);
    if (!sub) throw NotFound();
    const ev = eventsRepo.findById(sub.event_id);
    if (!ev) throw NotFound();
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId: ev.id }, 'events.edit', orgMap)) throw Forbidden();
    const parsed = subEventSchema.partial().safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    const updated = subEventsRepo.update(subId, parsed.data as never);
    auditRepo.log({ organizationId: ev.organization_id, actorUserId: req.auth!.userId, actorLabel: req.auth!.email, action: 'sub_event.update', targetType: 'sub_event', targetId: subId, ip: req.ip, details: { fields: Object.keys(parsed.data) } });
    return { subEvent: updated };
  });

  app.delete('/api/sub-events/:subId', { preHandler: requireAuth }, async (req, reply) => {
    const { subId } = req.params as { subId: string };
    const sub = subEventsRepo.findById(subId);
    if (sub) {
      const ev = eventsRepo.findById(sub.event_id);
      if (ev && !can(req.auth!.memberships, { organizationId: ev.organization_id }, "events.edit")) throw Forbidden();
    }
    subEventsRepo.delete(subId);
    return reply.code(204).send();
  });
}
