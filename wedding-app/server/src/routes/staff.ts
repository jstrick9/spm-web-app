import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { can } from '../lib/rbac.js';
import {
  staffTasksRepo, staffAreasRepo, staffShiftsRepo,
} from '../db/repos/index.js';
import { BadRequest, Forbidden, NotFound } from '../lib/errors.js';

const taskSchema = z.object({
  title:            z.string().min(1).max(200),
  description:      z.string().max(4000).optional(),
  phase:            z.enum(['pre-event','during-event','post-event']).optional(),
  status:           z.enum(['not-started','in-progress','completed','blocked']).optional(),
  priority:         z.enum(['low','medium','high','critical']).optional(),
  dueAt:            z.string().optional(),
  estimatedMinutes: z.number().int().min(0).optional(),
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
});

export async function staffRoutes(app: FastifyInstance) {
  // ─── Tasks ─────────────────────────────────────────────
  app.get('/api/orgs/:orgId/staff/tasks', { preHandler: requireAuth }, async (req) => {
    const { orgId } = req.params as { orgId: string };
    const { eventId, status } = req.query as { eventId?: string; status?: string };
    if (!can(req.auth!.memberships, { organizationId: orgId }, 'staff.view')) throw Forbidden();
    return { tasks: staffTasksRepo.listForOrg(orgId, { eventId, status: status as never }) };
  });

  app.post('/api/orgs/:orgId/staff/tasks', { preHandler: requireAuth }, async (req, reply) => {
    const { orgId } = req.params as { orgId: string };
    if (!can(req.auth!.memberships, { organizationId: orgId }, 'staff.manage')) throw Forbidden();
    const parsed = taskSchema.safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    return reply.code(201).send({
      task: staffTasksRepo.create(orgId, req.auth!.userId, parsed.data),
    });
  });

  app.patch('/api/staff/tasks/:id', { preHandler: requireAuth }, async (req) => {
    const { id } = req.params as { id: string };
    const task = staffTasksRepo.findById(id);
    if (!task) throw NotFound();
    if (!can(req.auth!.memberships, { organizationId: task.organization_id }, 'staff.manage')) throw Forbidden();
    const parsed = taskSchema.partial().safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    return { task: staffTasksRepo.update(id, parsed.data) };
  });

  app.delete('/api/staff/tasks/:id', { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const task = staffTasksRepo.findById(id);
    if (!task) throw NotFound();
    if (!can(req.auth!.memberships, { organizationId: task.organization_id }, 'staff.manage')) throw Forbidden();
    staffTasksRepo.delete(id);
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
    return reply.code(201).send({ shift: staffShiftsRepo.create(orgId, parsed.data) });
  });

  app.delete('/api/staff/shifts/:id', { preHandler: requireAuth }, async (req, reply) => {
    staffShiftsRepo.delete((req.params as { id: string }).id);
    return reply.code(204).send();
  });
}
