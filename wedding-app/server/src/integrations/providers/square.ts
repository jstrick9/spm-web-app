/**
 * Square payments provider.
 *
 * Talks to Square's REST API with `fetch` (no SDK). Uses the Payment Links /
 * Checkout API to generate a hosted payment page; the client pays there and
 * Square POSTs payment.updated to our webhook receiver for reconciliation.
 *
 * Config (non-secret): environment ('sandbox' | 'production'), locationId, currency
 * Secrets: accessToken, webhookSignatureKey (for webhook verification)
 */
import { z } from 'zod';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { uuid } from '../../lib/crypto.js';
import type { IntegrationProvider, ProviderAction, IntegrationContext } from '../types.js';

const SQUARE_VERSION = '2024-10-17';

function apiBase(env: string): string {
  return env === 'production'
    ? 'https://connect.squareup.com'
    : 'https://connect.squareupsandbox.com';
}

const configSchema = z.object({
  environment: z.enum(['sandbox', 'production']).default('sandbox'),
  locationId: z.string().min(1, 'Square location id required'),
  currency: z.string().length(3).default('USD'),
});

const secretSchema = z.object({
  accessToken: z.string().min(1, 'Square access token required'),
  webhookSignatureKey: z.string().optional(),
});

const createCheckoutInput = z.object({
  amountCents: z.number().int().min(1),
  currency: z.string().length(3).optional(),
  description: z.string().max(500).optional(),
  referenceId: z.string().min(1),
  redirectUrl: z.string().url().optional(),
});
type CreateCheckoutInput = z.infer<typeof createCheckoutInput>;

interface CreateCheckoutResult {
  checkoutUrl: string;
  externalId: string; // Square payment_link id
}

async function squareFetch(
  ctx: { token: string; env: string },
  path: string,
  method: 'GET' | 'POST',
  body?: unknown,
): Promise<any> {
  const res = await fetch(`${apiBase(ctx.env)}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${ctx.token}`,
      'Square-Version': SQUARE_VERSION,
      'Content-Type': 'application/json',
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = json?.errors?.[0]?.detail ?? `Square API ${res.status}`;
    throw new Error(`square: ${msg}`);
  }
  return json;
}

const createCheckout: ProviderAction<CreateCheckoutInput, CreateCheckoutResult> = {
  id: 'createCheckout',
  label: 'Create hosted checkout',
  inputSchema: createCheckoutInput,
  async run(ctx, input) {
    const cfg = configSchema.parse(ctx.config);
    const secrets = secretSchema.parse(ctx.secrets);
    const currency = (input.currency ?? cfg.currency ?? 'USD').toUpperCase();

    const json = await squareFetch(
      { token: secrets.accessToken, env: cfg.environment },
      '/v2/online-checkout/payment-links',
      'POST',
      {
        idempotency_key: uuid(),
        quick_pay: {
          name: input.description || 'Wedding payment',
          price_money: { amount: input.amountCents, currency },
          location_id: cfg.locationId,
        },
        // referenceId lets us reconcile the webhook back to our payment_links row.
        payment_note: input.referenceId,
        checkout_options: input.redirectUrl ? { redirect_url: input.redirectUrl } : undefined,
      },
    );
    const link = json.payment_link;
    if (!link?.url) throw new Error('square: no checkout url returned');
    return { checkoutUrl: link.url, externalId: link.id };
  },
};

/**
 * Verify Square's webhook signature. Square signs HMAC-SHA256 (base64) of
 * `${notificationUrl}${rawBody}` using the webhook signature key.
 * Header: 'x-square-hmacsha256-signature'.
 */
export function verifySquareSignature(
  rawBody: string,
  notificationUrl: string,
  signature: string,
  signatureKey: string,
): boolean {
  const expected = createHmac('sha256', signatureKey)
    .update(notificationUrl + rawBody)
    .digest('base64');
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

export const squareProvider: IntegrationProvider = {
  id: 'square',
  name: 'Square',
  category: 'payments',
  description:
    'Collect payments via Square hosted checkout (Payment Links). Clients pay by card; ' +
    'payments reconcile automatically via Square webhooks.',
  iconKey: 'credit-card',
  docsUrl: 'https://developer.squareup.com/docs/checkout-api',
  kind: 'api_key',
  capabilities: ['collect_payment', 'receive_webhook'],
  configSchema,
  secretSchema,
  actions: [createCheckout],

  async verify(ctx) {
    const cfg = configSchema.parse(ctx.config);
    const secrets = secretSchema.parse(ctx.secrets);
    // Listing locations is a cheap authenticated call that confirms the token.
    await squareFetch({ token: secrets.accessToken, env: cfg.environment }, '/v2/locations', 'GET');
  },
};
