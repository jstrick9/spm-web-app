import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { can } from '../lib/rbac.js';
import { timelineRepo, timelineOpsRepo, eventsRepo, eventReadinessRepo } from '../db/repos/index.js';
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
  remindAt: z.string().min(1),
  channel: z.enum(['in_app', 'sms', 'email']).optional(),
  audience: audienceSchema.optional(),
  status: z.enum(['queued', 'sent', 'cancelled']).optional(),
  payload: z.record(z.unknown()).optional(),
});
const offlinePacketSchema = z.object({
  audience: audienceSchema,
  payload: z.record(z.unknown()),
});

function ensureTimelineOpsManage(params: { eventId: string }, memberships: any[]) {
  const event = eventsRepo.findById(params.eventId);
  if (!event) throw NotFound();
  if (!can(memberships, { organizationId: event.organization_id }, 'timeline.manage')) throw Forbidden();
  return event;
}

function assertTimelineItemBelongsToEvent(timelineItemId: string | null | undefined, eventId: string) {
  if (!timelineItemId) return;
  const item = timelineRepo.findById(timelineItemId);
  if (!item || item.event_id !== eventId) throw BadRequest('invalid-timeline-item');
}

export async function timelineRoutes(app: FastifyInstance) {
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
    const event = ensureTimelineOpsManage(req.params as { eventId: string }, req.auth!.memberships);
    const parsed = approvalSchema.safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    const approval = timelineOpsRepo.upsertApproval(event.organization_id, event.id, { ...parsed.data, actorId: req.auth!.userId });
    timelineOpsRepo.addChangeLog(event.organization_id, event.id, {
      changeType: 'approval',
      summary: `${parsed.data.role} approval set to ${parsed.data.status}`,
      payload: parsed.data,
      createdBy: req.auth!.userId,
    });
    return reply.code(201).send({ approval });
  });

  app.post('/api/events/:eventId/timeline-ops/change-log', { preHandler: requireAuth }, async (req, reply) => {
    const event = ensureTimelineOpsManage(req.params as { eventId: string }, req.auth!.memberships);
    const parsed = changeLogSchema.safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    assertTimelineItemBelongsToEvent(parsed.data.timelineItemId, event.id);
    const changeLog = timelineOpsRepo.addChangeLog(event.organization_id, event.id, { ...parsed.data, createdBy: req.auth!.userId });
    return reply.code(201).send({ changeLog });
  });

  app.post('/api/events/:eventId/timeline-ops/incident', { preHandler: requireAuth }, async (req, reply) => {
    const event = ensureTimelineOpsManage(req.params as { eventId: string }, req.auth!.memberships);
    const parsed = incidentSchema.safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    assertTimelineItemBelongsToEvent(parsed.data.timelineItemId, event.id);
    const incident = timelineOpsRepo.addIncident(event.organization_id, event.id, { ...parsed.data, createdBy: req.auth!.userId });
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
    const event = ensureTimelineOpsManage(req.params as { eventId: string }, req.auth!.memberships);
    const parsed = reminderSchema.safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    assertTimelineItemBelongsToEvent(parsed.data.timelineItemId, event.id);
    const reminder = timelineOpsRepo.addReminder(event.organization_id, event.id, { ...parsed.data, createdBy: req.auth!.userId });
    return reply.code(201).send({ reminder });
  });

  app.post('/api/events/:eventId/timeline-ops/offline-packet', { preHandler: requireAuth }, async (req, reply) => {
    const event = ensureTimelineOpsManage(req.params as { eventId: string }, req.auth!.memberships);
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
