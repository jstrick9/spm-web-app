/**
 * Inbound webhook receiver — accepts POST payloads from external services.
 *
 * Each org can configure inbound webhook URLs that external services
 * (Calendly, Stripe, Zola, etc.) POST to. The receiver:
 *   1. Validates the signature (if a secret is configured)
 *   2. Logs the payload to the audit log
 *   3. Fires an SSE event so connected clients see the update
 *
 * This is the foundation for real integrations — specific providers
 * will be added as their OAuth flows are implemented.
 */
import type { FastifyInstance } from 'fastify';
import { createHmac } from 'node:crypto';
import { auditRepo } from '../db/repos/index.js';
import { webhooksRepo } from '../db/repos/webhooks.js';
import { requireAuth } from '../middleware/auth.js';
import { can } from '../lib/rbac.js';
import { Forbidden } from '../lib/errors.js';
import { broadcastSSE } from './sse.js';

export async function webhookReceiverRoutes(app: FastifyInstance) {
  // ─── Inbound webhook endpoint ─────────────────────────
  // Any external service can POST here. The webhook ID is in the URL.
  app.post('/api/webhooks/inbound/:webhookId', async (req, reply) => {
    const { webhookId } = req.params as { webhookId: string };

    // Find the webhook config
    const webhook = webhooksRepo.findById(webhookId);
    if (!webhook || !webhook.is_active) {
      return reply.code(404).send({ error: 'webhook-not-found' });
    }

    // Verify signature if a secret is configured
    if (webhook.secret) {
      const signature = req.headers['x-webhook-signature'] as string | undefined;
      const body = JSON.stringify(req.body);
      const expected = `sha256=${createHmac('sha256', webhook.secret).update(body).digest('hex')}`;

      if (!signature || signature !== expected) {
        return reply.code(401).send({ error: 'invalid-signature' });
      }
    }

    // Log the inbound payload
    const payload = (req.body ?? {}) as Record<string, unknown>;
    const eventType = (payload.type ?? payload.event ?? 'inbound.received') as string;

    auditRepo.log({
      organizationId: webhook.organization_id,
      action: `webhook.inbound.${eventType}`,
      targetType: 'webhook',
      targetId: webhookId,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      details: { source: 'inbound', eventType, payloadSize: JSON.stringify(payload).length },
    });

    // Record as a delivery
    webhooksRepo.recordDelivery({
      webhookId,
      eventType: `inbound.${eventType}`,
      payload,
      status: 200,
      durationMs: 0,
    });

    // Broadcast to connected clients
    broadcastSSE(webhook.organization_id, 'webhook.inbound', {
      webhookId,
      eventType,
      receivedAt: new Date().toISOString(),
    });

    return reply.code(200).send({ ok: true, received: true });
  });

  // ─── Generate inbound URL for a webhook ───────────────
  app.get('/api/webhooks/:id/inbound-url', { preHandler: requireAuth }, async (req) => {
    const { id } = req.params as { id: string };
    const webhook = webhooksRepo.findById(id);
    if (!webhook) return { url: null };
    if (!can(req.auth!.memberships, { organizationId: webhook.organization_id }, 'integrations.view')) {
      throw Forbidden();
    }

    const baseUrl = process.env.BASE_URL ?? `${req.protocol}://${req.hostname}`;
    return { url: `${baseUrl}/api/webhooks/inbound/${id}` };
  });
}
