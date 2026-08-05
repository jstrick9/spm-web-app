import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../db/database.js';
import { requireAuth } from '../middleware/auth.js';
import { can } from '../lib/rbac.js';
import { timelineRepo, timelineOpsRepo, eventsRepo, eventReadinessRepo, auditRepo, vendorsRepo } from '../db/repos/index.js';
import { BadRequest, Forbidden, NotFound } from '../lib/errors.js';
import { broadcastSSE } from './sse.js';

const timelineSchemaBase = z.object({
  title:        z.string().min(1).max(200),
  category:     z.string().max(40).optional(),
  startsAt:     z.string().min(1).refine((v) => !Number.isNaN(Date.parse(v)), { message: 'invalid-start-date' }),
  endsAt:       z.string().optional().refine((v) => v === undefined || !Number.isNaN(Date.parse(v)), { message: 'invalid-end-date' }),
  durationMin:  z.number().int().positive().optional(),
  location:     z.string().max(200).optional(),
  notes:        z.string().max(4000).optional(),
  vendorId:     z.string().optional(),
  assignedTo:   z.string().optional(),
  metadata:     z.record(z.unknown()).optional(),
});
const timelineSchema = timelineSchemaBase.refine((value) => value.endsAt === undefined || Date.parse(value.endsAt) > Date.parse(value.startsAt), {
  message: 'timeline-end-must-follow-start', path: ['endsAt'],
});

const audienceSchema = z.enum(['venue_staff', 'vendors', 'couple', 'planner']);
const approvalSchema = z.object({
  role: z.enum(['manager', 'owner', 'planner']),
  status: z.enum(['not_started', 'requested', 'approved', 'changes_requested']),
  note: z.string().max(1000).optional(),
});
const changeLogSchema = z.object({
  timelineItemId: z.string().nullable().optional(),
  changeType: z.string().min(1).max(80),
  summary: z.string().min(1).max(1000),
  payload: z.record(z.unknown()).optional(),
});
const incidentSchema = z.object({
  timelineItemId: z.string().nullable().optional(),
  severity: z.enum(['info', 'delay', 'incident', 'critical']).optional(),
  note: z.string().min(1).max(4000),
  status: z.enum(['open', 'monitoring', 'resolved']).optional(),
});
const reminderSchema = z.object({
  timelineItemId: z.string().nullable().optional(),
  remindAt: z.string().min(1).refine((v) => !Number.isNaN(Date.parse(v)), { message: 'invalid-remind-date' }),
  channel: z.enum(['in_app', 'sms', 'email']).optional(),
  audience: audienceSchema.optional(),
  status: z.enum(['queued', 'sent', 'cancelled']).optional(),
  payload: z.record(z.unknown()).optional(),
});
const offlinePacketSchema = z.object({
  audience: audienceSchema,
  payload: z.record(z.unknown()),
});

/** MODULE-05 ST-01: resolve event-scoped access (orgMap pattern). */
function timelineScope(eventId: string, userId: string) {
  return { orgMap: eventsRepo.orgMapForUser(userId) };
}

function ensureTimelineOpsManage(params: { eventId: string }, memberships: any[], userId: string) {
  const event = eventsRepo.findById(params.eventId);
  if (!event) throw NotFound();
  const { orgMap } = timelineScope(params.eventId, userId);
  if (!can(memberships, { eventId: params.eventId }, 'timeline.manage', orgMap)) throw Forbidden();
  return event;
}

function assertTimelineItemBelongsToEvent(timelineItemId: string | null | undefined, eventId: string) {
  if (!timelineItemId) return;
  const item = timelineRepo.findById(timelineItemId);
  if (!item || item.event_id !== eventId) throw BadRequest('invalid-timeline-item');
}

/** MODULE-05 ST-04: timeline references must belong to the event's org. */
function assertVendorInOrg(vendorId: string | undefined, orgId: string) {
  if (!vendorId) return;
  const vendor = vendorsRepo.findById(vendorId);
  if (!vendor || vendor.organization_id !== orgId) throw BadRequest('vendor-not-in-org', { vendorId });
}

function assertAssigneeInOrg(assignedTo: string | undefined, orgId: string) {
  if (!assignedTo) return;
  const member = db.prepare(
    `SELECT 1 FROM organization_memberships WHERE organization_id = ? AND user_id = ? AND status = 'active'`,
  ).get(orgId, assignedTo);
  if (!member) throw BadRequest('assignee-not-in-org', { assignedTo });
}

/** MODULE-05 ST-20: permission-based operations-packet access (was a raw roleKey allow-list). */
function hasOperationsPacketAccess(memberships: any[], orgMap: Record<string, string>, eventId: string) {
  return can(memberships, { eventId }, 'staff.view', orgMap) || can(memberships, { eventId }, 'timeline.view', orgMap);
}

function isCoupleForEvent(memberships: any[], eventId: string) {
  return memberships.some((membership) => membership.eventId === eventId && String(membership.roleKey).toLowerCase() === 'couple');
}

/** MODULE-05 ST-07: approving a role requires actually holding that role (or owner/admin). */
function holdsApprovalRole(memberships: any[], role: string, orgId: string, eventId: string) {
  const lower = role.toLowerCase();
  return memberships.some((m) => {
    const scoped = m.organizationId === orgId || m.eventId === eventId;
    const key = String(m.roleKey ?? '').toLowerCase();
    return scoped && (key === lower || key === 'owner' || key === 'admin');
  });
}

function audit(req: any, orgId: string, action: string, targetType: string, targetId: string, details?: Record<string, unknown>) {
  auditRepo.log({
    organizationId: orgId, actorUserId: req.auth!.userId, actorLabel: req.auth!.email,
    action, targetType, targetId, ip: req.ip, details,
  });
}

export async function timelineRoutes(app: FastifyInstance) {
  app.get('/api/events/:eventId/setup-packet', { preHandler: requireAuth }, async (req) => {
    const { eventId } = req.params as { eventId: string }; const event = eventsRepo.findById(eventId); if (!event) throw NotFound();
    const { orgMap } = timelineScope(eventId, req.auth!.userId);
    if (!hasOperationsPacketAccess(req.auth!.memberships, orgMap, eventId)) throw Forbidden();
    const layout = db.prepare(`SELECT id, name, revision, payload FROM layouts WHERE event_id = ? AND approval_status = 'approved' ORDER BY updated_at DESC LIMIT 1`).get(eventId) as any;
    const timeline = db.prepare(`SELECT t.id, t.title, t.category, t.starts_at, t.ends_at, t.location, t.notes, v.name AS vendor_name FROM timeline_events t LEFT JOIN vendors v ON v.id = t.vendor_id WHERE t.event_id = ? ORDER BY t.starts_at`).all(eventId);
    const vendors = db.prepare(`SELECT id, name, category, notes, metadata FROM vendors WHERE event_id = ? AND deleted_at IS NULL ORDER BY name`).all(eventId) as any[];
    const staffing = db.prepare(`SELECT u.full_name, r.key AS role_key FROM event_memberships em JOIN users u ON u.id = em.user_id JOIN roles r ON r.id = em.role_id WHERE em.event_id = ? AND em.status = 'active' AND r.key IN ('staff','planner') ORDER BY r.key, u.full_name`).all(eventId);
    return { packet: { event: { id: event.id, title: event.title, startDate: event.start_date, guestCount: event.guest_count }, layout: layout ? { id: layout.id, name: layout.name, revision: layout.revision, payload: JSON.parse(layout.payload || '{}') } : null, timeline, vendorLoadIn: vendors.map((vendor) => ({ id: vendor.id, name: vendor.name, category: vendor.category, loadIn: (() => { try { const meta = JSON.parse(vendor.metadata || '{}'); return meta.loadIn || meta.load_in || null; } catch { return null; } })(), notes: vendor.notes })), staffing } };
  });

  app.get('/api/events/:eventId/couple-schedule', { preHandler: requireAuth }, async (req) => {
    const { eventId } = req.params as { eventId: string }; const event = eventsRepo.findById(eventId); if (!event) throw NotFound();
    if (!isCoupleForEvent(req.auth!.memberships, eventId)) throw Forbidden();
    const schedule = db.prepare(`SELECT title, category, starts_at, ends_at, location FROM timeline_events WHERE event_id = ? ORDER BY starts_at`).all(eventId);
    return { schedule, message: 'Your wedding-day schedule. Venue staffing, vendor load-in, and setup instructions remain with the operations team.' };
  });

  app.get('/api/events/:eventId/timeline', { preHandler: requireAuth }, async (req) => {
    const { eventId } = req.params as { eventId: string };
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'timeline.view', orgMap)) throw Forbidden();
    return { items: timelineRepo.listForEvent(eventId) };
  });

  app.get('/api/events/:eventId/readiness', { preHandler: requireAuth }, async (req) => {
    const { eventId } = req.params as { eventId: string };
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'timeline.view', orgMap) &&
        !can(req.auth!.memberships, { eventId }, 'layouts.view', orgMap)) throw Forbidden();
    const readiness = eventReadinessRepo.forEvent(eventId);
    if (!readiness) throw NotFound();
    return { readiness };
  });

  app.get('/api/events/:eventId/timeline-ops', { preHandler: requireAuth }, async (req) => {
    const { eventId } = req.params as { eventId: string };
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'timeline.view', orgMap)) throw Forbidden();
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound();
    return { ops: timelineOpsRepo.listForEvent(eventId) };
  });

  app.post('/api/events/:eventId/timeline-ops/approval', { preHandler: requireAuth }, async (req, reply) => {
    const event = ensureTimelineOpsManage(req.params as { eventId: string }, req.auth!.memberships, req.auth!.userId);
    const parsed = approvalSchema.safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    // MODULE-05 ST-07: only the role holder (or owner/admin) may record an APPROVED sign-off.
    if (parsed.data.status === 'approved' && !holdsApprovalRole(req.auth!.memberships, parsed.data.role, event.organization_id, event.id)) {
      throw Forbidden('approval-role-mismatch');
    }
    const approval = timelineOpsRepo.upsertApproval(event.organization_id, event.id, { ...parsed.data, actorId: req.auth!.userId });
    audit(req, event.organization_id, 'timeline.approval.set', 'event', event.id, { role: parsed.data.role, status: parsed.data.status, approvalId: approval.id });
    timelineOpsRepo.addChangeLog(event.organization_id, event.id, {
      changeType: 'approval',
      summary: `${parsed.data.role} approval set to ${parsed.data.status}`,
      payload: parsed.data,
      createdBy: req.auth!.userId,
    });
    return reply.code(201).send({ approval });
  });

  app.post('/api/events/:eventId/timeline-ops/change-log', { preHandler: requireAuth }, async (req, reply) => {
    const event = ensureTimelineOpsManage(req.params as { eventId: string }, req.auth!.memberships, req.auth!.userId);
    const parsed = changeLogSchema.safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    assertTimelineItemBelongsToEvent(parsed.data.timelineItemId, event.id);
    const changeLog = timelineOpsRepo.addChangeLog(event.organization_id, event.id, { ...parsed.data, createdBy: req.auth!.userId });
    return reply.code(201).send({ changeLog });
  });

  app.post('/api/events/:eventId/timeline-ops/incident', { preHandler: requireAuth }, async (req, reply) => {
    const event = ensureTimelineOpsManage(req.params as { eventId: string }, req.auth!.memberships, req.auth!.userId);
    const parsed = incidentSchema.safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    assertTimelineItemBelongsToEvent(parsed.data.timelineItemId, event.id);
    const incident = timelineOpsRepo.addIncident(event.organization_id, event.id, { ...parsed.data, createdBy: req.auth!.userId });
    audit(req, event.organization_id, 'timeline.incident.created', 'event', event.id, { incidentId: incident.id, severity: parsed.data.severity ?? 'info', note: parsed.data.note });
    timelineOpsRepo.addChangeLog(event.organization_id, event.id, {
      timelineItemId: parsed.data.timelineItemId ?? null,
      changeType: 'incident',
      summary: parsed.data.note,
      payload: { severity: parsed.data.severity ?? 'info', status: parsed.data.status ?? 'open' },
      createdBy: req.auth!.userId,
    });
    return reply.code(201).send({ incident });
  });

  app.post('/api/events/:eventId/timeline-ops/reminder', { preHandler: requireAuth }, async (req, reply) => {
    const event = ensureTimelineOpsManage(req.params as { eventId: string }, req.auth!.memberships, req.auth!.userId);
    const parsed = reminderSchema.safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    assertTimelineItemBelongsToEvent(parsed.data.timelineItemId, event.id);
    // MODULE-05 ST-06: no SMS gateway exists — reject the channel at creation instead of queueing forever.
    if (parsed.data.channel === 'sms') throw BadRequest('sms-channel-not-configured');
    const reminder = timelineOpsRepo.addReminder(event.organization_id, event.id, {
      ...parsed.data,
      // Store canonical ISO so the reminder scan's ISO comparison works
      // regardless of what string the client sent.
      remindAt: new Date(parsed.data.remindAt).toISOString(),
      createdBy: req.auth!.userId,
    });
    audit(req, event.organization_id, 'timeline.reminder.created', 'event', event.id, { reminderId: reminder.id, remindAt: reminder.remind_at, channel: reminder.channel, audience: reminder.audience });
    return reply.code(201).send({ reminder });
  });

  app.post('/api/events/:eventId/timeline-ops/offline-packet', { preHandler: requireAuth }, async (req, reply) => {
    const event = ensureTimelineOpsManage(req.params as { eventId: string }, req.auth!.memberships, req.auth!.userId);
    const parsed = offlinePacketSchema.safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    const offlinePacket = timelineOpsRepo.upsertOfflinePacket(event.organization_id, event.id, { ...parsed.data, createdBy: req.auth!.userId });
    timelineOpsRepo.addChangeLog(event.organization_id, event.id, {
      changeType: 'offline_packet',
      summary: `${parsed.data.audience} offline packet generated`,
      payload: { audience: parsed.data.audience },
      createdBy: req.auth!.userId,
    });
    return reply.code(201).send({ offlinePacket });
  });

  app.post('/api/events/:eventId/timeline', { preHandler: requireAuth }, async (req, reply) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound();
    const { orgMap } = timelineScope(eventId, req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'timeline.manage', orgMap)) throw Forbidden();
    const parsed = timelineSchema.safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    assertVendorInOrg(parsed.data.vendorId, event.organization_id);
    assertAssigneeInOrg(parsed.data.assignedTo, event.organization_id);
    const item = timelineRepo.create(event.organization_id, eventId, parsed.data);
    audit(req, event.organization_id, 'timeline.create', 'timeline_event', item.id, { title: item.title, startsAt: item.starts_at });
    broadcastSSE(event.organization_id, 'timeline.created', { timelineItemId: item.id, title: item.title, eventId }, req.auth!.userId);
    return reply.code(201).send({ item });
  });

  app.patch('/api/timeline/:id', { preHandler: requireAuth }, async (req) => {
    const { id } = req.params as { id: string };
    const item = timelineRepo.findById(id);
    if (!item) throw NotFound();
    const { orgMap } = timelineScope(item.event_id, req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId: item.event_id }, 'timeline.manage', orgMap)) throw Forbidden();
    const parsed = timelineSchemaBase.partial().extend({ completed: z.boolean().optional() }).safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    assertVendorInOrg(parsed.data.vendorId, item.organization_id);
    assertAssigneeInOrg(parsed.data.assignedTo, item.organization_id);
    const updated = timelineRepo.update(id, parsed.data);
    audit(req, item.organization_id, 'timeline.update', 'timeline_event', id, { fields: Object.keys(parsed.data), title: updated?.title ?? item.title });
    broadcastSSE(item.organization_id, 'timeline.updated', { timelineItemId: id, title: updated?.title ?? item.title, eventId: item.event_id }, req.auth!.userId);
    return { item: updated };
  });

  app.delete('/api/timeline/:id', { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const item = timelineRepo.findById(id);
    if (!item) throw NotFound();
    const { orgMap } = timelineScope(item.event_id, req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId: item.event_id }, 'timeline.manage', orgMap)) throw Forbidden();
    timelineRepo.delete(id);
    audit(req, item.organization_id, 'timeline.delete', 'timeline_event', id, { title: item.title });
    broadcastSSE(item.organization_id, 'timeline.deleted', { timelineItemId: id, title: item.title, eventId: item.event_id }, req.auth!.userId);
    return reply.code(204).send();
  });
}
