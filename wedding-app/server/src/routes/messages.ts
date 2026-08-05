import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { can } from '../lib/rbac.js';
import { messagesRepo, eventsRepo, communicationsRepo, vendorsRepo, staffTasksRepo } from '../db/repos/index.js';
import { BadRequest, Forbidden, NotFound } from '../lib/errors.js';
import type { PermissionId } from '../lib/permissions.js';

/**
 * Chat thread ids are formatted `${eventId}:${category}` by the client
 * (see ChatSystem.tsx). We MUST scope the permission check to the thread's
 * event/org — checking with an empty scope ({}) only verifies the user has
 * the permission *somewhere*, which let any authenticated user in Org A read
 * or post to any event's chat in Org B (cross-org IDOR / data leak).
 *
 * This helper resolves the event from the thread, 404s if it doesn't exist,
 * and authorizes against that event's org. Returns the validated eventId.
 */
/**
 * Parse the event id from a thread id. Canonical shape is
 * `${eventId}:${category}` (e.g. `e1:couple-venue`, `e1:vendor-v123`).
 * The staff vendor chat historically used `vendor:${eventId}:${vendorId}` —
 * accept it for authorization but treat `${eventId}:vendor-${vendorId}` as
 * the canonical thread so staff and the vendor portal share one conversation.
 */
function parseThreadEventId(threadId: string): string | null {
  const parts = threadId.split(':');
  if (parts.length === 2 && parts[0]) return parts[0];
  if (parts.length === 3 && parts[0] === 'vendor' && parts[1]) return parts[1];
  return null;
}

/** The user's role key scoped to this event (event membership, else org membership). */
function roleKeyForEvent(req: FastifyRequest, eventId: string): string | null {
  const event = eventsRepo.findById(eventId);
  const m = req.auth!.memberships.find((x) => x.eventId === eventId)
    ?? (event ? req.auth!.memberships.find((x) => x.organizationId === event.organization_id) : undefined);
  return m ? String(m.roleKey) : null;
}

function authorizeThread(req: FastifyRequest, threadId: string, permission: PermissionId): string {
  const eventId = parseThreadEventId(threadId);
  if (!eventId) throw NotFound();
  const event = eventsRepo.findById(eventId);
  if (!event) throw NotFound();
  const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
  if (!can(req.auth!.memberships, { eventId }, permission, orgMap)) throw Forbidden();

  // Couple accounts are limited to their own event's couple threads
  // (`${eventId}:couple-*`). Reading/posting to vendor or ops threads
  // (venue↔vendor coordination, staff broadcasts) is outside their scope.
  const roleKey = roleKeyForEvent(req, eventId);
  const category = threadId.split(':')[1] ?? '';
  if (roleKey === 'couple' && !category.startsWith('couple-')) {
    throw Forbidden('couple-thread-scope');
  }
  return eventId;
}

/**
 * sender_role is DERIVED server-side from the user's membership on the
 * thread's event. The client-supplied value was spoofable (any string, e.g.
 * 'manager' or 'venue') and is ignored — messages are labeled with the
 * sender's real role, which also prevents impersonation in vendor threads.
 */
function derivedSenderRole(req: FastifyRequest, eventId: string): string {
  return roleKeyForEvent(req, eventId) ?? 'staff';
}

const broadcastSchema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(4000),
  channel: z.enum(['in_app', 'sms', 'email', 'all']).default('in_app'),
  audience: z.enum(['staff', 'vendors', 'guests', 'all']).default('all'),
  severity: z.enum(['fyi', 'action_needed', 'urgent', 'owner_escalation']).default('fyi'),
  approvalRequired: z.boolean().optional(),
  quietHoursOverride: z.boolean().optional(),
});

function recipientRows(eventId: string, orgId: string, audience: 'staff' | 'vendors' | 'guests' | 'all') {
  const recipients: Array<{ recipientType: string; recipientLabel: string; contact?: string | null }> = [];
  if (audience === 'staff' || audience === 'all') {
    const tasks = staffTasksRepo.listForOrg(orgId, { eventId }).filter(t => t.assignee_name || t.assignee_phone || t.assignee_email).slice(0, 20);
    for (const task of tasks) recipients.push({ recipientType: 'staff', recipientLabel: task.assignee_name || task.title, contact: task.assignee_phone || task.assignee_email });
    if (!tasks.length) recipients.push({ recipientType: 'staff', recipientLabel: 'Staff operations team' });
  }
  if (audience === 'vendors' || audience === 'all') {
    const vendors = vendorsRepo.listForOrg(orgId, { eventId }).slice(0, 30);
    for (const vendor of vendors) recipients.push({ recipientType: 'vendor', recipientLabel: vendor.name, contact: vendor.phone || vendor.email });
    if (!vendors.length) recipients.push({ recipientType: 'vendor', recipientLabel: 'Vendor partners' });
  }
  if (audience === 'guests' || audience === 'all') recipients.push({ recipientType: 'guests', recipientLabel: 'Guest communications list' });
  return recipients;
}

export async function messageRoutes(app: FastifyInstance) {
  app.get('/api/events/:eventId/communications', { preHandler: requireAuth }, async (req) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound();
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'messages.view', orgMap)) throw Forbidden();
    return { communications: communicationsRepo.listForEvent(eventId) };
  });

  app.post('/api/events/:eventId/communications/broadcast', { preHandler: requireAuth }, async (req, reply) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound();
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'messages.send', orgMap)) throw Forbidden();
    const parsed = broadcastSchema.safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    const recipients = recipientRows(eventId, event.organization_id, parsed.data.audience);
    const audit = communicationsRepo.createBroadcast({
      organizationId: event.organization_id,
      eventId,
      ...parsed.data,
      createdBy: req.auth!.userId,
      recipients,
    });
    messagesRepo.send({ threadId: `${eventId}:urgent`, senderId: req.auth!.userId, senderRole: 'manager', body: `[${parsed.data.severity.toUpperCase()}][${parsed.data.audience}/${parsed.data.channel}] ${parsed.data.title}\n${parsed.data.body}` });
    return reply.code(201).send({ broadcast: audit, recipients });
  });

  app.get('/api/messages/:threadId', { preHandler: requireAuth }, async (req) => {
    const { threadId } = req.params as { threadId: string };
    authorizeThread(req, threadId, 'messages.view');
    return {
      messages: messagesRepo.listForThread(threadId),
      unread:   messagesRepo.unreadCount(threadId, req.auth!.userId),
    };
  });

  app.post('/api/messages/:threadId', { preHandler: requireAuth }, async (req, reply) => {
    const { threadId } = req.params as { threadId: string };
    const eventId = authorizeThread(req, threadId, 'messages.send');
    const parsed = z.object({
      body: z.string().min(1).max(10000),
      senderRole: z.string().min(1).max(40),
    }).safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    return reply.code(201).send({
      message: messagesRepo.send({
        threadId,
        senderId: req.auth!.userId,
        senderRole: derivedSenderRole(req, eventId),
        body: parsed.data.body,
      }),
    });
  });

  app.post('/api/messages/:threadId/read', { preHandler: requireAuth }, async (req) => {
    const { threadId } = req.params as { threadId: string };
    authorizeThread(req, threadId, 'messages.view');
    messagesRepo.markRead(threadId, req.auth!.userId);
    return { ok: true };
  });
}
