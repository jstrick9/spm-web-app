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
    'invite_tracking', 'vendor_checkins',
    'gallery_images', 'inventory_items', 'contracts',
    'budget_items', 'webhook_deliveries', 'webhooks',
    'push_subscriptions', 'sse_events',
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
    payload: { email: `ci-${Math.random().toString(36).slice(2)}@x.com`, password: 'testpass123', fullName: 'O', orgName: 'O' },
    headers: { 'content-type': 'application/json' } });
  const token = r.json().token, orgId = r.json().organizationId;
  const e = await app.inject({ method: 'POST', url: '/api/events',
    payload: { organizationId: orgId, title: 'W' },
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' } });
  const eventId = e.json().event.id;
  const v = await app.inject({ method: 'POST', url: `/api/orgs/${orgId}/vendors`,
    payload: { name: 'DJ Test', category: 'music', eventId },
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' } });
  const vendorId = v.json().vendor.id;
  const guestId = guestsRepo.create(orgId, eventId, { fullName: 'Test Guest' }).id;
  return { token, orgId, eventId, vendorId, guestId };
}

const req = (token: string, method: 'GET'|'POST'|'PATCH'|'DELETE', url: string, payload?: unknown) =>
  app.inject({ method, url, headers: payload !== undefined
    ? { authorization: `Bearer ${token}`, 'content-type': 'application/json' }
    : { authorization: `Bearer ${token}` }, payload: payload as never });

describe('Vendor Check-Ins', () => {
  it('GET returns empty initially', async () => {
    const s = await setup();
    const res = await req(s.token, 'GET', `/api/events/${s.eventId}/checkins`);
    expect(res.statusCode).toBe(200);
    expect(res.json().checkins).toHaveLength(0);
    expect(res.json().statusMap).toEqual({});
  });

  it('POST creates/updates check-in status', async () => {
    const s = await setup();
    const res = await req(s.token, 'POST', `/api/events/${s.eventId}/checkins`, {
      vendorId: s.vendorId, status: 'arrived',
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().checkin.status).toBe('arrived');
    expect(res.json().checkin.checked_in_at).toBeTruthy();

    // Update to setup
    const res2 = await req(s.token, 'POST', `/api/events/${s.eventId}/checkins`, {
      vendorId: s.vendorId, status: 'setup',
    });
    expect(res2.json().checkin.status).toBe('setup');

    // Verify in list
    const list = await req(s.token, 'GET', `/api/events/${s.eventId}/checkins`);
    expect(list.json().statusMap[s.vendorId]).toBe('setup');
  });

  it('requires vendors.checkin.manage', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/events/x/checkins',
      payload: { vendorId: 'v', status: 'arrived' },
      headers: { 'content-type': 'application/json' } });
    expect(res.statusCode).toBe(401);
  });
});

describe('Invite Tracking', () => {
  it('GET returns empty initially', async () => {
    const s = await setup();
    const res = await req(s.token, 'GET', `/api/events/${s.eventId}/invite-tracking`);
    expect(res.statusCode).toBe(200);
    expect(res.json().tracking).toHaveLength(0);
  });

  it('POST bulk send marks all guests as sent', async () => {
    const s = await setup();
    const res = await req(s.token, 'POST', `/api/events/${s.eventId}/invite-tracking/send`);
    expect(res.statusCode).toBe(200);
    expect(res.json().sent).toBe(1);

    const list = await req(s.token, 'GET', `/api/events/${s.eventId}/invite-tracking`);
    expect(list.json().statusMap[s.guestId]).toBe('sent');
    expect(list.json().counts.sent).toBe(1);
  });

  it('PATCH updates individual guest status', async () => {
    const s = await setup();
    await req(s.token, 'POST', `/api/events/${s.eventId}/invite-tracking/send`);

    const res = await req(s.token, 'PATCH', `/api/events/${s.eventId}/invite-tracking/${s.guestId}`, {
      status: 'opened',
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().tracking.status).toBe('opened');
    expect(res.json().tracking.opened_at).toBeTruthy();
  });

  it('requires invites.view', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/events/x/invite-tracking' });
    expect(res.statusCode).toBe(401);
  });
});
