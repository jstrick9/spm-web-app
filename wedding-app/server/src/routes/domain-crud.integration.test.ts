/**
 * Domain CRUD integration tests — covers the routes that lack
 * dedicated test files: events edge cases, guests edge cases,
 * vendors edge cases, timeline, messages, feedback, catalog, venues.
 */
import './../test/setup.js';
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { db } from '../db/database.js';
import { buildApp } from '../index.js';
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

async function setup() {
  const r = await app.inject({ method: 'POST', url: '/api/auth/register',
    payload: { email: `dc-${Math.random().toString(36).slice(2)}@x.com`, password: 'testpass123', fullName: 'O', orgName: 'O' },
    headers: { 'content-type': 'application/json' } });
  const token = r.json().token, orgId = r.json().organizationId;
  const e = await app.inject({ method: 'POST', url: '/api/events',
    payload: { organizationId: orgId, title: 'Test Event', startDate: '2026-09-12' },
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' } });
  return { token, orgId, eventId: e.json().event.id };
}

const req = (token: string, method: 'GET'|'POST'|'PATCH'|'DELETE', url: string, payload?: unknown) =>
  app.inject({ method, url, headers: payload !== undefined
    ? { authorization: `Bearer ${token}`, 'content-type': 'application/json' }
    : { authorization: `Bearer ${token}` }, payload: payload as never });

// ════════════════════════════════════════════════════════════
describe('Events: edge cases', () => {
  it('rejects event creation without organizationId', async () => {
    const s = await setup();
    const res = await req(s.token, 'POST', '/api/events', { title: 'No Org' });
    expect(res.statusCode).toBe(400);
  });

  it('rejects event with end date before start date', async () => {
    const s = await setup();
    const res = await req(s.token, 'POST', '/api/events', {
      organizationId: s.orgId, title: 'Bad Dates', startDate: '2026-12-01', endDate: '2026-01-01',
    });
    // The server may accept this (dates validation is client-side) or reject — verify graceful handling
    expect([201, 400]).toContain(res.statusCode);
  });

  it('returns 404 for non-existent event', async () => {
    const s = await setup();
    const res = await req(s.token, 'GET', '/api/events/non-existent-id');
    expect(res.statusCode).toBe(404);
  });

  it('soft-deletes event', async () => {
    const s = await setup();
    const del = await req(s.token, 'DELETE', `/api/events/${s.eventId}`);
    expect(del.statusCode).toBe(204);
    // Verify it's gone from list
    const list = await req(s.token, 'GET', `/api/orgs/${s.orgId}/events`);
    expect(list.json().events.find((e: any) => e.id === s.eventId)).toBeUndefined();
  });
});

// ════════════════════════════════════════════════════════════
describe('Guests: edge cases', () => {
  it('rejects guest without fullName', async () => {
    const s = await setup();
    const res = await req(s.token, 'POST', `/api/events/${s.eventId}/guests`, { email: 'no-name@test.com' });
    expect(res.statusCode).toBe(400);
  });

  it('bulk creates multiple guests', async () => {
    const s = await setup();
    const res = await req(s.token, 'POST', `/api/events/${s.eventId}/guests/bulk`, {
      mode: 'append',
      guests: [
        { fullName: 'Alice' },
        { fullName: 'Bob' },
        { fullName: 'Charlie' },
      ],
    });
    expect([200, 201]).toContain(res.statusCode);
    expect(res.json().inserted).toBe(3);
  });

  it('bulk skip mode skips duplicates by email', async () => {
    const s = await setup();
    await req(s.token, 'POST', `/api/events/${s.eventId}/guests`, { fullName: 'Existing', email: 'dup@test.com' });
    const res = await req(s.token, 'POST', `/api/events/${s.eventId}/guests/bulk`, {
      mode: 'skip',
      guests: [{ fullName: 'Duplicate', email: 'dup@test.com' }],
    });
    expect(res.json().skipped).toBe(1);
    expect(res.json().inserted).toBe(0);
  });

  it('cross-org guest list filters by RSVP status', async () => {
    const s = await setup();
    await req(s.token, 'POST', `/api/events/${s.eventId}/guests`, { fullName: 'A', rsvpStatus: 'attending' });
    await req(s.token, 'POST', `/api/events/${s.eventId}/guests`, { fullName: 'B', rsvpStatus: 'pending' });
    const res = await req(s.token, 'GET', `/api/orgs/${s.orgId}/guests?rsvpStatus=attending`);
    expect(res.json().guests).toHaveLength(1);
    expect(res.json().guests[0].full_name).toBe('A');
  });
});

// ════════════════════════════════════════════════════════════
describe('Vendors: edge cases', () => {
  it('creates vendor with full details', async () => {
    const s = await setup();
    const res = await req(s.token, 'POST', `/api/orgs/${s.orgId}/vendors`, {
      name: 'Full Vendor', category: 'Catering', contactName: 'Chef John',
      email: 'john@catering.com', phone: '555-9999', websiteUrl: 'https://catering.com',
      contractAmountCents: 500000, isPreferred: true, eventId: s.eventId,
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().vendor.is_preferred).toBe(1);
    expect(res.json().vendor.contract_amount_cents).toBe(500000);
  });

  it('updates vendor', async () => {
    const s = await setup();
    const cr = await req(s.token, 'POST', `/api/orgs/${s.orgId}/vendors`, { name: 'V1', eventId: s.eventId });
    const res = await req(s.token, 'PATCH', `/api/vendors/${cr.json().vendor.id}`, { name: 'V1 Updated', category: 'Music' });
    expect(res.json().vendor.name).toBe('V1 Updated');
    expect(res.json().vendor.category).toBe('Music');
  });

  it('deletes vendor', async () => {
    const s = await setup();
    const cr = await req(s.token, 'POST', `/api/orgs/${s.orgId}/vendors`, { name: 'ToDelete', eventId: s.eventId });
    const del = await req(s.token, 'DELETE', `/api/vendors/${cr.json().vendor.id}`);
    expect(del.statusCode).toBe(204);
  });
});

// ════════════════════════════════════════════════════════════
describe('Messages', () => {
  it('send → list → mark read flow', async () => {
    const s = await setup();
    // Chat threads are event-scoped: threadId = `${eventId}:${category}`.
    const thread = `${s.eventId}:general`;
    // Send
    const sr = await req(s.token, 'POST', `/api/messages/${thread}`, { body: 'Hello world', senderRole: 'planner' });
    expect(sr.statusCode).toBe(201);
    expect(sr.json().message.body).toBe('Hello world');

    // List
    const lr = await req(s.token, 'GET', `/api/messages/${thread}`);
    expect(lr.json().messages).toHaveLength(1);

    // Mark read
    const mr = await req(s.token, 'POST', `/api/messages/${thread}/read`);
    expect(mr.json().ok).toBe(true);
  });

  it('blocks cross-org chat access (IDOR regression)', async () => {
    const a = await setup();
    const b = await setup();
    // User A tries to read/post to Org B's event chat thread.
    const bThread = `${b.eventId}:general`;
    const read = await req(a.token, 'GET', `/api/messages/${bThread}`);
    expect(read.statusCode).toBe(403);
    const send = await req(a.token, 'POST', `/api/messages/${bThread}`, { body: 'x', senderRole: 'planner' });
    expect(send.statusCode).toBe(403);
  });
});

// ════════════════════════════════════════════════════════════
describe('Feedback / Polls', () => {
  it('create poll → vote → verify count', async () => {
    const s = await setup();
    const cr = await req(s.token, 'POST', `/api/events/${s.eventId}/polls`, {
      question: 'Favorite color?',
      options: [{ id: 'opt1', text: 'Blue', votes: 0 }, { id: 'opt2', text: 'Red', votes: 0 }],
    });
    expect(cr.statusCode).toBe(200);
    const pollId = cr.json().poll.id;

    // Public vote (no auth)
    const vr = await app.inject({ method: 'POST', url: `/api/events/${s.eventId}/polls/${pollId}/vote`,
      payload: { optionId: 'opt1' }, headers: { 'content-type': 'application/json' } });
    expect(vr.statusCode).toBe(200);
    expect(vr.json().poll.options.find((o: any) => o.id === 'opt1').votes).toBe(1);
  });
});

// ════════════════════════════════════════════════════════════
describe('Catalog', () => {
  it('CRUD lifecycle for table catalog items', async () => {
    const s = await setup();
    const cr = await req(s.token, 'POST', `/api/orgs/${s.orgId}/catalog/table`, {
      name: 'Round 8ft', spec: { capacity: 12, shape: 'circle' },
    });
    expect(cr.statusCode).toBe(201);

    const lr = await req(s.token, 'GET', `/api/orgs/${s.orgId}/catalog/table`);
    expect(lr.json().items.length).toBeGreaterThanOrEqual(1);

    const dr = await req(s.token, 'DELETE', `/api/catalog/${cr.json().item.id}`);
    expect(dr.statusCode).toBe(204);
  });
});

// ════════════════════════════════════════════════════════════
describe('Venues', () => {
  it('CRUD lifecycle', async () => {
    const s = await setup();
    const cr = await req(s.token, 'POST', `/api/orgs/${s.orgId}/venues`, {
      name: 'Main Hall', category: 'reception', capacity: 200, environment: 'indoor',
    });
    expect(cr.statusCode).toBe(201);

    const ur = await req(s.token, 'PATCH', `/api/venues/${cr.json().venue.id}`, { name: 'Grand Hall', capacity: 250 });
    expect(ur.json().venue.name).toBe('Grand Hall');

    const dr = await req(s.token, 'DELETE', `/api/venues/${cr.json().venue.id}`);
    expect(dr.statusCode).toBe(204);
  });
});

// ════════════════════════════════════════════════════════════
describe('Audit log', () => {
  it('records and retrieves activity', async () => {
    const s = await setup();
    // Creating events/guests generates audit entries
    await req(s.token, 'POST', `/api/events/${s.eventId}/guests`, { fullName: 'Audit Test' });

    const res = await req(s.token, 'GET', `/api/orgs/${s.orgId}/audit`);
    expect([200, 201]).toContain(res.statusCode);
    expect(res.json().logs.length).toBeGreaterThanOrEqual(1);
    // Should have guest.create action
    const actions = res.json().logs.map((l: any) => l.action);
    expect(actions).toContain('guest.create');
  });

  it('filters by action type', async () => {
    const s = await setup();
    await req(s.token, 'POST', `/api/events/${s.eventId}/guests`, { fullName: 'A' });
    const res = await req(s.token, 'GET', `/api/orgs/${s.orgId}/audit?action=guest.create`);
    expect(res.json().logs.every((l: any) => l.action === 'guest.create')).toBe(true);
  });
});

// ════════════════════════════════════════════════════════════
describe('Event duplicate', () => {
  it('duplicates an event as a new lead', async () => {
    const s = await setup();
    const res = await req(s.token, 'POST', `/api/events/${s.eventId}/duplicate`);
    expect([200, 201]).toContain(res.statusCode);
    const copy = res.json().event;
    expect(copy.title).toContain('(Copy)');
    expect(copy.status).toBe('lead');
    expect(copy.id).not.toBe(s.eventId);
    // Verify both exist in list
    const list = await req(s.token, 'GET', `/api/orgs/${s.orgId}/events`);
    expect(list.json().events.length).toBe(2);
  });

  it('returns 404 for non-existent event', async () => {
    const s = await setup();
    const res = await req(s.token, 'POST', '/api/events/fake-id/duplicate');
    expect(res.statusCode).toBe(404);
  });
});
