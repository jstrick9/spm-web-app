import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { can } from '../lib/rbac.js';
import { messagesRepo } from '../db/repos/index.js';
import { BadRequest, Forbidden } from '../lib/errors.js';

export async function messageRoutes(app: FastifyInstance) {
  app.get('/api/messages/:threadId', { preHandler: requireAuth }, async (req) => {
    const { threadId } = req.params as { threadId: string };
    // Permission: messages.view — checked org-wide (no org id in thread,
    // so we check against all memberships).
    if (!can(req.auth!.memberships, {}, 'messages.view')) throw Forbidden();
    return {
      messages: messagesRepo.listForThread(threadId),
      unread:   messagesRepo.unreadCount(threadId, req.auth!.userId),
    };
  });

  app.post('/api/messages/:threadId', { preHandler: requireAuth }, async (req, reply) => {
    const { threadId } = req.params as { threadId: string };
    if (!can(req.auth!.memberships, {}, 'messages.send')) throw Forbidden();
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
    // Any authenticated user can mark messages as read (messages.view)
    if (!can(req.auth!.memberships, {}, 'messages.view')) throw Forbidden();
    messagesRepo.markRead(threadId, req.auth!.userId);
    return { ok: true };
  });
}
