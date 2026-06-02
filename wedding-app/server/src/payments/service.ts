/**
 * Payments service — bridges payment_links rows and the provider integrations.
 *
 *   createCheckout(paymentId)         → calls the org's Stripe/Square integration
 *                                       to create a hosted checkout, stores the
 *                                       external id + URL on the row.
 *   reconcile(provider, externalId,   → maps a provider webhook event to a
 *             status)                    payment_links status update (idempotent).
 *
 * Real card data never touches our server: clients pay on the provider's hosted
 * page; we only store the checkout URL + provider id and react to webhooks.
 */
import { paymentLinksRepo } from '../db/repos/paymentLinks.js';
import { eventsRepo, orgsRepo } from '../db/repos/index.js';
import { integrationsRepo } from '../db/repos/integrations.js';
import { runAction, requireConnected, IntegrationError } from '../integrations/runtime.js';

export type PaymentProvider = 'stripe' | 'square';

function appBaseUrl(): string {
  const raw = (process.env.BASE_URL ?? '').trim();
  // Provider checkouts require absolute success/cancel URLs. Fall back to a
  // valid absolute origin if BASE_URL is missing or not an absolute http(s) URL.
  if (/^https?:\/\/[^/]+/i.test(raw)) return raw.replace(/\/+$/, '');
  return 'http://localhost:3000';
}

/**
 * Create a real hosted checkout for a pending/manual payment link.
 * Returns the updated row (with payment_url) or throws an IntegrationError
 * the route can translate to a clean 4xx.
 */
export async function createCheckout(paymentId: string): Promise<{ checkoutUrl: string }> {
  const link = paymentLinksRepo.findById(paymentId);
  if (!link) throw new IntegrationError('payment-not-found', 'Payment link not found');
  if (link.status === 'completed' || link.status === 'refunded') {
    throw new IntegrationError('payment-finalized', `Payment is already ${link.status}`);
  }

  const provider = link.provider;
  if (provider !== 'stripe' && provider !== 'square') {
    throw new IntegrationError('provider-unsupported', `Provider "${provider}" cannot create a hosted checkout`);
  }

  // Must have a connected integration of this provider for the org.
  const integration = requireConnected(link.organization_id, provider);

  const base = appBaseUrl();
  const returnTo = link.event_id ? `${base}/#/events/${link.event_id}?tab=budget` : `${base}/`;

  const result = await runAction<{ checkoutUrl: string; externalId: string }>({
    integrationId: integration.id,
    actionId: 'createCheckout',
    relatedType: 'payment_link',
    relatedId: link.id,
    input: provider === 'stripe'
      ? {
          amountCents: link.amount_cents,
          description: `Payment for ${eventTitle(link.event_id)}`,
          referenceId: link.id,
          successUrl: `${returnTo}&paid=1`,
          cancelUrl: returnTo,
        }
      : {
          amountCents: link.amount_cents,
          description: `Payment for ${eventTitle(link.event_id)}`,
          referenceId: link.id,
          redirectUrl: `${returnTo}&paid=1`,
        },
  });

  paymentLinksRepo.attachCheckout(link.id, result.externalId, result.checkoutUrl);
  return { checkoutUrl: result.checkoutUrl };
}

function eventTitle(eventId: string | null): string {
  if (!eventId) return 'wedding services';
  const ev = eventsRepo.findById(eventId);
  return ev?.title ?? 'wedding services';
}

/**
 * Reconcile a provider webhook into a payment_links status change. Idempotent:
 * re-delivering the same "completed" event is a no-op. Returns true if a row
 * was found + updated.
 */
export function reconcile(input: {
  provider: PaymentProvider;
  externalId: string;
  status: 'completed' | 'failed' | 'refunded';
}): boolean {
  const link = paymentLinksRepo.findByExternalId(input.provider, input.externalId);
  if (!link) return false;

  // Don't downgrade a finalized payment (e.g. a late duplicate webhook).
  if (link.status === input.status) return true;
  if (link.status === 'refunded') return true;

  paymentLinksRepo.updateStatus(
    link.id,
    input.status,
    input.status === 'completed' ? new Date().toISOString() : undefined,
  );
  return true;
}

export { orgsRepo, integrationsRepo };
