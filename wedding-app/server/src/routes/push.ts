import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { can } from '../lib/rbac.js';
import { pushSubscriptionsRepo } from '../db/repos/index.js';
import { BadRequest, Forbidden } from '../lib/errors.js';

const subscriptionSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
  organizationId: z.string().min(1),
});

export async function pushRoutes(app: FastifyInstance) {
  // ─── Subscribe to push notifications ─────────────────
  app.post('/api/push/subscribe', { preHandler: requireAuth }, async (req, reply) => {
    const parsed = subscriptionSchema.safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);

    if (!can(req.auth!.memberships, { organizationId: parsed.data.organizationId }, 'notifications.manage')) {
      throw Forbidden();
    }

    const sub = pushSubscriptionsRepo.upsert({
      userId: req.auth!.userId,
      organizationId: parsed.data.organizationId,
      endpoint: parsed.data.endpoint,
      p256dh: parsed.data.keys.p256dh,
      auth: parsed.data.keys.auth,
      userAgent: req.headers['user-agent'] ?? undefined,
    });

    return reply.code(201).send({ subscription: { id: sub.id } });
  });

  // ─── Unsubscribe ──────────────────────────────────────
  app.delete('/api/push/subscribe', { preHandler: requireAuth }, async (req) => {
    const { endpoint } = req.body as { endpoint?: string };
    if (!endpoint) throw BadRequest('endpoint-required');
    // Users can always unsubscribe their own endpoints
    pushSubscriptionsRepo.deleteByEndpoint(endpoint);
    return { ok: true };
  });

  // ─── List my subscriptions ────────────────────────────
  app.get('/api/push/subscriptions', { preHandler: requireAuth }, async (req) => {
    // Users can always see their own subscriptions
    const subs = pushSubscriptionsRepo.listForUser(req.auth!.userId);
    return {
      subscriptions: subs.map(s => ({
        id: s.id,
        endpoint: s.endpoint,
        createdAt: s.created_at,
      })),
    };
  });

  // ─── VAPID public key (needed by the client to subscribe) ──
  // Intentionally public — the VAPID public key is not a secret.
  app.get('/api/push/vapid-key', async () => {
    const key = process.env.VAPID_PUBLIC_KEY ?? '';
    return { publicKey: key };
  });
}
