import './../test/setup.js';
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { db } from '../db/database.js';
import { buildApp } from '../index.js';
import type { FastifyInstance } from 'fastify';
import { guestsRepo } from '../db/repos/index.js';

let app: FastifyInstance;
beforeAll(async () => { app = await buildApp(); await app.ready(); });

beforeEach(() => {
  for (const t of [
    'push_subscriptions', 'sse_events',
    'audit_logs','direct_messages','event_answers','event_questions',
    'staff_shifts','staff_areas','staff_tasks','timeline_events',
    'vendor_payments','vendors','decor_packages','decor_arrangements',
    'decor_categories','decor_items','guest_portal_configs','rsvp_submissions',
    'guest_sub_event_invitations','guests','layout_versions','layouts',
    'catalog_items','venues','sub_events','event_memberships','events',
    'organization_memberships','organizations','users',
  ]) {
    try { db.prepare(`DELETE FROM ${t}`).run(); } catch { /* table might not exist yet */ }
  }
  try {
    db.prepare(`DELETE FROM role_permissions WHERE role_id IN (SELECT id FROM roles WHERE is_system = 0)`).run();
    db.prepare(`DELETE FROM roles WHERE is_system = 0`).run();
  } catch { /* ok */ }
});

async function register(email = `push-${Math.random().toString(36).slice(2)}@x.com`) {
  const r = await app.inject({
    method: 'POST', url: '/api/auth/register',
    payload: { email, password: 'testpass123', fullName: 'Push Tester', orgName: 'TestOrg' },
    headers: { 'content-type': 'application/json' },
  });
  return { token: r.json().token, userId: r.json().user.id, orgId: r.json().organizationId, email };
}

const req = (token: string, method: 'GET'|'POST'|'PUT'|'PATCH'|'DELETE', url: string, payload?: unknown) =>
  app.inject({
    method, url,
    headers: payload !== undefined
      ? { authorization: `Bearer ${token}`, 'content-type': 'application/json' }
      : { authorization: `Bearer ${token}` },
    payload: payload as never,
  });

describe('Push subscription endpoints', () => {
  it('GET /api/push/vapid-key returns a public key (may be empty in dev)', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/push/vapid-key' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveProperty('publicKey');
  });

  it('POST /api/push/subscribe creates a subscription', async () => {
    const u = await register();
    const res = await req(u.token, 'POST', '/api/push/subscribe', {
      endpoint: 'https://fcm.googleapis.com/fcm/send/abc123',
      keys: { p256dh: 'test-p256dh-key', auth: 'test-auth-key' },
      organizationId: u.orgId,
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().subscription).toHaveProperty('id');
  });

  it('POST /api/push/subscribe with same endpoint upserts', async () => {
    const u = await register();
    const endpoint = 'https://fcm.googleapis.com/fcm/send/upsert-test';
    const payload = {
      endpoint,
      keys: { p256dh: 'key1', auth: 'auth1' },
      organizationId: u.orgId,
    };

    const r1 = await req(u.token, 'POST', '/api/push/subscribe', payload);
    const r2 = await req(u.token, 'POST', '/api/push/subscribe', {
      ...payload,
      keys: { p256dh: 'key2', auth: 'auth2' },
    });

    expect(r1.statusCode).toBe(201);
    expect(r2.statusCode).toBe(201);
    // Should be the same subscription (upserted)
    expect(r2.json().subscription.id).toBe(r1.json().subscription.id);
  });

  it('POST /api/push/subscribe rejects subscribing to an org you are not a member of', async () => {
    const owner = await register();
    const outsider = await register();
    const res = await req(outsider.token, 'POST', '/api/push/subscribe', {
      endpoint: 'https://fcm.googleapis.com/fcm/send/cross-org-probe',
      keys: { p256dh: 'k', auth: 'a' },
      organizationId: owner.orgId,
    });
    // Cross-org subscription is a notification-spam / PII-leak vector: an
    // outsider must never be able to register a device against an org they
    // are not a member of.
    expect(res.statusCode).toBe(403);
  });

  it('GET /api/push/subscriptions lists user subscriptions', async () => {
    const u = await register();
    await req(u.token, 'POST', '/api/push/subscribe', {
      endpoint: 'https://push.example.com/sub1',
      keys: { p256dh: 'k1', auth: 'a1' },
      organizationId: u.orgId,
    });

    const res = await req(u.token, 'GET', '/api/push/subscriptions');
    expect(res.statusCode).toBe(200);
    expect(res.json().subscriptions).toHaveLength(1);
    expect(res.json().subscriptions[0]).toHaveProperty('endpoint', 'https://push.example.com/sub1');
  });

  it('DELETE /api/push/subscribe removes by endpoint', async () => {
    const u = await register();
    const endpoint = 'https://push.example.com/to-delete';
    await req(u.token, 'POST', '/api/push/subscribe', {
      endpoint,
      keys: { p256dh: 'k', auth: 'a' },
      organizationId: u.orgId,
    });

    const del = await req(u.token, 'DELETE', '/api/push/subscribe', { endpoint });
    expect(del.statusCode).toBe(200);
    expect(del.json().ok).toBe(true);

    const list = await req(u.token, 'GET', '/api/push/subscriptions');
    expect(list.json().subscriptions).toHaveLength(0);
  });

  it('POST /api/push/subscribe rejects invalid payload', async () => {
    const u = await register();
    const res = await req(u.token, 'POST', '/api/push/subscribe', {
      endpoint: 'not-a-url',
      keys: { p256dh: '', auth: '' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('requires auth', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/push/subscribe',
      payload: { endpoint: 'https://x.com/y', keys: { p256dh: 'k', auth: 'a' }, organizationId: 'org1' },
      headers: { 'content-type': 'application/json' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('GET /api/push/status reports configuration state (false without VAPID keys)', async () => {
    const u = await register();
    const res = await req(u.token, 'GET', '/api/push/status');
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveProperty('configured');
    expect(typeof res.json().configured).toBe('boolean');
  });
});

describe('Cross-org guest listing', () => {
  it('GET /api/orgs/:orgId/guests returns guests across events', async () => {
    const u = await register();
    // Create an event
    const evtRes = await req(u.token, 'POST', '/api/events', {
      organizationId: u.orgId, title: 'Test Wedding',
    });
    const eventId = evtRes.json().event.id;

    // Create two guests
    guestsRepo.create(u.orgId, eventId, { fullName: 'Guest One', email: 'one@test.com' });
    guestsRepo.create(u.orgId, eventId, { fullName: 'Guest Two', email: 'two@test.com', rsvpStatus: 'attending' });

    const res = await req(u.token, 'GET', `/api/orgs/${u.orgId}/guests`);
    expect(res.statusCode).toBe(200);
    expect(res.json().guests).toHaveLength(2);
    expect(res.json().total).toBe(2);
    expect(res.json().counts).toBeDefined();
    expect(res.json().counts.attending).toBe(1);
    expect(res.json().counts.pending).toBe(1);
  });

  it('supports search filter', async () => {
    const u = await register();
    const evtRes = await req(u.token, 'POST', '/api/events', {
      organizationId: u.orgId, title: 'Search Test',
    });
    const eventId = evtRes.json().event.id;
    guestsRepo.create(u.orgId, eventId, { fullName: 'Alice Wonderland' });
    guestsRepo.create(u.orgId, eventId, { fullName: 'Bob Builder' });

    const res = await req(u.token, 'GET', `/api/orgs/${u.orgId}/guests?search=Alice`);
    expect(res.statusCode).toBe(200);
    expect(res.json().guests).toHaveLength(1);
    expect(res.json().guests[0].full_name).toBe('Alice Wonderland');
  });

  it('supports RSVP status filter', async () => {
    const u = await register();
    const evtRes = await req(u.token, 'POST', '/api/events', {
      organizationId: u.orgId, title: 'RSVP Test',
    });
    const eventId = evtRes.json().event.id;
    guestsRepo.create(u.orgId, eventId, { fullName: 'Pending Pat', rsvpStatus: 'pending' });
    guestsRepo.create(u.orgId, eventId, { fullName: 'Attending Ann', rsvpStatus: 'attending' });

    const res = await req(u.token, 'GET', `/api/orgs/${u.orgId}/guests?rsvpStatus=attending`);
    expect(res.statusCode).toBe(200);
    expect(res.json().guests).toHaveLength(1);
    expect(res.json().guests[0].full_name).toBe('Attending Ann');
  });

  it('includes event_title in guest rows', async () => {
    const u = await register();
    const evtRes = await req(u.token, 'POST', '/api/events', {
      organizationId: u.orgId, title: 'Garden Party',
    });
    const eventId = evtRes.json().event.id;
    guestsRepo.create(u.orgId, eventId, { fullName: 'Test Guest' });

    const res = await req(u.token, 'GET', `/api/orgs/${u.orgId}/guests`);
    expect(res.json().guests[0].event_title).toBe('Garden Party');
  });
});
