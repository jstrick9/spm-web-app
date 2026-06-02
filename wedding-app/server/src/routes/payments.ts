/**
 * Payment capture routes.
 *
 *   POST /api/payments/:id/checkout                 (budget.manage) — create a
 *        real Stripe/Square hosted checkout for a payment link, return its URL.
 *   POST /api/payments/webhooks/stripe/:integrationId  (public, signed)
 *   POST /api/payments/webhooks/square/:integrationId  (public, signed)
 *
 * The webhook endpoints are public (called by the provider) but require a valid
 * provider signature, verified against the per-integration signing secret.
 * They reconcile the payment_links row to completed/failed/refunded.
 *
 * Webhook routes need the RAW request body for signature verification, so this
 * plugin registers a raw-text content-type parser scoped to itself.
 */
import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../middleware/auth.js';
import { can } from '../lib/rbac.js';
import { Forbidden, NotFound, BadRequest } from '../lib/errors.js';
import { paymentLinksRepo, auditRepo } from '../db/repos/index.js';
import { integrationsRepo } from '../db/repos/integrations.js';
import { openSecret } from '../lib/secrets.js';
import { parseJson } from '../lib/json.js';
import { createCheckout, reconcile } from '../payments/service.js';
import { IntegrationError } from '../integrations/runtime.js';
import { verifyStripeSignature } from '../integrations/providers/stripe.js';
import { verifySquareSignature } from '../integrations/providers/square.js';
import { broadcastSSE } from './sse.js';

export async function paymentRoutes(app: FastifyInstance) {
  // Capture the raw body (as a string) for THIS plugin's routes only, so we
  // can verify provider HMAC signatures over the exact bytes received.
  app.addContentTypeParser(
    'application/json',
    { parseAs: 'string' },
    (_req, body, done) => {
      try {
        const text = typeof body === 'string' ? body : body.toString('utf8');
        (_req as { rawBody?: string }).rawBody = text;
        done(null, text.length ? JSON.parse(text) : {});
      } catch (err) {
        done(err as Error, undefined);
      }
    },
  );

  // ── Create a real hosted checkout for a pending payment link ──
  app.post('/api/payments/:id/checkout', { preHandler: requireAuth }, async (req) => {
    const { id } = req.params as { id: string };
    const link = paymentLinksRepo.findById(id);
    if (!link) throw NotFound();
    if (!can(req.auth!.memberships, { organizationId: link.organization_id }, 'budget.manage')) throw Forbidden();

    try {
      const { checkoutUrl } = await createCheckout(id);
      auditRepo.log({
        organizationId: link.organization_id, actorUserId: req.auth!.userId, actorLabel: req.auth!.email,
        action: 'payment.checkout.create', targetType: 'payment_link', targetId: id,
        details: { provider: link.provider, amountCents: link.amount_cents }, ip: req.ip,
      });
      return { checkoutUrl, payment: paymentLinksRepo.findById(id) };
    } catch (err) {
      if (err instanceof IntegrationError) {
        // not-connected / provider-unsupported / payment-finalized → 400
        throw BadRequest(err.code, err.message);
      }
      throw err;
    }
  });

  // ── Stripe webhook ──
  app.post('/api/payments/webhooks/stripe/:integrationId', async (req, reply) => {
    const { integrationId } = req.params as { integrationId: string };
    const integration = integrationsRepo.findById(integrationId);
    if (!integration || integration.provider !== 'stripe') return reply.code(404).send({ error: 'not-found' });

    const secrets = integration.secret_payload ? openSecret<Record<string, string>>(integration.secret_payload) : {};
    const signingSecret = secrets.webhookSigningSecret;
    const rawBody = (req as { rawBody?: string }).rawBody ?? '';
    const sig = req.headers['stripe-signature'] as string | undefined;

    if (!signingSecret || !sig || !verifyStripeSignature(rawBody, sig, signingSecret)) {
      return reply.code(401).send({ error: 'invalid-signature' });
    }

    const evt = parseJson<any>(rawBody, {});
    const type = evt?.type as string | undefined;
    const obj = evt?.data?.object ?? {};
    // session id is the external id we stored at checkout creation.
    const externalId = obj.id as string | undefined;

    let status: 'completed' | 'failed' | 'refunded' | null = null;
    if (type === 'checkout.session.completed' || type === 'checkout.session.async_payment_succeeded') status = 'completed';
    else if (type === 'checkout.session.async_payment_failed' || type === 'checkout.session.expired') status = 'failed';
    else if (type === 'charge.refunded') status = 'refunded';

    handleReconcile(integration.organization_id, 'stripe', externalId, status, integrationId);
    return reply.code(200).send({ received: true });
  });

  // ── Square webhook ──
  app.post('/api/payments/webhooks/square/:integrationId', async (req, reply) => {
    const { integrationId } = req.params as { integrationId: string };
    const integration = integrationsRepo.findById(integrationId);
    if (!integration || integration.provider !== 'square') return reply.code(404).send({ error: 'not-found' });

    const secrets = integration.secret_payload ? openSecret<Record<string, string>>(integration.secret_payload) : {};
    const signatureKey = secrets.webhookSignatureKey;
    const rawBody = (req as { rawBody?: string }).rawBody ?? '';
    const sig = req.headers['x-square-hmacsha256-signature'] as string | undefined;
    const base = (process.env.BASE_URL ?? `${req.protocol}://${req.hostname}`).replace(/\/+$/, '');
    const notificationUrl = `${base}/api/payments/webhooks/square/${integrationId}`;

    if (!signatureKey || !sig || !verifySquareSignature(rawBody, notificationUrl, sig, signatureKey)) {
      return reply.code(401).send({ error: 'invalid-signature' });
    }

    const evt = parseJson<any>(rawBody, {});
    const type = evt?.type as string | undefined;
    const payment = evt?.data?.object?.payment ?? {};
    // We stored the Square payment_link id as external_id; Square's payment
    // webhook carries the originating order/link via `payment_link_id` when
    // created through Payment Links.
    const externalId = (payment.payment_link_id ?? payment.order_id ?? payment.id) as string | undefined;

    let status: 'completed' | 'failed' | 'refunded' | null = null;
    if (type === 'payment.updated') {
      const s = String(payment.status ?? '').toUpperCase();
      if (s === 'COMPLETED') status = 'completed';
      else if (s === 'FAILED' || s === 'CANCELED') status = 'failed';
    } else if (type === 'refund.updated' || type === 'refund.created') {
      status = 'refunded';
    }

    handleReconcile(integration.organization_id, 'square', externalId, status, integrationId);
    return reply.code(200).send({ received: true });
  });
}

/** Shared: reconcile + audit + SSE. Kept out of the handlers for clarity. */
function handleReconcile(
  orgId: string,
  provider: 'stripe' | 'square',
  externalId: string | undefined,
  status: 'completed' | 'failed' | 'refunded' | null,
  integrationId: string,
): void {
  if (!externalId || !status) return;
  const updated = reconcile({ provider, externalId, status });
  if (!updated) return;
  integrationsRepo.logEvent({
    integrationId, organizationId: orgId, direction: 'inbound',
    kind: `${provider}.payment.${status}`, status: 'ok', relatedType: 'payment_link', relatedId: externalId,
  });
  auditRepo.log({
    organizationId: orgId, action: `payment.${status}`,
    targetType: 'payment_link', details: { provider, externalId },
  });
  broadcastSSE(orgId, 'payment.updated', { provider, externalId, status });
}
