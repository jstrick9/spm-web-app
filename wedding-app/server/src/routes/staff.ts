import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../db/database.js';
import { uuid } from '../lib/crypto.js';
import { requireAuth } from '../middleware/auth.js';
import { can } from '../lib/rbac.js';
import {
  staffTasksRepo, staffAreasRepo, staffShiftsRepo, auditRepo,
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

const shiftSchema = z.object({
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

function staffingCoverage(orgId: string) {
  const shifts = db.prepare(`SELECT s.id, s.event_id, s.staff_id, s.role, s.starts_at, s.ends_at, e.title AS event_title, u.full_name AS staff_name FROM staff_shifts s LEFT JOIN events e ON e.id=s.event_id LEFT JOIN users u ON u.id=s.staff_id WHERE s.organization_id=? ORDER BY s.starts_at`).all(orgId) as any[];
  const conflicts = shifts.filter((shift, index) => shifts.some((other, otherIndex) => otherIndex > index && shift.staff_id === other.staff_id && shift.starts_at < other.ends_at && other.starts_at < shift.ends_at)).map((shift) => shift.id);
  const taskRows = db.prepare(`SELECT event_id, COUNT(*) AS task_count, SUM(CASE WHEN status='blocked' THEN 1 ELSE 0 END) AS blocked_count FROM staff_tasks WHERE organization_id=? GROUP BY event_id`).all(orgId) as Array<{ event_id: string | null; task_count: number; blocked_count: number }>;
  const taskMap = new Map(taskRows.map((task) => [task.event_id || 'unassigned', task]));
  const eventMap = new Map<string, any>(); const staffMap = new Map<string, any>();
  for (const shift of shifts) { const key = shift.event_id || 'unassigned'; const group = eventMap.get(key) || { eventId: shift.event_id, eventTitle: shift.event_title || 'Unassigned', shifts: [], staffIds: new Set<string>() }; group.shifts.push(shift); group.staffIds.add(shift.staff_id); eventMap.set(key, group); const staff = staffMap.get(shift.staff_id) || { staffId: shift.staff_id, staffName: shift.staff_name || 'Unassigned staff', shiftCount: 0, eventIds: new Set<string>(), conflictCount: 0 }; staff.shiftCount += 1; if (shift.event_id) staff.eventIds.add(shift.event_id); if (conflicts.includes(shift.id)) staff.conflictCount += 1; staffMap.set(shift.staff_id, staff); }
  return { events: [...eventMap.values()].map((group) => ({ ...group, staffCount: group.staffIds.size, taskCount: taskMap.get(group.eventId || 'unassigned')?.task_count || 0, blockedTaskCount: taskMap.get(group.eventId || 'unassigned')?.blocked_count || 0, staffIds: undefined })), staff: [...staffMap.values()].map((staff) => ({ ...staff, eventCount: staff.eventIds.size, eventIds: undefined })), conflicts, totalShifts: shifts.length };
}

export async function staffRoutes(app: FastifyInstance) {
  app.get('/api/orgs/:orgId/staff/availability', { preHandler: requireAuth }, async (req) => {
    const { orgId } = req.params as { orgId: string }; if (!can(req.auth!.memberships, { organizationId: orgId }, 'staff.view')) throw Forbidden();
    const { staffId } = req.query as { staffId?: string }; const isManager = can(req.auth!.memberships, { organizationId: orgId }, 'staff.manage');
    if (staffId && staffId !== req.auth!.userId && !isManager) throw Forbidden();
    const params = staffId ? [orgId, staffId] : [orgId]; const where = staffId ? 'organization_id=? AND staff_id=?' : 'organization_id=?';
    return { availability: db.prepare(`SELECT * FROM staff_weekly_availability WHERE ${where} ORDER BY staff_id, day_of_week, starts_at`).all(...params) };
  });

  app.post('/api/orgs/:orgId/staff/availability', { preHandler: requireAuth }, async (req, reply) => {
    const { orgId } = req.params as { orgId: string }; if (!can(req.auth!.memberships, { organizationId: orgId }, 'staff.view')) throw Forbidden();
    const parsed = availabilitySchema.safeParse(req.body); if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    if (parsed.data.staffId !== req.auth!.userId && !can(req.auth!.memberships, { organizationId: orgId }, 'staff.manage')) throw Forbidden();
    const id = uuid(); db.prepare(`INSERT INTO staff_weekly_availability (id, organization_id, staff_id, day_of_week, starts_at, ends_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(id, orgId, parsed.data.staffId, parsed.data.dayOfWeek, parsed.data.startsAt, parsed.data.endsAt, req.auth!.userId);
    return reply.code(201).send({ availability: db.prepare(`SELECT * FROM staff_weekly_availability WHERE id=?`).get(id) });
  });

  app.get('/api/orgs/:orgId/staff/coverage', { preHandler: requireAuth }, async (req) => {
    const { orgId } = req.params as { orgId: string };
    if (!can(req.auth!.memberships, { organizationId: orgId }, 'staff.view')) throw Forbidden();
    return { coverage: staffingCoverage(orgId) };
  });

  // ─── Tasks ─────────────────────────────────────────────
  app.get('/api/orgs/:orgId/staff/tasks', { preHandler: requireAuth }, async (req) => {
    const { orgId } = req.params as { orgId: string };
    const { eventId, status } = req.query as { eventId?: string; status?: string };
    if (!can(req.auth!.memberships, { organizationId: orgId }, 'staff.view')) throw Forbidden();
    const isManager = can(req.auth!.memberships, { organizationId: orgId }, 'staff.manage');
    const assignedTo = isManager ? undefined : req.auth!.userId;
    return { tasks: staffTasksRepo.listForOrg(orgId, { eventId, status: status as never, assignedTo }) };
  });

  app.post('/api/orgs/:orgId/staff/tasks', { preHandler: requireAuth }, async (req, reply) => {
    const { orgId } = req.params as { orgId: string };
    if (!can(req.auth!.memberships, { organizationId: orgId }, 'staff.manage')) throw Forbidden();
    const parsed = taskSchema.safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    const task = staffTasksRepo.create(orgId, req.auth!.userId, parsed.data);
    broadcastSSE(orgId, 'staff.task_created', { taskId: task.id, title: task.title }, req.auth!.userId);
    return reply.code(201).send({ task });
  });

  app.patch('/api/staff/tasks/:id', { preHandler: requireAuth }, async (req) => {
    const { id } = req.params as { id: string };
    const task = staffTasksRepo.findById(id);
    if (!task) throw NotFound();
    if (!can(req.auth!.memberships, { organizationId: task.organization_id }, 'staff.manage')) throw Forbidden();
    const parsed = taskSchema.partial().safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    const updated = staffTasksRepo.update(id, parsed.data);
    broadcastSSE(task.organization_id, 'staff.task_updated', { taskId: id, title: updated?.title || task.title, status: updated?.status || task.status, phase: updated?.phase || task.phase }, req.auth!.userId);
    return { task: updated };
  });

  app.delete('/api/staff/tasks/:id', { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const task = staffTasksRepo.findById(id);
    if (!task) throw NotFound();
    if (!can(req.auth!.memberships, { organizationId: task.organization_id }, 'staff.manage')) throw Forbidden();
    staffTasksRepo.delete(id);
    broadcastSSE(task.organization_id, 'staff.task_deleted', { taskId: id, title: task.title }, req.auth!.userId);
    return reply.code(204).send();
  });

  // ─── Areas ─────────────────────────────────────────────
  app.get('/api/orgs/:orgId/staff/areas', { preHandler: requireAuth }, async (req) => {
    const { orgId } = req.params as { orgId: string };
    if (!can(req.auth!.memberships, { organizationId: orgId }, 'staff.view')) throw Forbidden();
    return { areas: staffAreasRepo.listForOrg(orgId) };
  });

  app.post('/api/orgs/:orgId/staff/areas', { preHandler: requireAuth }, async (req, reply) => {
    const { orgId } = req.params as { orgId: string };
    if (!can(req.auth!.memberships, { organizationId: orgId }, 'staff.manage')) throw Forbidden();
    const parsed = areaSchema.safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    return reply.code(201).send({ area: staffAreasRepo.create(orgId, parsed.data) });
  });

  app.delete('/api/staff/areas/:id', { preHandler: requireAuth }, async (req, reply) => {
    const area = staffAreasRepo.findById((req.params as { id: string }).id);
    if (!area) throw NotFound();
    if (!can(req.auth!.memberships, { organizationId: area.organization_id }, 'staff.manage')) throw Forbidden();
    staffAreasRepo.delete(area.id);
    return reply.code(204).send();
  });

  // ─── Shifts ────────────────────────────────────────────
  app.get('/api/orgs/:orgId/staff/shifts', { preHandler: requireAuth }, async (req) => {
    const { orgId } = req.params as { orgId: string };
    const { eventId } = req.query as { eventId?: string };
    if (!can(req.auth!.memberships, { organizationId: orgId }, 'staff.view')) throw Forbidden();
    return { shifts: staffShiftsRepo.listForOrg(orgId, { eventId }) };
  });

  app.post('/api/orgs/:orgId/staff/shifts', { preHandler: requireAuth }, async (req, reply) => {
    const { orgId } = req.params as { orgId: string };
    if (!can(req.auth!.memberships, { organizationId: orgId }, 'staff.manage')) throw Forbidden();
    const parsed = shiftSchema.safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    const start = new Date(parsed.data.startsAt); const end = new Date(parsed.data.endsAt); const day = start.getUTCDay(); const startTime = start.toISOString().slice(11, 16); const endTime = end.toISOString().slice(11, 16);
    const availability = db.prepare(`SELECT starts_at, ends_at FROM staff_weekly_availability WHERE organization_id=? AND staff_id=? AND day_of_week=?`).all(orgId, parsed.data.staffId, day) as Array<{ starts_at: string; ends_at: string }>;
    const withinAvailability = availability.some((slot) => startTime >= slot.starts_at && endTime <= slot.ends_at && start.toISOString().slice(0, 10) === end.toISOString().slice(0, 10));
    if (availability.length > 0 && !withinAvailability && !parsed.data.availabilityOverrideReason?.trim()) throw BadRequest('staff-availability-override-required', { staffId: parsed.data.staffId, dayOfWeek: day, startTime, endTime });
    const shift = staffShiftsRepo.create(orgId, parsed.data);
    if (parsed.data.availabilityOverrideReason?.trim()) auditRepo.log({ organizationId: orgId, actorUserId: req.auth!.userId, actorLabel: req.auth!.email, action: 'staff.shift.availability_override', targetType: 'staff_shift', targetId: shift.id, ip: req.ip, details: { staffId: parsed.data.staffId, startsAt: parsed.data.startsAt, endsAt: parsed.data.endsAt, reason: parsed.data.availabilityOverrideReason } });
    broadcastSSE(orgId, 'staff.shift_created', { shiftId: shift.id, staffId: shift.staff_id, role: shift.role }, req.auth!.userId);
    return reply.code(201).send({ shift });
  });

  app.delete('/api/staff/shifts/:id', { preHandler: requireAuth }, async (req, reply) => {
    const shift = staffShiftsRepo.findById((req.params as { id: string }).id);
    if (shift && !can(req.auth!.memberships, { organizationId: shift.organization_id }, "staff.manage")) throw Forbidden();
    staffShiftsRepo.delete((req.params as { id: string }).id);
    if (shift) {
      broadcastSSE(shift.organization_id, 'staff.shift_deleted', { shiftId: (req.params as { id: string }).id }, req.auth!.userId);
    }
    return reply.code(204).send();
  });

  app.patch('/api/staff/shifts/:id', { preHandler: requireAuth }, async (req) => {
    const { id } = req.params as { id: string };
    const shift = staffShiftsRepo.findById(id);
    if (!shift) throw NotFound();
    if (!can(req.auth!.memberships, { organizationId: shift.organization_id }, 'staff.manage')) throw Forbidden();
    const parsed = shiftSchema.partial().safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    const updated = staffShiftsRepo.update(id, parsed.data);
    broadcastSSE(shift.organization_id, 'staff.shift_updated', { shiftId: id, staffId: shift.staff_id, role: shift.role }, req.auth!.userId);
    return { shift: updated };
  });

  app.post('/api/staff/shifts/:id/clock-in', { preHandler: requireAuth }, async (req) => {
    const { id } = req.params as { id: string };
    const shift = staffShiftsRepo.findById(id);
    if (!shift) throw NotFound();
    const isOwner = shift.staff_id === req.auth!.userId;
    const isManager = can(req.auth!.memberships, { organizationId: shift.organization_id }, 'staff.manage');
    if (!isOwner && !isManager) throw Forbidden();
    const updated = staffShiftsRepo.clockIn(id);
    broadcastSSE(shift.organization_id, 'staff.clock_in', { shiftId: id, staffId: shift.staff_id, role: shift.role }, req.auth!.userId);
    return { shift: updated };
  });

  app.post('/api/staff/shifts/:id/clock-out', { preHandler: requireAuth }, async (req) => {
    const { id } = req.params as { id: string };
    const shift = staffShiftsRepo.findById(id);
    if (!shift) throw NotFound();
    const isOwner = shift.staff_id === req.auth!.userId;
    const isManager = can(req.auth!.memberships, { organizationId: shift.organization_id }, 'staff.manage');
    if (!isOwner && !isManager) throw Forbidden();
    const updated = staffShiftsRepo.clockOut(id);
    broadcastSSE(shift.organization_id, 'staff.clock_out', { shiftId: id, staffId: shift.staff_id, role: shift.role }, req.auth!.userId);
    return { shift: updated };
  });
}
