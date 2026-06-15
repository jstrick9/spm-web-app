import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { can } from '../lib/rbac.js';
import {
  staffTasksRepo, staffAreasRepo, staffShiftsRepo,
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
});

export async function staffRoutes(app: FastifyInstance) {
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
    staffAreasRepo.delete((req.params as { id: string }).id);
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
    const shift = staffShiftsRepo.create(orgId, parsed.data);
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
