import './../test/setup.js';
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { createHmac } from 'node:crypto';
import { db } from '../db/database.js';
import { buildApp } from '../index.js';
import type { FastifyInstance } from 'fastify';
import { rolesRepo, integrationsRepo, paymentLinksRepo } from '../db/repos/index.js';
import { sealSecret } from '../lib/secrets.js';
import { verifyStripeSignature } from '../integrations/providers/stripe.js';
import { verifySquareSignature } from '../integrations/providers/square.js';

let app: FastifyInstance;
beforeAll(async () => { app = await buildApp(); await app.ready(); });

beforeEach(() => {
  for (const t of [
    'payment_links', 'integration_events', 'integrations',
    'budget_items', 'audit_logs', 'sse_events',
    'guests', 'event_memberships', 'events',
    'organization_memberships', 'organizations', 'users',
  ]) { try { db.prepare(`DELETE FROM ${t}`).run(); } catch { /* ok */ } }
  try {
    db.prepare(`DELETE FROM role_permissions WHERE role_id IN (SELECT id FROM roles WHERE is_system = 0)`).run();
    db.prepare(`DELETE FROM roles WHERE is_system = 0`).run();
  } catch { /* ok */ }
  rolesRepo.ensureSystemRoles();
});

afterEach(() => { vi.restoreAllMocks(); });

const req = (token: string, method: 'GET'|'POST'|'PATCH'|'DELETE', url: string, payload?: unknown) =>
  app.inject({ method, url, headers: payload !== undefined
    ? { authorization: `Bearer ${token}`, 'content-type': 'application/json' }
    : { authorization: `Bearer ${token}` }, payload: payload as never });

async function setup() {
  const r = await app.inject({ method: 'POST', url: '/api/auth/register',
    payload: { email: `pay-${Math.random().toString(36).slice(2)}@x.com`, password: 'testpass123', fullName: 'O', orgName: 'PayOrg' },
    headers: { 'content-type': 'application/json' } });
  const token = r.json().token, orgId = r.json().organizationId;
  const evt = await req(token, 'POST', '/api/events', { organizationId: orgId, title: 'Pay Wedding' });
  return { token, orgId, eventId: evt.json().event.id as string };
}

function connectStripe(orgId: string, signingSecret = 'whsec_test') {
  return integrationsRepo.upsert({
    organizationId: orgId, provider: 'stripe', displayName: 'Stripe',
    config: { currency: 'usd' },
    secretPayload: sealSecret({ secretKey: 'sk_test_123', webhookSigningSecret: signingSecret }),
    status: 'connected',
  });
}

// ─── Unit: signature verifiers ──────────────────────────
describe('payment webhook signature verification', () => {
  it('verifyStripeSignature accepts a correctly-signed payload', () => {
    const body = '{"hello":"world"}';
    const t = Math.floor(Date.now() / 1000);
    const sig = createHmac('sha256', 'whsec_x').update(`${t}.${body}`).digest('hex');
    expect(verifyStripeSignature(body, `t=${t},v1=${sig}`, 'whsec_x')).toBe(true);
    expect(verifyStripeSignature(body, `t=${t},v1=deadbeef`, 'whsec_x')).toBe(false);
  });

  it('verifyStripeSignature rejects stale timestamps (replay)', () => {
    const body = '{}';
    const old = Math.floor(Date.now() / 1000) - 10_000;
    const sig = createHmac('sha256', 'whsec_x').update(`${old}.${body}`).digest('hex');
    expect(verifyStripeSignature(body, `t=${old},v1=${sig}`, 'whsec_x')).toBe(false);
  });

  it('verifySquareSignature accepts a correctly-signed payload', () => {
    const body = '{"type":"payment.updated"}';
    const url = 'https://app.test/api/payments/webhooks/square/int1';
    const sig = createHmac('sha256', 'sqkey').update(url + body).digest('base64');
    expect(verifySquareSignature(body, url, sig, 'sqkey')).toBe(true);
    expect(verifySquareSignature(body, url, 'wrong', 'sqkey')).toBe(false);
  });
});

// ─── Checkout creation ──────────────────────────────────
describe('POST /api/payments/:id/checkout', () => {
  it('creates a Stripe checkout and stores the url + external id', async () => {
    const s = await setup();
    connectStripe(s.orgId);
    const payment = (await req(s.token, 'POST', `/api/events/${s.eventId}/payments`, {
      provider: 'stripe', amountCents: 150000,
    })).json().payment;

    // Mock Stripe's checkout.sessions endpoint
    const fetchMock = vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ id: 'cs_test_abc', url: 'https://checkout.stripe.com/c/cs_test_abc' }), { status: 200 }),
    );

    const res = await req(s.token, 'POST', `/api/payments/${payment.id}/checkout`);
    expect(res.statusCode).toBe(200);
    expect(res.json().checkoutUrl).toContain('checkout.stripe.com');
    expect(fetchMock).toHaveBeenCalledWith('https://api.stripe.com/v1/checkout/sessions', expect.any(Object));

    const row = paymentLinksRepo.findById(payment.id)!;
    expect(row.external_id).toBe('cs_test_abc');
    expect(row.status).toBe('processing');
  });

  it('returns 400 when no payment integration is connected', async () => {
    const s = await setup();
    const payment = (await req(s.token, 'POST', `/api/events/${s.eventId}/payments`, {
      provider: 'stripe', amountCents: 5000,
    })).json().payment;
    const res = await req(s.token, 'POST', `/api/payments/${payment.id}/checkout`);
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('not-connected');
  });

  it('returns 400 for a manual (non-provider) payment link', async () => {
    const s = await setup();
    connectStripe(s.orgId);
    const payment = (await req(s.token, 'POST', `/api/events/${s.eventId}/payments`, {
      provider: 'manual', amountCents: 5000,
    })).json().payment;
    const res = await req(s.token, 'POST', `/api/payments/${payment.id}/checkout`);
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('provider-unsupported');
  });

  it('requires budget.manage', async () => {
    const s = await setup();
    connectStripe(s.orgId);
    const payment = (await req(s.token, 'POST', `/api/events/${s.eventId}/payments`, {
      provider: 'stripe', amountCents: 5000,
    })).json().payment;
    const res = await app.inject({ method: 'POST', url: `/api/payments/${payment.id}/checkout` }); // no auth
    expect(res.statusCode).toBe(401);
  });
});

// ─── Webhook reconciliation ─────────────────────────────
describe('Stripe webhook reconciliation', () => {
  async function seedProcessingPayment(orgId: string, eventId: string, token: string, externalId: string) {
    const payment = (await req(token, 'POST', `/api/events/${eventId}/payments`, {
      provider: 'stripe', amountCents: 200000,
    })).json().payment;
    paymentLinksRepo.attachCheckout(payment.id, externalId, 'https://checkout.stripe.com/x');
    return payment;
  }

  it('marks a payment completed on checkout.session.completed', async () => {
    const s = await setup();
    const integ = connectStripe(s.orgId, 'whsec_abc');
    const payment = await seedProcessingPayment(s.orgId, s.eventId, s.token, 'cs_done');

    const body = JSON.stringify({ type: 'checkout.session.completed', data: { object: { id: 'cs_done' } } });
    const t = Math.floor(Date.now() / 1000);
    const sig = createHmac('sha256', 'whsec_abc').update(`${t}.${body}`).digest('hex');

    const res = await app.inject({
      method: 'POST', url: `/api/payments/webhooks/stripe/${integ.id}`,
      headers: { 'content-type': 'application/json', 'stripe-signature': `t=${t},v1=${sig}` },
      payload: body,
    });
    expect(res.statusCode).toBe(200);
    const row = paymentLinksRepo.findById(payment.id)!;
    expect(row.status).toBe('completed');
    expect(row.paid_at).toBeTruthy();
  });

  it('rejects an unsigned / wrongly-signed webhook (401) and does not change status', async () => {
    const s = await setup();
    const integ = connectStripe(s.orgId, 'whsec_abc');
    const payment = await seedProcessingPayment(s.orgId, s.eventId, s.token, 'cs_x');

    const body = JSON.stringify({ type: 'checkout.session.completed', data: { object: { id: 'cs_x' } } });
    const res = await app.inject({
      method: 'POST', url: `/api/payments/webhooks/stripe/${integ.id}`,
      headers: { 'content-type': 'application/json', 'stripe-signature': 't=1,v1=bad' },
      payload: body,
    });
    expect(res.statusCode).toBe(401);
    expect(paymentLinksRepo.findById(payment.id)!.status).toBe('processing');
  });

  it('is idempotent: re-delivering completed keeps it completed', async () => {
    const s = await setup();
    const integ = connectStripe(s.orgId, 'whsec_abc');
    const payment = await seedProcessingPayment(s.orgId, s.eventId, s.token, 'cs_idem');

    const send = async () => {
      const body = JSON.stringify({ type: 'checkout.session.completed', data: { object: { id: 'cs_idem' } } });
      const t = Math.floor(Date.now() / 1000);
      const sig = createHmac('sha256', 'whsec_abc').update(`${t}.${body}`).digest('hex');
      return app.inject({ method: 'POST', url: `/api/payments/webhooks/stripe/${integ.id}`,
        headers: { 'content-type': 'application/json', 'stripe-signature': `t=${t},v1=${sig}` }, payload: body });
    };
    expect((await send()).statusCode).toBe(200);
    expect((await send()).statusCode).toBe(200);
    expect(paymentLinksRepo.findById(payment.id)!.status).toBe('completed');
  });

  it('404s for an unknown integration id', async () => {
    const res = await app.inject({ method: 'POST', url: `/api/payments/webhooks/stripe/nope`,
      headers: { 'content-type': 'application/json', 'stripe-signature': 't=1,v1=x' }, payload: '{}' });
    expect(res.statusCode).toBe(404);
  });
});
