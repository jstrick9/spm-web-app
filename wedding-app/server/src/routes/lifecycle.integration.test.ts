/**
 * Full event lifecycle + security integration tests.
 */
import './../test/setup.js';
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { db } from '../db/database.js';
import { buildApp } from '../index.js';
import type { FastifyInstance } from 'fastify';
import { guestsRepo, rolesRepo } from '../db/repos/index.js';

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
    payload: { email: `lc-${Math.random().toString(36).slice(2)}@x.com`, password: 'testpass123', fullName: 'Tester', orgName: 'Venue' },
    headers: { 'content-type': 'application/json' } });
  return { token: r.json().token, orgId: r.json().organizationId, email: `lc-${Math.random().toString(36).slice(2)}@x.com` };
}

const req = (token: string, method: 'GET'|'POST'|'PATCH'|'DELETE', url: string, payload?: unknown) =>
  app.inject({ method, url, headers: payload !== undefined
    ? { authorization: `Bearer ${token}`, 'content-type': 'application/json' }
    : { authorization: `Bearer ${token}` }, payload: payload as never });

describe('Full event pipeline lifecycle', () => {
  it('lead → hold → booked → planning → completed with full data', async () => {
    const s = await register();

    // 1. Create as lead
    const cr = await req(s.token, 'POST', '/api/events', {
      organizationId: s.orgId, title: 'Pipeline Test Wedding',
      startDate: '2026-09-15', guestCount: 100, budgetCents: 5000000,
    });
    expect(cr.statusCode).toBe(201);
    const eventId = cr.json().event.id;
    expect(cr.json().event.status).toBe('planning'); // default

    // 2. Move to lead → hold → booked
    await req(s.token, 'PATCH', `/api/events/${eventId}`, { status: 'lead' });
    let ev = (await req(s.token, 'GET', `/api/events/${eventId}`)).json().event;
    expect(ev.status).toBe('lead');

    await req(s.token, 'PATCH', `/api/events/${eventId}`, { status: 'hold' });
    ev = (await req(s.token, 'GET', `/api/events/${eventId}`)).json().event;
    expect(ev.status).toBe('hold');

    await req(s.token, 'PATCH', `/api/events/${eventId}`, { status: 'booked' });
    ev = (await req(s.token, 'GET', `/api/events/${eventId}`)).json().event;
    expect(ev.status).toBe('booked');

    // 3. Add guests
    guestsRepo.create(s.orgId, eventId, { fullName: 'Guest A', rsvpStatus: 'attending' });
    guestsRepo.create(s.orgId, eventId, { fullName: 'Guest B', rsvpStatus: 'pending' });
    const guestList = (await req(s.token, 'GET', `/api/events/${eventId}/guests`)).json();
    expect(guestList.guests).toHaveLength(2);
    expect(guestList.counts.attending).toBe(1);

    // 4. Add vendor
    await req(s.token, 'POST', `/api/orgs/${s.orgId}/vendors`, {
      name: 'DJ Test', category: 'music', contractAmountCents: 200000, eventId,
    });

    // 5. Add timeline
    await req(s.token, 'POST', `/api/events/${eventId}/timeline`, {
      title: 'Ceremony', startsAt: '2026-09-15T16:00:00Z', durationMin: 30,
    });

    // 6. Add budget item
    await req(s.token, 'POST', `/api/events/${eventId}/budget`, {
      category: 'Venue', title: 'Rental', plannedCents: 1000000,
    });

    // 7. Move to planning → completed
    await req(s.token, 'PATCH', `/api/events/${eventId}`, { status: 'planning' });
    await req(s.token, 'PATCH', `/api/events/${eventId}`, { status: 'completed' });
    ev = (await req(s.token, 'GET', `/api/events/${eventId}`)).json().event;
    expect(ev.status).toBe('completed');

    // 8. Verify all data persists
    const finalGuests = (await req(s.token, 'GET', `/api/events/${eventId}/guests`)).json();
    expect(finalGuests.guests).toHaveLength(2);

    const vendors = (await req(s.token, 'GET', `/api/orgs/${s.orgId}/vendors`)).json();
    expect(vendors.vendors.length).toBeGreaterThanOrEqual(1);

    const timeline = (await req(s.token, 'GET', `/api/events/${eventId}/timeline`)).json();
    expect(timeline.items).toHaveLength(1);

    const budget = (await req(s.token, 'GET', `/api/events/${eventId}/budget`)).json();
    expect(budget.items).toHaveLength(1);
  });
});

describe('Login security', () => {
  it('returns 401 for wrong password', async () => {
    const email = `sec-${Math.random().toString(36).slice(2)}@x.com`;
    await app.inject({ method: 'POST', url: '/api/auth/register',
      payload: { email, password: 'correct123', fullName: 'S', orgName: 'S' },
      headers: { 'content-type': 'application/json' } });

    const res = await app.inject({ method: 'POST', url: '/api/auth/login',
      payload: { email, password: 'wrong-password' },
      headers: { 'content-type': 'application/json' } });
    expect(res.statusCode).toBe(401);
  });

  it('returns 401 for non-existent email', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/auth/login',
      payload: { email: 'nobody@nowhere.com', password: 'anything123' },
      headers: { 'content-type': 'application/json' } });
    expect(res.statusCode).toBe(401);
  });

  it('rejects expired/invalid JWT', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/auth/me',
      headers: { authorization: 'Bearer invalid.jwt.token' } });
    expect(res.statusCode).toBe(401);
  });

  it('rejects requests without auth header', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/auth/me' });
    expect(res.statusCode).toBe(401);
  });
});

describe('Event duplicate', () => {
  it('creates a copy with (Copy) suffix as lead', async () => {
    const s = await register();
    const cr = await req(s.token, 'POST', '/api/events', {
      organizationId: s.orgId, title: 'Original Wedding',
      startDate: '2026-10-01', guestCount: 150, budgetCents: 7500000,
    });
    const eventId = cr.json().event.id;

    const dup = await req(s.token, 'POST', `/api/events/${eventId}/duplicate`);
    expect([200, 201]).toContain(dup.statusCode);
    expect(dup.json().event.title).toBe('Original Wedding (Copy)');
    expect(dup.json().event.status).toBe('lead');
    expect(dup.json().event.guest_count).toBe(150);
    expect(dup.json().event.budget_cents).toBe(7500000);
    expect(dup.json().event.id).not.toBe(eventId);
  });
});
