import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { can } from '../lib/rbac.js';
import { messagesRepo, eventsRepo } from '../db/repos/index.js';
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
function authorizeThread(req: FastifyRequest, threadId: string, permission: PermissionId): string {
  const eventId = threadId.split(':')[0];
  if (!eventId) throw NotFound();
  const event = eventsRepo.findById(eventId);
  if (!event) throw NotFound();
  const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
  if (!can(req.auth!.memberships, { eventId }, permission, orgMap)) throw Forbidden();
  return eventId;
}

export async function messageRoutes(app: FastifyInstance) {
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
    authorizeThread(req, threadId, 'messages.send');
    const parsed = z.object({
      body: z.string().min(1).max(10000),
      senderRole: z.string().min(1).max(40),
    }).safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    return reply.code(201).send({
      message: messagesRepo.send({
        threadId,
        senderId: req.auth!.userId,
        senderRole: parsed.data.senderRole,
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
