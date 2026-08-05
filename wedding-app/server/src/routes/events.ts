import type { FastifyInstance } from 'fastify';
import { broadcastSSE } from "./sse.js";
import { z } from 'zod';
import { db } from '../db/database.js';
import { requireAuth } from '../middleware/auth.js';
import { can } from '../lib/rbac.js';
import {
  auditRepo, eventsRepo, orgsRepo, subEventsRepo, eventReadinessRepo,
} from '../db/repos/index.js';
import { Forbidden, NotFound, BadRequest, Conflict } from '../lib/errors.js';
import { runTrigger } from '../jobs/lifecycleEmails.js';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/**
 * New events always enter the sales pipeline — terminal states
 * (completed/cancelled/lost) are reached through stage transitions, never
 * by direct creation.
 */
const ENTRY_STATUSES = ['lead', 'hold', 'booked', 'planning'] as const;
const FULL_STATUSES = ['lead','hold','booked','planning','final_review','completed','cancelled','lost'] as const;

const baseEventSchema = z.object({
  organizationId: z.string().min(1),
  title:          z.string().min(1).max(200),
  status:         z.enum(FULL_STATUSES).optional(),
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

const createEventSchema = baseEventSchema
  .extend({ status: z.enum(ENTRY_STATUSES).optional() })
  .refine(
    (data) => !data.startDate || !data.endDate || data.endDate >= data.startDate,
    { message: 'endDate must be on or after startDate', path: ['endDate'] },
  );

const updateEventSchema = baseEventSchema
  .partial()
  .omit({ organizationId: true })
  .refine(
    (data) => !data.startDate || !data.endDate || data.endDate >= data.startDate,
    { message: 'endDate must be on or after startDate', path: ['endDate'] },
  );

const subEventSchemaBase = z.object({
  title:       z.string().min(1).max(200),
  startsAt:    z.string().min(1),
  endsAt:      z.string().optional(),
  venueId:     z.string().optional(),
  inviteOnly:  z.boolean().optional(),
  metadata:    z.record(z.unknown()).optional(),
});
const subEventSchema = subEventSchemaBase.refine((value) => value.endsAt === undefined || value.endsAt === '' || Date.parse(value.endsAt) > Date.parse(value.startsAt), {
  message: 'sub-event-end-must-follow-start',
  path: ['endsAt'],
});

function finalReviewReadiness(event: any) {  const metadata = (() => { try { return JSON.parse(event.metadata || '{}'); } catch { return {}; } })() as Record<string, any>;
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

/**
 * Block assigning a venue space to an event whose date range already has
 * another active booking on that space — unless the caller explicitly
 * provides a bookingConflictOverrideReason (recorded in the audit log).
 */
function assertNoSpaceConflict(input: {
  organizationId: string;
  venueId: string;
  startDate: string;
  endDate?: string | null;
  excludeEventId?: string;
  metadata?: Record<string, unknown> | null;
  actorUserId: string;
  actorLabel: string;
  ip: string;
}): void {
  const conflicts = eventsRepo.listSpaceConflicts({
    organizationId: input.organizationId,
    venueId: input.venueId,
    startDate: input.startDate,
    endDate: input.endDate ?? input.startDate,
    excludeEventId: input.excludeEventId,
  });
  if (conflicts.length === 0) return;
  const overrideReason = typeof input.metadata?.bookingConflictOverrideReason === 'string'
    ? input.metadata.bookingConflictOverrideReason.trim()
    : '';
  if (overrideReason) {
    auditRepo.log({
      organizationId: input.organizationId, actorUserId: input.actorUserId,
      actorLabel: input.actorLabel, action: 'event.booking_conflict.overridden',
      targetType: 'venue', targetId: input.venueId, ip: input.ip,
      details: { conflicts: conflicts.map((c) => ({ eventId: c.id, title: c.title, startDate: c.start_date, endDate: c.end_date })), reason: overrideReason },
    });
    return;
  }
  throw Conflict('venue-space-conflict', {
    conflicts: conflicts.map((c) => ({ eventId: c.id, title: c.title, startDate: c.start_date, endDate: c.end_date })),
    message: `This space is already booked ${conflicts.map((c) => `“${c.title}” (${c.start_date ?? 'no date'}${c.end_date && c.end_date !== c.start_date ? ` → ${c.end_date}` : ''})`).join(', ')}. Choose another space/date or provide an override reason.`,
  });
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
    if (parsed.data.venueId && parsed.data.startDate) {
      assertNoSpaceConflict({
        organizationId: parsed.data.organizationId,
        venueId: parsed.data.venueId,
        startDate: parsed.data.startDate,
        endDate: parsed.data.endDate,
        metadata: parsed.data.metadata,
        actorUserId: req.auth!.userId,
        actorLabel: req.auth!.email,
        ip: req.ip,
      });
    }
    let duplicateWarning: { matchedEventId: string; matchedStatus: string; matchedTitle: string } | null = null;
    if (parsed.data.startDate && parsed.data.venueId) {
      const dupes = eventsRepo.listForOrg(parsed.data.organizationId, { status: ['lead', 'hold', 'booked', 'planning', 'final_review'] })
        // Same couple + same date ANYWHERE in the venue (space conflicts
        // already catch same-space; this catches the same wedding logged
        // twice in different spaces).
        .filter((e) => e.start_date === parsed.data.startDate && e.title.trim().toLowerCase() === parsed.data.title.trim().toLowerCase() && !e.deleted_at);
      if (dupes.length > 0) {
        duplicateWarning = { matchedEventId: dupes[0].id, matchedStatus: dupes[0].status, matchedTitle: dupes[0].title };
        auditRepo.log({
          organizationId: parsed.data.organizationId, actorUserId: req.auth!.userId,
          actorLabel: req.auth!.email, action: 'event.create.duplicate_warning',
          targetType: 'event', targetId: dupes[0].id, ip: req.ip,
          details: { duplicateTitle: parsed.data.title, startDate: parsed.data.startDate, matchedEventId: dupes[0].id, matchedStatus: dupes[0].status },
        });
      }
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
    return reply.code(201).send({ event, duplicateWarning });
  });

  app.get('/api/events/:eventId/day-of-contact', { preHandler: requireAuth }, async (req) => {
    const { eventId } = req.params as { eventId: string }; const event = eventsRepo.findById(eventId); if (!event) throw NotFound(); const orgMap = eventsRepo.orgMapForUser(req.auth!.userId); if (!can(req.auth!.memberships, { eventId }, 'events.view', orgMap)) throw Forbidden();
    const metadata = (() => { try { return JSON.parse(event.metadata || '{}'); } catch { return {}; } })(); return { contact: metadata.dayOfContact || { name: '', phone: '', email: '', hours: '', escalation: '' } };
  });
  app.put('/api/events/:eventId/day-of-contact', { preHandler: requireAuth }, async (req) => {
    const { eventId } = req.params as { eventId: string }; const event = eventsRepo.findById(eventId); if (!event) throw NotFound(); const orgMap = eventsRepo.orgMapForUser(req.auth!.userId); if (!can(req.auth!.memberships, { eventId }, 'events.edit', orgMap)) throw Forbidden();
    const parsed = z.object({ name: z.string().min(1).max(160), phone: z.string().max(40).optional(), email: z.string().email().optional().or(z.literal('')), hours: z.string().max(200).optional(), escalation: z.string().max(1000).optional() }).safeParse(req.body); if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    const metadata = (() => { try { return JSON.parse(event.metadata || '{}'); } catch { return {}; } })(); eventsRepo.update(eventId, { metadata: { ...metadata, dayOfContact: parsed.data } });
    auditRepo.log({ organizationId: event.organization_id, actorUserId: req.auth!.userId, actorLabel: req.auth!.email, action: 'event.day_of_contact.update', targetType: 'event', targetId: eventId, ip: req.ip, details: { name: parsed.data.name } });
    broadcastSSE(event.organization_id, "event.updated", { eventId, title: event.title }, req.auth!.userId);
    return { contact: parsed.data };
  });

  app.post('/api/events/:eventId/couple-updates', { preHandler: requireAuth }, async (req, reply) => {
    const { eventId } = req.params as { eventId: string }; const event = eventsRepo.findById(eventId); if (!event) throw NotFound(); if (!can(req.auth!.memberships, { organizationId: event.organization_id }, 'events.edit')) throw Forbidden();
    const parsed = z.object({ templateId: z.string().optional(), title: z.string().min(1).max(200), body: z.string().min(1).max(4000), category: z.string().min(1).max(60), critical: z.boolean().optional() }).safeParse(req.body); if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    const id = crypto.randomUUID(); db.prepare(`INSERT INTO event_week_updates (id, organization_id, event_id, template_id, title, body, category, critical, published_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(id, event.organization_id, eventId, parsed.data.templateId || null, parsed.data.title, parsed.data.body, parsed.data.category, parsed.data.critical ? 1 : 0, req.auth!.userId);
    return reply.code(201).send({ update: db.prepare(`SELECT * FROM event_week_updates WHERE id=?`).get(id) });
  });
  app.get('/api/events/:eventId/couple-updates/summary', { preHandler: requireAuth }, async (req) => {
    const { eventId } = req.params as { eventId: string }; const event = eventsRepo.findById(eventId); if (!event) throw NotFound(); if (!can(req.auth!.memberships, { organizationId: event.organization_id }, 'events.view')) throw Forbidden();
    const coupleCount = Number((db.prepare(`SELECT COUNT(*) AS count FROM event_memberships em JOIN roles r ON r.id=em.role_id WHERE em.event_id=? AND em.status='active' AND r.key='couple'`).get(eventId) as any).count);
    const updates = db.prepare(`SELECT u.id, u.title, u.category, u.critical, u.published_at, COUNT(a.user_id) AS viewed_count, SUM(CASE WHEN a.acknowledged_at IS NOT NULL THEN 1 ELSE 0 END) AS acknowledged_count FROM event_week_updates u LEFT JOIN event_week_update_acknowledgments a ON a.update_id=u.id WHERE u.event_id=? GROUP BY u.id ORDER BY u.published_at DESC`).all(eventId);
    return { coupleCount, updates };
  });

  app.get('/api/events/:eventId/couple-updates', { preHandler: requireAuth }, async (req) => {
    const { eventId } = req.params as { eventId: string }; const event = eventsRepo.findById(eventId); if (!event) throw NotFound(); const isCouple = req.auth!.memberships.some((membership: any) => membership.eventId === eventId && String(membership.roleKey).toLowerCase() === 'couple'); if (!isCouple) throw Forbidden();
    const updates = db.prepare(`SELECT u.*, a.viewed_at, a.acknowledged_at FROM event_week_updates u LEFT JOIN event_week_update_acknowledgments a ON a.update_id=u.id AND a.user_id=? WHERE u.event_id=? ORDER BY u.published_at DESC`).all(req.auth!.userId, eventId); return { updates };
  });
  app.post('/api/events/:eventId/couple-updates/:updateId/view', { preHandler: requireAuth }, async (req) => {
    const { eventId, updateId } = req.params as { eventId: string; updateId: string }; const isCouple = req.auth!.memberships.some((membership: any) => membership.eventId === eventId && String(membership.roleKey).toLowerCase() === 'couple'); if (!isCouple) throw Forbidden();
    db.prepare(`INSERT INTO event_week_update_acknowledgments (update_id, user_id, viewed_at) VALUES (?, ?, datetime('now')) ON CONFLICT(update_id, user_id) DO UPDATE SET viewed_at=datetime('now')`).run(updateId, req.auth!.userId); return { ok: true };
  });
  app.post('/api/events/:eventId/couple-updates/:updateId/acknowledge', { preHandler: requireAuth }, async (req) => {
    const { eventId, updateId } = req.params as { eventId: string; updateId: string }; const isCouple = req.auth!.memberships.some((membership: any) => membership.eventId === eventId && String(membership.roleKey).toLowerCase() === 'couple'); if (!isCouple) throw Forbidden();
    db.prepare(`INSERT INTO event_week_update_acknowledgments (update_id, user_id, viewed_at, acknowledged_at) VALUES (?, ?, datetime('now'), datetime('now')) ON CONFLICT(update_id, user_id) DO UPDATE SET viewed_at=datetime('now'), acknowledged_at=datetime('now')`).run(updateId, req.auth!.userId); return { ok: true };
  });

  app.get('/api/orgs/:orgId/communication-templates', { preHandler: requireAuth }, async (req) => {
    const { orgId } = req.params as { orgId: string }; if (!can(req.auth!.memberships, { organizationId: orgId }, 'events.view')) throw Forbidden();
    return { templates: db.prepare(`SELECT * FROM venue_communication_templates WHERE organization_id=? ORDER BY active DESC, category, name`).all(orgId) };
  });
  app.post('/api/orgs/:orgId/communication-templates', { preHandler: requireAuth }, async (req, reply) => {
    const { orgId } = req.params as { orgId: string }; if (!can(req.auth!.memberships, { organizationId: orgId }, 'events.edit')) throw Forbidden();
    const parsed = z.object({ name: z.string().min(1).max(120), category: z.enum(['rain_plan','timing_change','parking','arrival','guest_guidance','other']), audience: z.enum(['couple','guests','both']), subject: z.string().min(1).max(200), body: z.string().min(1).max(4000), active: z.boolean().optional() }).safeParse(req.body); if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    const id = crypto.randomUUID(); db.prepare(`INSERT INTO venue_communication_templates (id, organization_id, name, category, audience, subject, body, active, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(id, orgId, parsed.data.name, parsed.data.category, parsed.data.audience, parsed.data.subject, parsed.data.body, parsed.data.active === false ? 0 : 1, req.auth!.userId);
    return reply.code(201).send({ template: db.prepare(`SELECT * FROM venue_communication_templates WHERE id=?`).get(id) });
  });

  app.patch('/api/communication-templates/:id', { preHandler: requireAuth }, async (req) => {
    const { id } = req.params as { id: string }; const template = db.prepare(`SELECT * FROM venue_communication_templates WHERE id=?`).get(id) as any; if (!template) throw NotFound(); if (!can(req.auth!.memberships, { organizationId: template.organization_id }, 'events.edit')) throw Forbidden();
    const parsed = z.object({ name: z.string().min(1).max(120).optional(), category: z.enum(['rain_plan','timing_change','parking','arrival','guest_guidance','other']).optional(), audience: z.enum(['couple','guests','both']).optional(), subject: z.string().min(1).max(200).optional(), body: z.string().min(1).max(4000).optional(), active: z.boolean().optional() }).safeParse(req.body); if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    const map: Record<string, string> = { name: 'name', category: 'category', audience: 'audience', subject: 'subject', body: 'body', active: 'active' }; const fields: string[] = []; const values: any[] = []; for (const [key, column] of Object.entries(map)) if (key in parsed.data) { fields.push(`${column}=?`); values.push(key === 'active' ? ((parsed.data as any)[key] ? 1 : 0) : (parsed.data as any)[key]); } if (!fields.length) return { template }; values.push(id); db.prepare(`UPDATE venue_communication_templates SET ${fields.join(', ')}, updated_at=datetime('now') WHERE id=?`).run(...values); return { template: db.prepare(`SELECT * FROM venue_communication_templates WHERE id=?`).get(id) };
  });

  app.get('/api/orgs/:orgId/portfolio-readiness', { preHandler: requireAuth }, async (req) => {
    const { orgId } = req.params as { orgId: string }; if (!can(req.auth!.memberships, { organizationId: orgId }, 'events.view')) throw Forbidden();
    const events = eventsRepo.listForOrg(orgId, { status: ['booked','planning','final_review'] as any });
    const summary = events.map((event) => { const readiness = eventReadinessRepo.forEvent(event.id); return { id: event.id, title: event.title, status: event.status, startDate: event.start_date, guestCount: event.guest_count, readinessScore: readiness?.score ?? 0, criticalIssues: readiness?.issues.filter((issue) => issue.severity === 'critical').length ?? 0, warningIssues: readiness?.issues.filter((issue) => issue.severity === 'warning').length ?? 0, nextIssue: readiness?.issues[0] ? { title: readiness.issues[0].title, detail: readiness.issues[0].detail, href: readiness.issues[0].href } : null }; });
    summary.sort((a, b) => b.criticalIssues - a.criticalIssues || b.warningIssues - a.warningIssues || a.readinessScore - b.readinessScore || String(a.startDate || '').localeCompare(String(b.startDate || '')));
    return { events: summary };
  });

  app.get('/api/events/:eventId/live-operations', { preHandler: requireAuth }, async (req) => {
    const { eventId } = req.params as { eventId: string }; const event = eventsRepo.findById(eventId); if (!event) throw NotFound();
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId); if (!can(req.auth!.memberships, { eventId }, 'events.view', orgMap) && !can(req.auth!.memberships, { organizationId: event.organization_id }, 'staff.view')) throw Forbidden();
    const tasks = db.prepare(`SELECT id, title, status, priority, due_at, assigned_staff FROM staff_tasks WHERE event_id=? AND status!='completed' ORDER BY CASE priority WHEN 'critical' THEN 1 WHEN 'high' THEN 2 ELSE 3 END, due_at`).all(eventId);
    const shifts = db.prepare(`SELECT s.id, s.role, s.starts_at, s.ends_at, s.clocked_in_at, s.clocked_out_at, u.full_name AS staff_name FROM staff_shifts s LEFT JOIN users u ON u.id=s.staff_id WHERE s.event_id=? ORDER BY s.starts_at`).all(eventId);
    const vendors = db.prepare(`SELECT id, name, category, metadata FROM vendors WHERE event_id=? AND deleted_at IS NULL ORDER BY name`).all(eventId) as any[];
    const incidents = db.prepare(`SELECT id, severity, note, status, created_at FROM timeline_incidents WHERE event_id=? AND status!='resolved' ORDER BY CASE severity WHEN 'critical' THEN 1 WHEN 'incident' THEN 2 ELSE 3 END, created_at DESC`).all(eventId);
    const layouts = db.prepare(`SELECT id, name, approval_status, revision FROM layouts WHERE event_id=? ORDER BY updated_at DESC`).all(eventId);
    return { board: { event: { id: event.id, title: event.title, startDate: event.start_date, status: event.status }, tasks, shifts, vendors: vendors.map((vendor) => ({ ...vendor, loadIn: (() => { try { const metadata = JSON.parse(vendor.metadata || '{}'); return metadata.loadIn || metadata.load_in || null; } catch { return null; } })() })), incidents, layouts } };
  });

  app.get('/api/events/:eventId', { preHandler: requireAuth }, async (req) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound();
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'events.view', orgMap)) throw Forbidden();
    return { event };
  });

  app.post('/api/events/:eventId/final-review/checks', { preHandler: requireAuth }, async (req) => {
    const { eventId } = req.params as { eventId: string }; const event = eventsRepo.findById(eventId); if (!event) throw NotFound();
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'events.stage.transition', orgMap)) throw Forbidden();
    const parsed = z.object({ key: z.enum(['confirmed_guest_count', 'staffing_readiness', 'inventory_readiness', 'accessibility_checks', 'rain_plan_checks']), complete: z.boolean() }).safeParse(req.body); if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    const metadata = (() => { try { return JSON.parse(event.metadata || '{}'); } catch { return {}; } })() as Record<string, any>;
    const metadataKey: Record<string, string> = { confirmed_guest_count: 'finalGuestCountConfirmed', staffing_readiness: 'staffingReady', inventory_readiness: 'inventoryReady', accessibility_checks: 'accessibilityChecked', rain_plan_checks: 'rainPlanChecked' };
    metadata[metadataKey[parsed.data.key]] = parsed.data.complete;
    const updated = eventsRepo.update(eventId, { metadata });
    auditRepo.log({ organizationId: event.organization_id, actorUserId: req.auth!.userId, actorLabel: req.auth!.email, action: 'event.final_review.check_updated', targetType: 'event', targetId: eventId, ip: req.ip, details: parsed.data });
    return { event: updated, finalReview: finalReviewReadiness(updated) };
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
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    const isManager = can(req.auth!.memberships, { eventId }, 'events.final_review.decide', orgMap);
    if (!membership && !isManager) throw Forbidden();
    const requestedRole = isManager ? 'manager' : String(membership!.roleKey).toLowerCase(); const id = crypto.randomUUID();
    db.prepare(`INSERT INTO final_review_change_requests (id, organization_id, event_id, requested_by, requested_role, detail) VALUES (?, ?, ?, ?, ?, ?)`).run(id, event.organization_id, eventId, req.auth!.userId, requestedRole, detail.data.detail);
    auditRepo.log({ organizationId: event.organization_id, actorUserId: req.auth!.userId, actorLabel: req.auth!.email, action: 'event.final_review.change_requested', targetType: 'event', targetId: eventId, ip: req.ip, details: { requestId: id, requestedRole } });
    return reply.code(201).send({ request: db.prepare(`SELECT * FROM final_review_change_requests WHERE id = ?`).get(id) });
  });

  app.patch('/api/events/:eventId/final-review/change-requests/:requestId', { preHandler: requireAuth }, async (req) => {
    const { eventId, requestId } = req.params as { eventId: string; requestId: string }; const event = eventsRepo.findById(eventId); if (!event) throw NotFound();
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'events.final_review.decide', orgMap)) throw Forbidden();
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
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'events.stage.transition', orgMap)) throw Forbidden();
    const parsed = z.object({ status: z.enum(['lead','hold','booked','planning','final_review','completed','cancelled','lost']) }).safeParse(req.body); if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    if (parsed.data.status === 'final_review') { const finalReview = finalReviewReadiness(event); if (!finalReview.ready) throw BadRequest('final-review-not-ready', { checks: finalReview.checks.filter((check) => !check.complete) }); }
    const updated = eventsRepo.update(eventId, { status: parsed.data.status });
    auditRepo.log({ organizationId: event.organization_id, actorUserId: req.auth!.userId, actorLabel: req.auth!.email, action: 'event.stage.transition', targetType: 'event', targetId: eventId, ip: req.ip, details: { from: event.status, to: parsed.data.status } });
    // Realtime + lifecycle parity with PATCH: broadcast so every workspace
    // (lists, calendar, command palette) refreshes, and fire the thank-you
    // automation when an event is completed through the stage selector.
    broadcastSSE(event.organization_id, "event.updated", { eventId, title: updated?.title }, req.auth!.userId);
    if (parsed.data.status === 'completed' && event.status !== 'completed') {
      try { runTrigger(eventId, 'thank_you'); } catch (e) { req.log.error(e); }
    }
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
    // Stage-consistency: entering final_review through a PATCH must clear the
    // same readiness gate the dedicated stage endpoint enforces (EV-02).
    if (patch.status === 'final_review' && event.status !== 'final_review') {
      const finalReview = finalReviewReadiness(event);
      if (!finalReview.ready) throw BadRequest('final-review-not-ready', { checks: finalReview.checks.filter((check) => !check.complete) });
    }
    // Space-conflict guard: re-check whenever the space or date window changes.
    const effectiveVenueId: string | null = ('venueId' in dataIn && typeof dataIn.venueId === 'string') ? dataIn.venueId : (event.venue_id ?? null);
    const effectiveStart: string | null = ('startDate' in dataIn && typeof dataIn.startDate === 'string') ? dataIn.startDate : event.start_date;
    const effectiveEnd: string | null = ('endDate' in dataIn && typeof dataIn.endDate === 'string') ? dataIn.endDate : event.end_date;
    // Cross-field date integrity against the event's existing values (the
    // schema refine only sees the patch body, not the stored event).
    if (effectiveStart && effectiveEnd && effectiveEnd < effectiveStart) {
      throw BadRequest('invalid-input', [{ message: 'endDate must be on or after startDate', path: ['endDate'] }]);
    }
    if (effectiveVenueId && effectiveStart) {
      const metadataForOverride = ('metadata' in dataIn && dataIn.metadata !== undefined)
        ? (dataIn.metadata as Record<string, unknown>)
        : (() => { try { return JSON.parse(event.metadata || '{}') as Record<string, unknown>; } catch { return {}; } })();
      assertNoSpaceConflict({
        organizationId: event.organization_id,
        venueId: effectiveVenueId,
        startDate: effectiveStart,
        endDate: effectiveEnd,
        excludeEventId: eventId,
        metadata: metadataForOverride,
        actorUserId: req.auth!.userId,
        actorLabel: req.auth!.email,
        ip: req.ip,
      });
    }
    const updated = eventsRepo.update(eventId, patch as never);
    auditRepo.log({
      organizationId: event.organization_id, actorUserId: req.auth!.userId,
      actorLabel: req.auth!.email, action: 'event.update',
      targetType: 'event', targetId: eventId, ip: req.ip,
    });
    broadcastSSE(event.organization_id, "event.updated", { eventId, title: updated?.title }, req.auth!.userId);

    // MODULE-05 ST-15: the emergency "broadcast announcement" must actually
    // be broadcast (SSE + audit), not silently stored in metadata. Only fires
    // when the announcement text is non-empty AND changed.
    const prevMeta: Record<string, unknown> = (() => { try { return JSON.parse(event.metadata || '{}') as Record<string, unknown>; } catch { return {}; } })();
    const prevBroadcast = typeof prevMeta.emergency_broadcast_announcement === 'string' ? prevMeta.emergency_broadcast_announcement.trim() : '';
    const nextMeta = (patch.metadata ?? prevMeta) as Record<string, unknown>;
    const nextBroadcast = typeof nextMeta.emergency_broadcast_announcement === 'string' ? nextMeta.emergency_broadcast_announcement.trim() : '';
    if (nextBroadcast && nextBroadcast !== prevBroadcast) {
      auditRepo.log({
        organizationId: event.organization_id, actorUserId: req.auth!.userId, actorLabel: req.auth!.email,
        action: 'event.emergency.broadcast', targetType: 'event', targetId: eventId, ip: req.ip,
        details: { message: nextBroadcast },
      });
      broadcastSSE(event.organization_id, 'event.emergency_broadcast', { eventId, message: nextBroadcast, title: updated?.title }, req.auth!.userId);
    }

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
      // A copy is a fresh template, not a second booking: dates are cleared
      // so the new lead doesn't masquerade as scheduled in date-sorted views
      // (space calendar, pipelines, forecasts). The user sets the new date.
      startDate: undefined,
      endDate: undefined,
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
    const parsed = subEventSchemaBase.partial().safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    // Ordering guard against the EFFECTIVE start: the patch may only touch
    // endsAt, in which case compare against the stored starts_at.
    const effectiveStart = parsed.data.startsAt ?? sub.starts_at;
    if (parsed.data.endsAt !== undefined && parsed.data.endsAt !== '' && Date.parse(parsed.data.endsAt) <= Date.parse(effectiveStart)) {
      throw BadRequest('invalid-input', [{ message: 'sub-event-end-must-follow-start', path: ['endsAt'] }]);
    }
    const updated = subEventsRepo.update(subId, parsed.data as never);
    auditRepo.log({ organizationId: ev.organization_id, actorUserId: req.auth!.userId, actorLabel: req.auth!.email, action: 'sub_event.update', targetType: 'sub_event', targetId: subId, ip: req.ip, details: { fields: Object.keys(parsed.data) } });
    return { subEvent: updated };
  });

  app.delete('/api/sub-events/:subId', { preHandler: requireAuth }, async (req, reply) => {
    const { subId } = req.params as { subId: string };
    const sub = subEventsRepo.findById(subId);
    if (!sub) throw NotFound('sub-event-not-found');
    const ev = eventsRepo.findById(sub.event_id);
    if (!ev) throw NotFound();
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId: ev.id }, 'events.edit', orgMap)) throw Forbidden();
    subEventsRepo.delete(subId);
    auditRepo.log({
      organizationId: ev.organization_id, actorUserId: req.auth!.userId,
      actorLabel: req.auth!.email, action: 'sub_event.delete',
      targetType: 'sub_event', targetId: subId, ip: req.ip, details: { eventId: ev.id },
    });
    return reply.code(204).send();
  });
}
