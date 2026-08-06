import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../db/database.js';
import { uuid } from '../lib/crypto.js';
import { requireAuth } from '../middleware/auth.js';
import { can } from '../lib/rbac.js';
import {
  staffTasksRepo, staffAreasRepo, staffShiftsRepo, auditRepo, eventsRepo,
} from '../db/repos/index.js';
import { BadRequest, Forbidden, NotFound } from '../lib/errors.js';
import { broadcastSSE } from './sse.js';

const taskSchema = z.object({
  title:            z.string().min(1).max(200),
  description:      z.string().max(4000).optional(),
  phase:            z.enum(['pre-event','during-event','post-event']).optional(),
  status:           z.enum(['not-started','in-progress','completed','blocked']).optional(),
  priority:         z.enum(['low','medium','high','critical']).optional(),
  dueAt:            z.string().optional(),
  estimatedMinutes: z.number().int().min(0).optional(),
  assigneeName:     z.string().max(160).optional(),
  assigneePhone:    z.string().max(40).optional(),
  assigneeEmail:    z.string().email().optional().or(z.literal('')),
  assignedStaff:    z.array(z.string()).optional(),
  assignedAreas:    z.array(z.string()).optional(),
  tags:             z.array(z.string()).optional(),
  checklist:        z.array(z.object({
    id: z.string(), label: z.string(), completed: z.boolean(),
  })).optional(),
  notes:            z.string().max(4000).optional(),
  eventId:          z.string().nullable().optional(),
});

const areaSchema = z.object({
  name:           z.string().min(1).max(120),
  description:    z.string().max(2000).optional(),
  color:          z.string().max(20).optional(),
  icon:           z.string().max(40).optional(),
  venueId:        z.string().optional(),
  assignedStaff:  z.array(z.string()).optional(),
});

const availabilitySchema = z.object({
  staffId: z.string().min(1),
  dayOfWeek: z.number().int().min(0).max(6),
  startsAt: z.string().regex(/^\d{2}:\d{2}$/),
  endsAt: z.string().regex(/^\d{2}:\d{2}$/),
}).refine((value) => value.startsAt < value.endsAt, { message: 'availability-end-must-follow-start', path: ['endsAt'] });

const shiftSchemaBase = z.object({
  staffId:  z.string().min(1),
  areaId:   z.string().optional(),
  role:     z.enum(['coordinator','setup','cleaning','parking','other']).optional(),
  startsAt: z.string().min(1),
  endsAt:   z.string().min(1),
  notes:    z.string().max(2000).optional(),
  eventId:  z.string().optional(),
  contactName: z.string().max(160).optional(),
  contactPhone: z.string().max(40).optional(),
  contactEmail: z.string().email().optional().or(z.literal('')),
  radioChannel: z.string().max(80).optional(),
  handoffNotes: z.string().max(4000).optional(),
  availabilityOverrideReason: z.string().min(3).max(2000).optional(),
});
const shiftSchema = shiftSchemaBase.refine((value) => {
  const start = Date.parse(value.startsAt);
  const end = Date.parse(value.endsAt);
  if (Number.isNaN(start) || Number.isNaN(end)) return false;
  return start < end;
}, { message: 'shift-times-invalid', path: ['endsAt'] });

/** MODULE-05 ST-04: referenced rows must belong to the same org (no cross-tenant refs). */
function assertEventInOrg(eventId: string | null | undefined, orgId: string) {
  if (!eventId) return;
  const event = eventsRepo.findById(eventId);
  if (!event || event.organization_id !== orgId) throw BadRequest('event-not-in-org', { eventId });
}

function assertAreasInOrg(areaIds: string[] | undefined, orgId: string) {
  for (const areaId of areaIds ?? []) {
    const area = staffAreasRepo.findById(areaId);
    if (!area || area.organization_id !== orgId) throw BadRequest('area-not-in-org', { areaId });
  }
}

function assertStaffInOrg(staffId: string | undefined, orgId: string) {
  if (!staffId) return;
  const member = db.prepare(
    `SELECT 1 FROM organization_memberships WHERE organization_id = ? AND user_id = ? AND status = 'active'`,
  ).get(orgId, staffId);
  if (!member) throw BadRequest('staff-not-in-org', { staffId });
}

/** MODULE-05 ST-05: never double-book a staff member. */
function findShiftConflict(orgId: string, staffId: string, startsAt: string, endsAt: string, excludeId?: string) {
  const rows = db.prepare(
    `SELECT s.id, s.event_id, s.starts_at, s.ends_at, e.title AS event_title
     FROM staff_shifts s LEFT JOIN events e ON e.id = s.event_id
     WHERE s.organization_id = ? AND s.staff_id = ? AND s.starts_at < ? AND s.ends_at > ?${excludeId ? ' AND s.id <> ?' : ''}
     ORDER BY s.starts_at LIMIT 1`,
  ).all(orgId, staffId, endsAt, startsAt, ...(excludeId ? [excludeId] : [])) as Array<{ id: string; event_id: string | null; starts_at: string; ends_at: string; event_title: string | null }>;
  return rows[0];
}

/** MODULE-05: availability-window enforcement shared by create + update. */
function checkAvailabilityWindow(orgId: string, staffId: string, startsAt: string, endsAt: string, overrideReason?: string) {
  // Shifts arrive as LOCAL (naive) datetimes from the client and
  // availability slots are LOCAL wall-clock ('HH:MM' + local weekday).
  // Comparing via UTC getters (getUTCDay / toISOString) shifted every US
  // shift by UTC offset — a 9am-5pm shift exactly matching the Monday slot
  // was rejected as "outside availability". Use local calendar components.
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  const pad = (n: number) => String(n).padStart(2, '0');
  const day = start.getDay();
  const startTime = `${pad(start.getHours())}:${pad(start.getMinutes())}`;
  const endTime = `${pad(end.getHours())}:${pad(end.getMinutes())}`;
  const sameLocalDay = start.toDateString() === end.toDateString();
  const availability = db.prepare(
    `SELECT starts_at, ends_at FROM staff_weekly_availability WHERE organization_id=? AND staff_id=? AND day_of_week=?`,
  ).all(orgId, staffId, day) as Array<{ starts_at: string; ends_at: string }>;
  const withinAvailability = availability.some((slot) => startTime >= slot.starts_at && endTime <= slot.ends_at && sameLocalDay);
  if (availability.length > 0 && !withinAvailability && !overrideReason?.trim()) {
    throw BadRequest('staff-availability-override-required', { staffId, dayOfWeek: day, startTime, endTime });
  }
  return { withinAvailability, day };
}

function staffingCoverage(orgId: string) {
  const shifts = db.prepare(`SELECT s.id, s.event_id, s.staff_id, s.role, s.starts_at, s.ends_at, e.title AS event_title, u.full_name AS staff_name FROM staff_shifts s LEFT JOIN events e ON e.id=s.event_id LEFT JOIN users u ON u.id=s.staff_id WHERE s.organization_id=? ORDER BY s.starts_at`).all(orgId) as any[];
  const conflictDetails = shifts.flatMap((shift, index) => shifts.slice(index + 1).filter((other) => shift.staff_id === other.staff_id && shift.starts_at < other.ends_at && other.starts_at < shift.ends_at).map((other) => ({ shiftId: shift.id, conflictingShiftId: other.id, staffId: shift.staff_id, staffName: shift.staff_name || 'Staff member', eventId: shift.event_id, eventTitle: shift.event_title || 'Unassigned', conflictingEventId: other.event_id, conflictingEventTitle: other.event_title || 'Unassigned', startsAt: shift.starts_at, endsAt: shift.ends_at, conflictingStartsAt: other.starts_at, conflictingEndsAt: other.ends_at })));
  const conflicts = conflictDetails.flatMap((conflict) => [conflict.shiftId, conflict.conflictingShiftId]);
  const taskRows = db.prepare(`SELECT event_id, COUNT(*) AS task_count, SUM(CASE WHEN status='blocked' THEN 1 ELSE 0 END) AS blocked_count FROM staff_tasks WHERE organization_id=? GROUP BY event_id`).all(orgId) as Array<{ event_id: string | null; task_count: number; blocked_count: number }>;
  const taskMap = new Map(taskRows.map((task) => [task.event_id || 'unassigned', task]));
  const activeEvents = db.prepare(`SELECT id, title, metadata FROM events WHERE organization_id=? AND deleted_at IS NULL AND status IN ('booked','planning','final_review')`).all(orgId) as Array<{ id: string; title: string; metadata: string }>;
  const eventMap = new Map<string, any>(); for (const event of activeEvents) { let metadata: any = {}; try { metadata = JSON.parse(event.metadata || '{}'); } catch {} eventMap.set(event.id, { eventId: event.id, eventTitle: event.title, shifts: [], staffIds: new Set<string>(), requiredRoles: Array.isArray(metadata.staffingRequiredRoles) ? metadata.staffingRequiredRoles : ['coordinator','setup'] }); }
  const staffMap = new Map<string, any>();
  for (const shift of shifts) { const key = shift.event_id || 'unassigned'; const group = eventMap.get(key) || { eventId: shift.event_id, eventTitle: shift.event_title || 'Unassigned', shifts: [], staffIds: new Set<string>(), requiredRoles: [] }; group.shifts.push(shift); group.staffIds.add(shift.staff_id); eventMap.set(key, group); const staff = staffMap.get(shift.staff_id) || { staffId: shift.staff_id, staffName: shift.staff_name || 'Unassigned staff', shiftCount: 0, eventIds: new Set<string>(), conflictCount: 0 }; staff.shiftCount += 1; if (shift.event_id) staff.eventIds.add(shift.event_id); if (conflicts.includes(shift.id)) staff.conflictCount += 1; staffMap.set(shift.staff_id, staff); }
  return { events: [...eventMap.values()].map((group) => ({ ...group, staffCount: group.staffIds.size, taskCount: taskMap.get(group.eventId || 'unassigned')?.task_count || 0, blockedTaskCount: taskMap.get(group.eventId || 'unassigned')?.blocked_count || 0, missingRoles: group.requiredRoles.filter((role: string) => !group.shifts.some((shift: any) => shift.role === role)), staffIds: undefined, requiredRoles: undefined })), staff: [...staffMap.values()].map((staff) => ({ ...staff, eventCount: staff.eventIds.size, eventIds: undefined })), conflicts: [...new Set(conflicts)], conflictDetails, totalShifts: shifts.length };
}

const coreSetupChecklist = [
  ['Confirm ceremony seating and processional path', 'coordinator'], ['Set reception tables, service, and dance floor', 'setup'], ['Verify exits, accessibility route, and power', 'setup'], ['Confirm vendor load-in and assigned zones', 'coordinator'], ['Complete final floor walk and handoff', 'coordinator'],
] as const;

function audit(req: any, orgId: string, action: string, targetType: string, targetId: string, details?: Record<string, unknown>) {
  auditRepo.log({
    organizationId: orgId, actorUserId: req.auth!.userId, actorLabel: req.auth!.email,
    action, targetType, targetId, ip: req.ip, details,
  });
}

export async function staffRoutes(app: FastifyInstance) {
  app.get('/api/events/:eventId/setup-checklist', { preHandler: requireAuth }, async (req) => {
    const { eventId } = req.params as { eventId: string };
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'staff.view', orgMap)) throw Forbidden();
    return { checklist: staffTasksRepo.listForOrg(orgMap[eventId], { eventId }).filter((task: any) => { try { return JSON.parse(task.tags || '[]').includes('event-week-setup'); } catch { return false; } }) };
  });
  app.post('/api/events/:eventId/setup-checklist/seed', { preHandler: requireAuth }, async (req, reply) => {
    const { eventId } = req.params as { eventId: string };
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'staff.manage', orgMap)) throw Forbidden();
    const orgId = orgMap[eventId];
    if (!orgId) throw NotFound();
    const existing = staffTasksRepo.listForOrg(orgId, { eventId }); const existingTitles = new Set(existing.map((task: any) => task.title));
    const created = coreSetupChecklist.filter(([title]) => !existingTitles.has(title)).map(([title, role]) => staffTasksRepo.create(orgId, req.auth!.userId, { eventId, title, phase: 'during-event', priority: 'high', tags: ['event-week-setup', role] }));
    for (const task of created) broadcastSSE(orgId, 'staff.task_created', { taskId: task.id, title: task.title, eventId }, req.auth!.userId);
    return reply.code(201).send({ created, checklist: staffTasksRepo.listForOrg(orgId, { eventId }).filter((task: any) => { try { return JSON.parse(task.tags || '[]').includes('event-week-setup'); } catch { return false; } }) });
  });

  app.get('/api/orgs/:orgId/staff/availability', { preHandler: requireAuth }, async (req) => {
    const { orgId } = req.params as { orgId: string };
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { organizationId: orgId }, 'staff.view', orgMap)) throw Forbidden();
    const { staffId } = req.query as { staffId?: string }; const isManager = can(req.auth!.memberships, { organizationId: orgId }, 'staff.manage', orgMap);
    if (staffId && staffId !== req.auth!.userId && !isManager) throw Forbidden();
    const params = staffId ? [orgId, staffId] : [orgId]; const where = staffId ? 'organization_id=? AND staff_id=?' : 'organization_id=?';
    return { availability: db.prepare(`SELECT * FROM staff_weekly_availability WHERE ${where} ORDER BY staff_id, day_of_week, starts_at`).all(...params) };
  });

  app.post('/api/orgs/:orgId/staff/availability', { preHandler: requireAuth }, async (req, reply) => {
    const { orgId } = req.params as { orgId: string };
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { organizationId: orgId }, 'staff.view', orgMap)) throw Forbidden();
    const parsed = availabilitySchema.safeParse(req.body); if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    if (parsed.data.staffId !== req.auth!.userId && !can(req.auth!.memberships, { organizationId: orgId }, 'staff.manage', orgMap)) throw Forbidden();
    const id = uuid();
    try {
      db.prepare(`INSERT INTO staff_weekly_availability (id, organization_id, staff_id, day_of_week, starts_at, ends_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(id, orgId, parsed.data.staffId, parsed.data.dayOfWeek, parsed.data.startsAt, parsed.data.endsAt, req.auth!.userId);
    } catch (err: any) {
      // MODULE-05 ST-11: the schema has a UNIQUE(org,staff,day,start,end) constraint — surface a clean 409, not a 500.
      if (String(err?.message ?? '').includes('UNIQUE')) throw BadRequest('availability-already-exists', { staffId: parsed.data.staffId, dayOfWeek: parsed.data.dayOfWeek, startsAt: parsed.data.startsAt, endsAt: parsed.data.endsAt });
      throw err;
    }
    audit(req, orgId, 'staff.availability.create', 'staff_availability', id, { staffId: parsed.data.staffId, dayOfWeek: parsed.data.dayOfWeek, startsAt: parsed.data.startsAt, endsAt: parsed.data.endsAt });
    broadcastSSE(orgId, 'staff.availability.created', { availabilityId: id, staffId: parsed.data.staffId }, req.auth!.userId);
    return reply.code(201).send({ availability: db.prepare(`SELECT * FROM staff_weekly_availability WHERE id=?`).get(id) });
  });

  app.delete('/api/staff/availability/:id', { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string }; const slot = db.prepare(`SELECT * FROM staff_weekly_availability WHERE id=?`).get(id) as any; if (!slot) throw NotFound();
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (slot.staff_id !== req.auth!.userId && !can(req.auth!.memberships, { organizationId: slot.organization_id }, 'staff.manage', orgMap)) throw Forbidden();
    db.prepare(`DELETE FROM staff_weekly_availability WHERE id=?`).run(id);
    audit(req, slot.organization_id, 'staff.availability.delete', 'staff_availability', id, { staffId: slot.staff_id });
    broadcastSSE(slot.organization_id, 'staff.availability.deleted', { availabilityId: id, staffId: slot.staff_id }, req.auth!.userId);
    return reply.code(204).send();
  });

  app.get('/api/events/:eventId/staffing-requirements', { preHandler: requireAuth }, async (req) => {
    const { eventId } = req.params as { eventId: string };
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'staff.view', orgMap)) throw Forbidden();
    const orgId = orgMap[eventId]; if (!orgId) throw NotFound();
    const event = eventsRepo.findById(eventId)!;
    const metadata = (() => { try { return JSON.parse(event.metadata || '{}'); } catch { return {}; } })(); return { requiredRoles: Array.isArray(metadata.staffingRequiredRoles) ? metadata.staffingRequiredRoles : ['coordinator', 'setup'] };
  });
  app.put('/api/events/:eventId/staffing-requirements', { preHandler: requireAuth }, async (req) => {
    const { eventId } = req.params as { eventId: string };
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'staff.manage', orgMap)) throw Forbidden();
    const orgId = orgMap[eventId]; if (!orgId) throw NotFound();
    const event = eventsRepo.findById(eventId)!;
    const parsed = z.object({ requiredRoles: z.array(z.enum(['coordinator','setup','cleaning','parking','other'])).min(1).max(5) }).safeParse(req.body); if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    const metadata = (() => { try { return JSON.parse(event.metadata || '{}'); } catch { return {}; } })(); const updated = eventsRepo.update(eventId, { metadata: { ...metadata, staffingRequiredRoles: parsed.data.requiredRoles } });
    audit(req, orgId, 'staff.staffing_requirements.update', 'event', eventId, { requiredRoles: parsed.data.requiredRoles });
    return { event: updated, requiredRoles: parsed.data.requiredRoles };
  });

  app.get('/api/orgs/:orgId/staff/calendar', { preHandler: requireAuth }, async (req) => {
    const { orgId } = req.params as { orgId: string };
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { organizationId: orgId }, 'staff.view', orgMap)) throw Forbidden();
    const { startsAt, endsAt } = req.query as { startsAt?: string; endsAt?: string }; const start = startsAt || new Date().toISOString(); const end = endsAt || new Date(Date.now() + 31 * 86400000).toISOString();
    if (Number.isNaN(Date.parse(start)) || Number.isNaN(Date.parse(end)) || start >= end) throw BadRequest('invalid-calendar-range');
    const shifts = db.prepare(`SELECT s.*, e.title AS event_title, u.full_name AS staff_name FROM staff_shifts s LEFT JOIN events e ON e.id=s.event_id LEFT JOIN users u ON u.id=s.staff_id WHERE s.organization_id=? AND s.starts_at < ? AND s.ends_at > ? ORDER BY s.starts_at`).all(orgId, end, start);
    const events = db.prepare(`SELECT id, title, start_date, end_date, status FROM events WHERE organization_id=? AND deleted_at IS NULL AND start_date <= ? AND COALESCE(end_date, start_date) >= ? ORDER BY start_date`).all(orgId, end.slice(0, 10), start.slice(0, 10));
    return { calendar: { startsAt: start, endsAt: end, events, shifts } };
  });

  app.get('/api/orgs/:orgId/staff/coverage', { preHandler: requireAuth }, async (req) => {
    const { orgId } = req.params as { orgId: string };
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { organizationId: orgId }, 'staff.view', orgMap)) throw Forbidden();
    return { coverage: staffingCoverage(orgId) };
  });

  // ─── Tasks ─────────────────────────────────────────────
  app.get('/api/orgs/:orgId/staff/tasks', { preHandler: requireAuth }, async (req) => {
    const { orgId } = req.params as { orgId: string };
    const { eventId, status } = req.query as { eventId?: string; status?: string };
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { organizationId: orgId }, 'staff.view', orgMap)) throw Forbidden();
    const isManager = can(req.auth!.memberships, { organizationId: orgId }, 'staff.manage', orgMap);
    const assignedTo = isManager ? undefined : req.auth!.userId;
    return { tasks: staffTasksRepo.listForOrg(orgId, { eventId, status: status as never, assignedTo }) };
  });

  app.post('/api/orgs/:orgId/staff/tasks', { preHandler: requireAuth }, async (req, reply) => {
    const { orgId } = req.params as { orgId: string };
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { organizationId: orgId }, 'staff.manage', orgMap)) throw Forbidden();
    const parsed = taskSchema.safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    assertEventInOrg(parsed.data.eventId, orgId);
    assertAreasInOrg(parsed.data.assignedAreas, orgId);
    const task = staffTasksRepo.create(orgId, req.auth!.userId, parsed.data);
    audit(req, orgId, 'staff.task.create', 'staff_task', task.id, { title: task.title, eventId: task.event_id });
    broadcastSSE(orgId, 'staff.task_created', { taskId: task.id, title: task.title, eventId: task.event_id }, req.auth!.userId);
    return reply.code(201).send({ task });
  });

  const SELF_SERVICE_FIELDS = new Set(['status', 'checklist', 'notes', 'priority']);

  app.patch('/api/staff/tasks/:id', { preHandler: requireAuth }, async (req) => {
    const { id } = req.params as { id: string };
    const task = staffTasksRepo.findById(id);
    if (!task) throw NotFound();
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    const isManager = can(req.auth!.memberships, { organizationId: task.organization_id }, 'staff.manage', orgMap);
    const parsed = taskSchema.partial().safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    if (!isManager) {
      // MODULE-05 ST-08: assignees/creators may self-service day-of fields only.
      const isAssignee = (() => { try { return (JSON.parse(task.assigned_staff) as string[]).includes(req.auth!.userId); } catch { return false; } })();
      if (!isAssignee && task.created_by !== req.auth!.userId) throw Forbidden();
      const requested = new Set(Object.keys(parsed.data));
      for (const key of requested) if (!SELF_SERVICE_FIELDS.has(key)) throw Forbidden();
    }
    assertEventInOrg(parsed.data.eventId, task.organization_id);
    assertAreasInOrg(parsed.data.assignedAreas, task.organization_id);
    const updated = staffTasksRepo.update(id, parsed.data, req.auth!.userId);
    audit(req, task.organization_id, 'staff.task.update', 'staff_task', id, { fields: Object.keys(parsed.data), title: updated?.title ?? task.title });
    broadcastSSE(task.organization_id, 'staff.task_updated', { taskId: id, title: updated?.title || task.title, status: updated?.status || task.status, phase: updated?.phase || task.phase, eventId: task.event_id }, req.auth!.userId);
    return { task: updated };
  });

  app.delete('/api/staff/tasks/:id', { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const task = staffTasksRepo.findById(id);
    if (!task) throw NotFound();
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { organizationId: task.organization_id }, 'staff.manage', orgMap)) throw Forbidden();
    staffTasksRepo.delete(id);
    audit(req, task.organization_id, 'staff.task.delete', 'staff_task', id, { title: task.title });
    broadcastSSE(task.organization_id, 'staff.task_deleted', { taskId: id, title: task.title, eventId: task.event_id }, req.auth!.userId);
    return reply.code(204).send();
  });

  // ─── Areas ─────────────────────────────────────────────
  app.get('/api/orgs/:orgId/staff/areas', { preHandler: requireAuth }, async (req) => {
    const { orgId } = req.params as { orgId: string };
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { organizationId: orgId }, 'staff.view', orgMap)) throw Forbidden();
    return { areas: staffAreasRepo.listForOrg(orgId) };
  });

  app.post('/api/orgs/:orgId/staff/areas', { preHandler: requireAuth }, async (req, reply) => {
    const { orgId } = req.params as { orgId: string };
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { organizationId: orgId }, 'staff.manage', orgMap)) throw Forbidden();
    const parsed = areaSchema.safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    const area = staffAreasRepo.create(orgId, parsed.data);
    audit(req, orgId, 'staff.area.create', 'staff_area', area.id, { name: area.name });
    broadcastSSE(orgId, 'staff.area_created', { areaId: area.id, name: area.name }, req.auth!.userId);
    return reply.code(201).send({ area });
  });

  app.delete('/api/staff/areas/:id', { preHandler: requireAuth }, async (req, reply) => {
    const area = staffAreasRepo.findById((req.params as { id: string }).id);
    if (!area) throw NotFound();
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { organizationId: area.organization_id }, 'staff.manage', orgMap)) throw Forbidden();
    staffAreasRepo.delete(area.id);
    audit(req, area.organization_id, 'staff.area.delete', 'staff_area', area.id, { name: area.name });
    broadcastSSE(area.organization_id, 'staff.area_deleted', { areaId: area.id, name: area.name }, req.auth!.userId);
    return reply.code(204).send();
  });

  // ─── Shifts ────────────────────────────────────────────
  app.get('/api/orgs/:orgId/staff/shifts', { preHandler: requireAuth }, async (req) => {
    const { orgId } = req.params as { orgId: string };
    const { eventId } = req.query as { eventId?: string };
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { organizationId: orgId }, 'staff.view', orgMap)) throw Forbidden();
    return { shifts: staffShiftsRepo.listForOrg(orgId, { eventId }) };
  });

  app.post('/api/orgs/:orgId/staff/shifts', { preHandler: requireAuth }, async (req, reply) => {
    const { orgId } = req.params as { orgId: string };
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { organizationId: orgId }, 'staff.manage', orgMap)) throw Forbidden();
    const parsed = shiftSchema.safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    assertEventInOrg(parsed.data.eventId, orgId);
    assertStaffInOrg(parsed.data.staffId, orgId);
    if (parsed.data.areaId) { const area = staffAreasRepo.findById(parsed.data.areaId); if (!area || area.organization_id !== orgId) throw BadRequest('area-not-in-org', { areaId: parsed.data.areaId }); }
    checkAvailabilityWindow(orgId, parsed.data.staffId, parsed.data.startsAt, parsed.data.endsAt, parsed.data.availabilityOverrideReason);
    const conflict = findShiftConflict(orgId, parsed.data.staffId, parsed.data.startsAt, parsed.data.endsAt);
    if (conflict) throw BadRequest('staff-shift-conflict', { staffId: parsed.data.staffId, conflictingShiftId: conflict.id, conflictingEventId: conflict.event_id, conflictingEventTitle: conflict.event_title, conflictingStartsAt: conflict.starts_at, conflictingEndsAt: conflict.ends_at });
    const shift = staffShiftsRepo.create(orgId, parsed.data);
    if (parsed.data.availabilityOverrideReason?.trim()) auditRepo.log({ organizationId: orgId, actorUserId: req.auth!.userId, actorLabel: req.auth!.email, action: 'staff.shift.availability_override', targetType: 'staff_shift', targetId: shift.id, ip: req.ip, details: { staffId: parsed.data.staffId, startsAt: parsed.data.startsAt, endsAt: parsed.data.endsAt, reason: parsed.data.availabilityOverrideReason } });
    audit(req, orgId, 'staff.shift.create', 'staff_shift', shift.id, { staffId: parsed.data.staffId, role: shift.role, startsAt: shift.starts_at, endsAt: shift.ends_at, eventId: shift.event_id });
    broadcastSSE(orgId, 'staff.shift_created', { shiftId: shift.id, staffId: shift.staff_id, role: shift.role, eventId: shift.event_id }, req.auth!.userId);
    return reply.code(201).send({ shift });
  });

  app.delete('/api/staff/shifts/:id', { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const shift = staffShiftsRepo.findById(id);
    if (!shift) throw NotFound(); // MODULE-05 ST-12: 404 for missing shifts (was silent 204)
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { organizationId: shift.organization_id }, "staff.manage", orgMap)) throw Forbidden();
    staffShiftsRepo.delete(id);
    audit(req, shift.organization_id, 'staff.shift.delete', 'staff_shift', id, { staffId: shift.staff_id });
    broadcastSSE(shift.organization_id, 'staff.shift_deleted', { shiftId: id, staffId: shift.staff_id, eventId: shift.event_id }, req.auth!.userId);
    return reply.code(204).send();
  });

  app.patch('/api/staff/shifts/:id', { preHandler: requireAuth }, async (req) => {
    const { id } = req.params as { id: string };
    const shift = staffShiftsRepo.findById(id);
    if (!shift) throw NotFound();
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { organizationId: shift.organization_id }, 'staff.manage', orgMap)) throw Forbidden();
    const parsed = shiftSchemaBase.partial().safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    // MODULE-05 ST-03: PATCH must be able to reschedule (time/staff/role/event), not just contact info.
    const next = { ...shift, ...parsed.data } as any;
    const startsAt = parsed.data.startsAt ?? shift.starts_at;
    const endsAt = parsed.data.endsAt ?? shift.ends_at;
    const staffId = parsed.data.staffId ?? shift.staff_id;
    if (startsAt && endsAt && Date.parse(startsAt) >= Date.parse(endsAt)) throw BadRequest('shift-times-invalid');
    assertEventInOrg(parsed.data.eventId, shift.organization_id);
    assertStaffInOrg(staffId, shift.organization_id);
    if (parsed.data.areaId) { const area = staffAreasRepo.findById(parsed.data.areaId); if (!area || area.organization_id !== shift.organization_id) throw BadRequest('area-not-in-org', { areaId: parsed.data.areaId }); }
    if (parsed.data.startsAt || parsed.data.endsAt || parsed.data.staffId) {
      checkAvailabilityWindow(shift.organization_id, staffId, startsAt, endsAt, parsed.data.availabilityOverrideReason);
      const conflict = findShiftConflict(shift.organization_id, staffId, startsAt, endsAt, id);
      if (conflict) throw BadRequest('staff-shift-conflict', { staffId, conflictingShiftId: conflict.id, conflictingEventId: conflict.event_id, conflictingEventTitle: conflict.event_title, conflictingStartsAt: conflict.starts_at, conflictingEndsAt: conflict.ends_at });
    }
    const updated = staffShiftsRepo.update(id, next);
    if (parsed.data.availabilityOverrideReason?.trim()) audit(req, shift.organization_id, 'staff.shift.availability_override', 'staff_shift', id, { staffId, startsAt, endsAt, reason: parsed.data.availabilityOverrideReason });
    audit(req, shift.organization_id, 'staff.shift.update', 'staff_shift', id, { fields: Object.keys(parsed.data) });
    broadcastSSE(shift.organization_id, 'staff.shift_updated', { shiftId: id, staffId, role: updated?.role ?? shift.role, eventId: updated?.event_id ?? shift.event_id }, req.auth!.userId);
    return { shift: updated };
  });

  app.post('/api/staff/shifts/:id/clock-in', { preHandler: requireAuth }, async (req) => {
    const { id } = req.params as { id: string };
    const shift = staffShiftsRepo.findById(id);
    if (!shift) throw NotFound();
    const isOwner = shift.staff_id === req.auth!.userId;
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    const isManager = can(req.auth!.memberships, { organizationId: shift.organization_id }, 'staff.manage', orgMap);
    if (!isOwner && !isManager) throw Forbidden();
    if (shift.clocked_in_at && !shift.clocked_out_at) throw BadRequest('already-clocked-in'); // MODULE-05 ST-09
    const updated = staffShiftsRepo.clockIn(id);
    audit(req, shift.organization_id, 'staff.shift.clock_in', 'staff_shift', id, { staffId: shift.staff_id });
    broadcastSSE(shift.organization_id, 'staff.clock_in', { shiftId: id, staffId: shift.staff_id, role: shift.role, eventId: shift.event_id }, req.auth!.userId);
    return { shift: updated };
  });

  app.post('/api/staff/shifts/:id/clock-out', { preHandler: requireAuth }, async (req) => {
    const { id } = req.params as { id: string };
    const shift = staffShiftsRepo.findById(id);
    if (!shift) throw NotFound();
    const isOwner = shift.staff_id === req.auth!.userId;
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    const isManager = can(req.auth!.memberships, { organizationId: shift.organization_id }, 'staff.manage', orgMap);
    if (!isOwner && !isManager) throw Forbidden();
    if (!shift.clocked_in_at) throw BadRequest('not-clocked-in'); // MODULE-05 ST-09
    const updated = staffShiftsRepo.clockOut(id);
    audit(req, shift.organization_id, 'staff.shift.clock_out', 'staff_shift', id, { staffId: shift.staff_id });
    broadcastSSE(shift.organization_id, 'staff.clock_out', { shiftId: id, staffId: shift.staff_id, role: shift.role, eventId: shift.event_id }, req.auth!.userId);
    return { shift: updated };
  });
}
