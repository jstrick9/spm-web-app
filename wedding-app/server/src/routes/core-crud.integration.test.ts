/**
 * Core CRUD integration tests — validates the critical data flows
 * that every demo and production deployment depends on.
 */
import './../test/setup.js';
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { db } from '../db/database.js';
import { buildApp } from '../index.js';
import { guestsRepo } from '../db/repos/index.js';
import type { FastifyInstance } from 'fastify';
import { rolesRepo } from '../db/repos/index.js';

let app: FastifyInstance;
beforeAll(async () => { app = await buildApp(); await app.ready(); });

beforeEach(() => {
  for (const t of [
    'invite_tracking','vendor_checkins','gallery_images','inventory_items','contracts',
    'budget_items','webhook_deliveries','webhooks','push_subscriptions','sse_events',
    'audit_logs','direct_messages','event_answers','event_questions',
    'staff_shifts','staff_areas','staff_tasks','timeline_events',
    'vendor_payments','vendors','decor_packages','decor_arrangements',
    'decor_categories','decor_items','guest_portal_configs','rsvp_submissions',
    'guest_sub_event_invitations','guests','layout_versions','layouts',
    'catalog_items','venues','sub_events','event_memberships','events',
    'organization_memberships','organizations','users',
  ]) { try { db.prepare(`DELETE FROM ${t}`).run(); } catch {} }
  try { db.prepare(`DELETE FROM role_permissions WHERE role_id IN (SELECT id FROM roles WHERE is_system = 0)`).run(); db.prepare(`DELETE FROM roles WHERE is_system = 0`).run(); } catch {}
  rolesRepo.ensureSystemRoles();
});

async function register() {
  const r = await app.inject({ method: 'POST', url: '/api/auth/register',
    payload: { email: `u-${Math.random().toString(36).slice(2)}@x.com`, password: 'testpass123', fullName: 'Tester', orgName: 'TestVenue' },
    headers: { 'content-type': 'application/json' } });
  return { token: r.json().token, userId: r.json().user.id, orgId: r.json().organizationId };
}

const req = (token: string, method: 'GET'|'POST'|'PATCH'|'DELETE', url: string, payload?: unknown) =>
  app.inject({ method, url, headers: payload !== undefined
    ? { authorization: `Bearer ${token}`, 'content-type': 'application/json' }
    : { authorization: `Bearer ${token}` }, payload: payload as never });

// ════════════════════════════════════════════════════════════
describe('Auth flow', () => {
  it('register → login → me returns same user', async () => {
    const email = `flow-${Math.random().toString(36).slice(2)}@x.com`;
    const regRes = await app.inject({ method: 'POST', url: '/api/auth/register',
      payload: { email, password: 'testpass123', fullName: 'Flow', orgName: 'FlowOrg' },
      headers: { 'content-type': 'application/json' } });
    expect(regRes.statusCode).toBe(201);
    const userId = regRes.json().user.id;

    const loginRes = await app.inject({ method: 'POST', url: '/api/auth/login',
      payload: { email, password: 'testpass123' },
      headers: { 'content-type': 'application/json' } });
    expect(loginRes.statusCode).toBe(200);

    const meRes = await app.inject({ method: 'GET', url: '/api/auth/me',
      headers: { authorization: `Bearer ${loginRes.json().token}` } });
    expect(meRes.statusCode).toBe(200);
    expect(meRes.json().user.id).toBe(userId);
    expect(meRes.json().memberships.length).toBeGreaterThanOrEqual(1);
  });

  it('wrong password returns 401', async () => {
    const email = `wrong-${Math.random().toString(36).slice(2)}@x.com`;
    await app.inject({ method: 'POST', url: '/api/auth/register',
      payload: { email, password: 'testpass123', fullName: 'W', orgName: 'W' },
      headers: { 'content-type': 'application/json' } });

    const res = await app.inject({ method: 'POST', url: '/api/auth/login',
      payload: { email, password: 'wrongpass' },
      headers: { 'content-type': 'application/json' } });
    expect(res.statusCode).toBe(401);
  });
});

// ════════════════════════════════════════════════════════════
describe('Event lifecycle', () => {
  it('create → get → update → list → delete', async () => {
    const s = await register();
    // Create
    const cr = await req(s.token, 'POST', '/api/events', {
      organizationId: s.orgId, title: 'Wedding', startDate: '2026-09-12', guestCount: 100, budgetCents: 5000000,
    });
    expect(cr.statusCode).toBe(201);
    const id = cr.json().event.id;

    // Get
    const gr = await req(s.token, 'GET', `/api/events/${id}`);
    expect(gr.json().event.title).toBe('Wedding');
    expect(gr.json().event.guest_count).toBe(100);

    // Update
    const ur = await req(s.token, 'PATCH', `/api/events/${id}`, { title: 'Updated Wedding', status: 'planning' });
    expect(ur.json().event.title).toBe('Updated Wedding');
    expect(ur.json().event.status).toBe('planning');

    // List
    const lr = await req(s.token, 'GET', `/api/orgs/${s.orgId}/events`);
    expect(lr.json().events.length).toBeGreaterThanOrEqual(1);

    // Delete
    const dr = await req(s.token, 'DELETE', `/api/events/${id}`);
    expect(dr.statusCode).toBe(204);
  });
});

// ════════════════════════════════════════════════════════════
describe('Guest lifecycle', () => {
  it('create → list → update RSVP → delete', async () => {
    const s = await register();
    const evt = await req(s.token, 'POST', '/api/events', { organizationId: s.orgId, title: 'GuestTest' });
    const eventId = evt.json().event.id;

    // Create
    const cr = await req(s.token, 'POST', `/api/events/${eventId}/guests`, {
      fullName: 'Test Guest', email: 'guest@test.com', rsvpStatus: 'pending',
    });
    expect(cr.statusCode).toBe(201);
    const guestId = cr.json().guest.id;

    // List
    const lr = await req(s.token, 'GET', `/api/events/${eventId}/guests`);
    expect(lr.json().guests).toHaveLength(1);
    expect(lr.json().counts.pending).toBe(1);

    // Update RSVP
    const ur = await req(s.token, 'PATCH', `/api/guests/${guestId}`, { rsvpStatus: 'attending' });
    expect(ur.json().guest.rsvp_status).toBe('attending');

    // Verify counts updated
    const lr2 = await req(s.token, 'GET', `/api/events/${eventId}/guests`);
    expect(lr2.json().counts.attending).toBe(1);
    expect(lr2.json().counts.pending).toBe(0);

    // Delete
    const dr = await req(s.token, 'DELETE', `/api/guests/${guestId}`);
    expect(dr.statusCode).toBe(204);
  });
});

// ════════════════════════════════════════════════════════════
describe('Vendor + payment lifecycle', () => {
  it('create vendor → add payment → list payments', async () => {
    const s = await register();
    const evt = await req(s.token, 'POST', '/api/events', { organizationId: s.orgId, title: 'VendorTest' });
    const eventId = evt.json().event.id;

    const vr = await req(s.token, 'POST', `/api/orgs/${s.orgId}/vendors`, {
      name: 'DJ Test', category: 'music', contractAmountCents: 200000, eventId,
    });
    expect(vr.statusCode).toBe(201);
    const vendorId = vr.json().vendor.id;

    // Add payment
    const pr = await req(s.token, 'POST', `/api/vendors/${vendorId}/payments`, {
      amountCents: 100000, paidAt: '2026-06-01', method: 'check',
    });
    expect(pr.statusCode).toBe(201);

    // List payments
    const lr = await req(s.token, 'GET', `/api/vendors/${vendorId}/payments`);
    expect(lr.json().payments).toHaveLength(1);
    expect(lr.json().payments[0].amount_cents).toBe(100000);
  });
});

// ════════════════════════════════════════════════════════════
describe('Timeline CRUD', () => {
  it('create → list → update → delete', async () => {
    const s = await register();
    const evt = await req(s.token, 'POST', '/api/events', { organizationId: s.orgId, title: 'TimeTest' });
    const eventId = evt.json().event.id;

    const cr = await req(s.token, 'POST', `/api/events/${eventId}/timeline`, {
      title: 'Ceremony', startsAt: '2026-09-12T16:00:00Z', durationMin: 30,
    });
    expect(cr.statusCode).toBe(201);
    const itemId = cr.json().item.id;

    const lr = await req(s.token, 'GET', `/api/events/${eventId}/timeline`);
    expect(lr.json().items).toHaveLength(1);

    const ur = await req(s.token, 'PATCH', `/api/timeline/${itemId}`, { title: 'Updated Ceremony' });
    expect(ur.json().item.title).toBe('Updated Ceremony');

    const dr = await req(s.token, 'DELETE', `/api/timeline/${itemId}`);
    expect(dr.statusCode).toBe(204);
  });
});

// ════════════════════════════════════════════════════════════
describe('Public portal flow', () => {
  it('portal info returns event + guest list', async () => {
    const s = await register();
    const evt = await req(s.token, 'POST', '/api/events', { organizationId: s.orgId, title: 'Portal Test' });
    const eventId = evt.json().event.id;

    await req(s.token, 'POST', `/api/events/${eventId}/guests`, { fullName: 'Portal Guest' });

    // Generic portal does not expose the full guest list by default.
    const generic = await app.inject({ method: 'GET', url: `/api/portal/${eventId}/info` });
    expect(generic.statusCode).toBe(200);
    expect(generic.json().event.title).toBe('Portal Test');
    expect(generic.json().identity.mode).toBe('lookup_required');
    expect(generic.json().guests).toHaveLength(0);
    const guest = db.prepare(`SELECT id FROM guests WHERE event_id = ? LIMIT 1`).get(eventId) as { id: string };
    const token = guestsRepo.rotatePortalToken(guest.id);
    const pr = await app.inject({ method: 'GET', url: `/api/portal/${eventId}/info?guest=${guest.id}&token=${token}` });
    expect(pr.statusCode).toBe(200);
    expect(pr.json().guests).toHaveLength(1);
    expect(pr.json().guests[0].fullName).toBe('Portal Guest');
  });

  it('RSVP submission works without auth', async () => {
    const s = await register();
    const evt = await req(s.token, 'POST', '/api/events', { organizationId: s.orgId, title: 'RSVP Test' });
    const eventId = evt.json().event.id;
    const gr = await req(s.token, 'POST', `/api/events/${eventId}/guests`, { fullName: 'RSVP Guest' });
    const guestId = gr.json().guest.id;

    const rr = await app.inject({ method: 'POST', url: `/api/portal/${eventId}/rsvp`,
      payload: { guestId, attending: true, mealChoice: 'vegetarian' },
      headers: { 'content-type': 'application/json' } });
    expect(rr.statusCode).toBe(201);
    expect(rr.json().ok).toBe(true);

    // Verify the guest status changed
    const updated = await req(s.token, 'GET', `/api/events/${eventId}/guests`);
    expect(updated.json().counts.attending).toBe(1);
  });
});

// ════════════════════════════════════════════════════════════
describe('Health check', () => {
  it('GET /api/health returns ok + schema version', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json().ok).toBe(true);
    expect(res.json().schemaVersion).toBeGreaterThanOrEqual(1);
    expect(res.json().ts).toBeTruthy();
  });
});
