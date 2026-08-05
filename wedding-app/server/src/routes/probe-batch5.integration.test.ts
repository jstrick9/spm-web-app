/**
 * Probe batch #5 — payments, contracts, webhooks, lifecycle emails, magic links.
 * Asserts the server NEVER returns 5xx on adversarial input.
 */
import '../test/setup.js';
import { describe, it, expect, beforeAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../index.js';

let app: FastifyInstance;
let token = '';
let orgId = '';
let eventId = '';

beforeAll(async () => {
  app = await buildApp();
  await app.ready();
  const reg = await app.inject({
    method: 'POST', url: '/api/auth/register',
    payload: { email: `probe5-${Math.random().toString(36).slice(2)}@x.com`, password: 'testpass123', fullName: 'Probe', orgName: 'Probe5 Org' },
    headers: { 'content-type': 'application/json' },
  });
  token = reg.json().token;
  orgId = reg.json().organizationId;
  const evt = await app.inject({
    method: 'POST', url: '/api/events',
    payload: { organizationId: orgId, title: 'Probe5 Wedding' },
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
  });
  eventId = evt.json().event.id;
});

const AUTH = { authorization: `Bearer ${token}` };
const JSON_HDR = { ...AUTH, 'content-type': 'application/json' };
const post = (url: string, payload: unknown) => app.inject({ method: 'POST', url, payload: payload as never, headers: JSON_HDR });

describe('probe batch #5 — payments + contracts', () => {
  it('payment link CRUD with adversarial payloads — never 5xx', async () => {
    const payloads: unknown[] = [
      { label: 42 }, { label: 'x', amountCents: -1 }, { label: 'x', amountCents: 'many' },
      { label: 'x', dueDate: 'not-a-date' }, { label: 'x', dueDate: [] },
      { amountCents: 1.999999999 }, { label: '', amountCents: 0 }, {},
    ];
    for (const p of payloads) {
      const r = await post(`/api/events/${eventId}/payment-links`, p);
      expect(r.statusCode).toBeLessThan(500);
    }
  });

  it('contract create/send/sign with adversarial payloads — never 5xx', async () => {
    const create = await post(`/api/events/${eventId}/contracts`, { title: 'Contract X', amountCents: 1000 });
    expect(create.statusCode).toBeLessThan(500);
    const contractId = (create.json().contract ?? {}).id;
    if (contractId) {
      const bad = await post(`/api/contracts/${contractId}/send`, {});
      expect(bad.statusCode).toBeLessThan(500);
      const sign = await post(`/api/contracts/${contractId}/sign`, {});
      expect(sign.statusCode).toBeLessThan(500);
    }
    const weird = await post(`/api/events/${eventId}/contracts`, { title: 123, amountCents: 'free' });
    expect(weird.statusCode).toBeLessThan(500);
  });

  it('go-no-go + escalations with garbage — never 5xx', async () => {
    const r1 = await post(`/api/events/${eventId}/financial-legal/go-no-go-flags`, { reason: 42 });
    expect(r1.statusCode).toBeLessThan(500);
    const r2 = await post(`/api/events/${eventId}/financial-legal/escalations`, {});
    expect(r2.statusCode).toBeLessThan(500);
  });
});

describe('probe batch #5 — webhooks', () => {
  it('webhook CRUD + test + deliveries with garbage — never 5xx', async () => {
    const bad = await post(`/api/orgs/${orgId}/webhooks`, { url: 'not-a-url' });
    expect(bad.statusCode).toBeLessThan(500);
    const bad2 = await post(`/api/orgs/${orgId}/webhooks`, {});
    expect(bad2.statusCode).toBeLessThan(500);
    const weird = await post(`/api/orgs/${orgId}/webhooks`, { url: 'https://x.test/h', secret: 42, events: 'all' });
    expect(weird.statusCode).toBeLessThan(500);
    const created = await post(`/api/orgs/${orgId}/webhooks`, { url: 'https://example.test/hook', events: ['event.updated'] });
    const id = created.json().webhook?.id;
    if (id) {
      const testR = await post(`/api/webhooks/${id}/test`, {});
      expect(testR.statusCode).toBeLessThan(500);
      const deliveries = await app.inject({ method: 'GET', url: `/api/webhooks/${id}/deliveries?limit=abc`, headers: AUTH });
      expect(deliveries.statusCode).toBeLessThan(500);
    }
  });
});

describe('probe batch #5 — lifecycle emails + integrations', () => {
  it('lifecycle automation payloads with garbage — never 5xx', async () => {
    const r1 = await app.inject({ method: 'PUT', url: `/api/orgs/${orgId}/email-automations`, payload: {} as never, headers: JSON_HDR });
    expect(r1.statusCode).toBeLessThan(500);
    const r2 = await app.inject({ method: 'POST', url: `/api/events/${eventId}/lifecycle-emails/send`, payload: { triggerType: 'not-real' } as never, headers: JSON_HDR });
    expect(r2.statusCode).toBeLessThan(500);
    const r3 = await app.inject({ method: 'GET', url: `/api/events/${eventId}/lifecycle-emails?limit=x`, headers: AUTH });
    expect(r3.statusCode).toBeLessThan(500);
  });

  it('integration CRUD with garbage provider payloads — never 5xx', async () => {
    const r1 = await post(`/api/orgs/${orgId}/integrations`, { provider: 'nope' });
    expect(r1.statusCode).toBeLessThan(500);
    const r2 = await post(`/api/orgs/${orgId}/integrations`, {});
    expect(r2.statusCode).toBeLessThan(500);
    const r3 = await post(`/api/orgs/${orgId}/integrations`, { provider: 'email_smtp', config: 'not-json' });
    expect(r3.statusCode).toBeLessThan(500);
  });
});

describe('probe batch #5 — magic link + invitations', () => {
  it('magic-link + invite flows with garbage tokens — never 5xx', async () => {
    const r1 = await post('/api/auth/magic-link', { email: 'nobody@example.com' });
    expect(r1.statusCode).toBeLessThan(500);
    const r2 = await post('/api/auth/magic-link/verify', { token: '%00%0a' });
    expect(r2.statusCode).toBeLessThan(500);
    const r3 = await post('/api/auth/invitations/accept', { token: 42 });
    expect(r3.statusCode).toBeLessThan(500);
    const r4 = await app.inject({ method: 'GET', url: `/api/auth/invitations/${encodeURIComponent('x'.repeat(300))}`, headers: AUTH });
    expect(r4.statusCode).toBeLessThan(500);
  });

  it('couple invite flows with garbage emails — never 5xx', async () => {
    const r1 = await post(`/api/events/${eventId}/couple-invitations`, { email: 'not-an-email' });
    expect(r1.statusCode).toBeLessThan(500);
    const r2 = await post(`/api/events/${eventId}/couple-invitations`, {});
    expect(r2.statusCode).toBeLessThan(500);
    const r3 = await post(`/api/events/${eventId}/couple-invitations`, { email: 'a@b.c', roleKey: 'supreme-leader' });
    expect(r3.statusCode).toBeLessThan(500);
  });
});

describe('probe batch #5 — misc depth', () => {
  it('staff tasks, availability, setup checklist with garbage — never 5xx', async () => {
    const r1 = await post(`/api/orgs/${orgId}/staff/tasks`, { title: '', eventId: 'nope' });
    expect(r1.statusCode).toBeLessThan(500);
    const r2 = await post(`/api/orgs/${orgId}/staff/availability`, { staffId: 'x', startsAt: 'junk', endsAt: 'junk' });
    expect(r2.statusCode).toBeLessThan(500);
    const r3 = await post(`/api/events/${eventId}/setup-checklist/seed`, {});
    expect(r3.statusCode).toBeLessThan(500);
  });

  it('duplicate event with garbage — never 5xx', async () => {
    const r = await post(`/api/events/${eventId}/duplicate`, {});
    expect(r.statusCode).toBeLessThan(500);
  });

  it('org members + roles with garbage — never 5xx', async () => {
    const r1 = await post(`/api/orgs/${orgId}/members`, { userEmail: 'x' });
    expect(r1.statusCode).toBeLessThan(500);
    const r2 = await post(`/api/orgs/${orgId}/roles`, { name: '' });
    expect(r2.statusCode).toBeLessThan(500);
  });

  it('public NPS + feedback with garbage — never 5xx', async () => {
    const r1 = await post(`/api/public/events/${eventId}/nps`, {});
    expect(r1.statusCode).toBeLessThan(500);
    const r2 = await post(`/api/events/${eventId}/feedback`, { score: 'ten' });
    expect(r2.statusCode).toBeLessThan(500);
  });

  it('gallery + inventory + budget garbage — never 5xx', async () => {
    const r1 = await post(`/api/events/${eventId}/gallery`, {});
    expect(r1.statusCode).toBeLessThan(500);
    const r2 = await post(`/api/orgs/${orgId}/inventory`, { name: 'x', totalCount: -5 });
    expect(r2.statusCode).toBeLessThan(500);
    const r3 = await post(`/api/events/${eventId}/budget`, { category: 'x', amountCents: 'nan' });
    expect(r3.statusCode).toBeLessThan(500);
  });
});
