/**
 * Stripe payments provider.
 *
 * We talk to Stripe's REST API directly with `fetch` (no `stripe` npm SDK) to
 * keep the dependency footprint minimal and consistent with the rest of the
 * platform (the webhook dispatcher already uses fetch). This is enough for the
 * hosted-checkout flow, which is the recommended, PCI-light integration:
 *
 *   1. createCheckout → POST /v1/checkout/sessions → returns a hosted URL
 *      the couple/client is redirected to. We never touch card data.
 *   2. Stripe POSTs checkout.session.completed / async_payment_* to our
 *      webhook receiver, which reconciles the payment_links row.
 *
 * Config (non-secret): publishableKey? (display only)
 * Secrets: secretKey (sk_...), webhookSigningSecret (whsec_...)
 */
import { z } from 'zod';
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { IntegrationProvider, ProviderAction, IntegrationContext } from '../types.js';

const STRIPE_API = 'https://api.stripe.com/v1';

const configSchema = z.object({
  publishableKey: z.string().optional(),
  // Default currency for checkouts created by this org.
  currency: z.string().length(3).default('usd'),
});

const secretSchema = z.object({
  secretKey: z.string().min(1, 'Stripe secret key (sk_...) required'),
  webhookSigningSecret: z.string().optional(), // whsec_... — required for webhook verification
});

const createCheckoutInput = z.object({
  amountCents: z.number().int().min(50), // Stripe minimum is ~$0.50
  currency: z.string().length(3).optional(),
  description: z.string().max(500).optional(),
  successUrl: z.string().url(),
  cancelUrl: z.string().url(),
  // Our internal payment_links id — echoed back via webhook metadata so we
  // can reconcile without trusting client-supplied ids.
  referenceId: z.string().min(1),
  customerEmail: z.string().email().optional(),
});
type CreateCheckoutInput = z.infer<typeof createCheckoutInput>;

interface CreateCheckoutResult {
  checkoutUrl: string;
  externalId: string; // Stripe session id (cs_...)
}

/** Form-encode a nested object the way Stripe's API expects (a[b]=c). */
function formEncode(obj: Record<string, string | number | undefined>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined && v !== null) p.append(k, String(v));
  }
  return p.toString();
}

async function stripeFetch(secretKey: string, path: string, body?: string): Promise<any> {
  const res = await fetch(`${STRIPE_API}${path}`, {
    method: body !== undefined ? 'POST' : 'GET',
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = json?.error?.message ?? `Stripe API ${res.status}`;
    throw new Error(`stripe: ${msg}`);
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
    const currency = (input.currency ?? cfg.currency ?? 'usd').toLowerCase();

    const body = formEncode({
      mode: 'payment',
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      client_reference_id: input.referenceId,
      'metadata[referenceId]': input.referenceId,
      customer_email: input.customerEmail,
      'line_items[0][quantity]': 1,
      'line_items[0][price_data][currency]': currency,
      'line_items[0][price_data][unit_amount]': input.amountCents,
      'line_items[0][price_data][product_data][name]': input.description || 'Wedding payment',
    });

    const session = await stripeFetch(secrets.secretKey, '/checkout/sessions', body);
    if (!session.url) throw new Error('stripe: no checkout url returned');
    return { checkoutUrl: session.url, externalId: session.id };
  },
};

/**
 * Verify Stripe's webhook signature. Header format:
 *   Stripe-Signature: t=<ts>,v1=<hex hmac of `${t}.${rawBody}`>
 * HMAC key is the whsec_ signing secret. Constant-time compare; 5-min tolerance.
 */
export function verifyStripeSignature(rawBody: string, sigHeader: string, signingSecret: string): boolean {
  const parts = Object.fromEntries(
    sigHeader.split(',').map((kv) => kv.split('=').map((s) => s.trim()) as [string, string]),
  );
  const t = parts['t'];
  const v1 = parts['v1'];
  if (!t || !v1) return false;
  // 5-minute replay tolerance
  const age = Math.abs(Date.now() / 1000 - Number(t));
  if (!Number.isFinite(age) || age > 300) return false;
  const expected = createHmac('sha256', signingSecret).update(`${t}.${rawBody}`).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(v1);
  return a.length === b.length && timingSafeEqual(a, b);
}

export const stripeProvider: IntegrationProvider = {
  id: 'stripe',
  name: 'Stripe',
  category: 'payments',
  description:
    'Collect deposits and final payments via Stripe hosted Checkout. Clients pay by card; ' +
    'you never handle card data. Payments reconcile automatically via webhooks.',
  iconKey: 'credit-card',
  docsUrl: 'https://stripe.com/docs/payments/checkout',
  kind: 'api_key',
  capabilities: ['collect_payment', 'receive_webhook'],
  configSchema,
  secretSchema,
  actions: [createCheckout],

  async verify(ctx) {
    const secrets = secretSchema.parse(ctx.secrets);
    // A cheap authenticated call confirms the key works.
    await stripeFetch(secrets.secretKey, '/balance');
  },
};
