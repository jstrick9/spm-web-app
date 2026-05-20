import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { messagesRepo } from '../db/repos/index.js';
import { BadRequest } from '../lib/errors.js';
export async function messageRoutes(app) {
    app.get('/api/messages/:threadId', { preHandler: requireAuth }, async (req) => {
        const { threadId } = req.params;
        // Messaging permission is org-wide; we don't bind threads to a specific
        // org for simplicity in Phase 1 (the thread id encodes the org+event).
        return {
            messages: messagesRepo.listForThread(threadId),
            unread: messagesRepo.unreadCount(threadId, req.auth.userId),
        };
    });
    app.post('/api/messages/:threadId', { preHandler: requireAuth }, async (req, reply) => {
        const { threadId } = req.params;
        const parsed = z.object({
            body: z.string().min(1).max(10000),
            senderRole: z.string().min(1).max(40),
        }).safeParse(req.body);
        if (!parsed.success)
            throw BadRequest('invalid-input', parsed.error.issues);
        return reply.code(201).send({
            message: messagesRepo.send({
                threadId,
                senderId: req.auth.userId,
                senderRole: parsed.data.senderRole,
                body: parsed.data.body,
            }),
        });
    });
    app.post('/api/messages/:threadId/read', { preHandler: requireAuth }, async (req) => {
        const { threadId } = req.params;
        messagesRepo.markRead(threadId, req.auth.userId);
        return { ok: true };
    });
}
//# sourceMappingURL=messages.js.map