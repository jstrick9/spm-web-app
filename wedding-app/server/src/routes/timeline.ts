import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { can } from '../lib/rbac.js';
import { timelineRepo, eventsRepo } from '../db/repos/index.js';
import { BadRequest, Forbidden, NotFound } from '../lib/errors.js';

const timelineSchema = z.object({
  title:        z.string().min(1).max(200),
  category:     z.string().max(40).optional(),
  startsAt:     z.string().min(1),
  endsAt:       z.string().optional(),
  durationMin:  z.number().int().positive().optional(),
  location:     z.string().max(200).optional(),
  notes:        z.string().max(4000).optional(),
  vendorId:     z.string().optional(),
  assignedTo:   z.string().optional(),
  metadata:     z.record(z.unknown()).optional(),
});

export async function timelineRoutes(app: FastifyInstance) {
  app.get('/api/events/:eventId/timeline', { preHandler: requireAuth }, async (req) => {
    const { eventId } = req.params as { eventId: string };
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'timeline.view', orgMap)) throw Forbidden();
    return { items: timelineRepo.listForEvent(eventId) };
  });

  app.post('/api/events/:eventId/timeline', { preHandler: requireAuth }, async (req, reply) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound();
    if (!can(req.auth!.memberships, { organizationId: event.organization_id }, 'timeline.manage')) throw Forbidden();
    const parsed = timelineSchema.safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    return reply.code(201).send({ item: timelineRepo.create(event.organization_id, eventId, parsed.data) });
  });

  app.patch('/api/timeline/:id', { preHandler: requireAuth }, async (req) => {
    const { id } = req.params as { id: string };
    const item = timelineRepo.findById(id);
    if (!item) throw NotFound();
    if (!can(req.auth!.memberships, { organizationId: item.organization_id }, 'timeline.manage')) throw Forbidden();
    const parsed = timelineSchema.partial().extend({ completed: z.boolean().optional() }).safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    return { item: timelineRepo.update(id, parsed.data) };
  });

  app.delete('/api/timeline/:id', { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const item = timelineRepo.findById(id);
    if (!item) throw NotFound();
    if (!can(req.auth!.memberships, { organizationId: item.organization_id }, 'timeline.manage')) throw Forbidden();
    timelineRepo.delete(id);
    return reply.code(204).send();
  });
}
