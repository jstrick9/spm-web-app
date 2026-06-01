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
    payload: { email: `exp-${Math.random().toString(36).slice(2)}@x.com`, password: 'testpass123', fullName: 'O', orgName: 'O' },
    headers: { 'content-type': 'application/json' } });
  const token = r.json().token, orgId = r.json().organizationId;
  // Create event + guest + vendor
  const e = await app.inject({ method: 'POST', url: '/api/events',
    payload: { organizationId: orgId, title: 'Export Test' },
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' } });
  const eventId = e.json().event.id;
  await app.inject({ method: 'POST', url: `/api/events/${eventId}/guests`,
    payload: { fullName: 'Alice', email: 'alice@test.com', rsvpStatus: 'attending' },
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' } });
  await app.inject({ method: 'POST', url: `/api/orgs/${orgId}/vendors`,
    payload: { name: 'DJ Test', category: 'music', contractAmountCents: 100000, eventId },
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' } });
  return { token, orgId, eventId };
}

const req = (token: string, url: string) =>
  app.inject({ method: 'GET', url, headers: { authorization: `Bearer ${token}` } });

describe('Data Exports', () => {
  it('exports guests as CSV', async () => {
    const s = await setup();
    const res = await req(s.token, `/api/orgs/${s.orgId}/export/guests.csv`);
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.body).toContain('Name');
    expect(res.body).toContain('Alice');
  });

  it('exports vendors as CSV', async () => {
    const s = await setup();
    const res = await req(s.token, `/api/orgs/${s.orgId}/export/vendors.csv`);
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.body).toContain('DJ Test');
  });

  it('exports financials as JSON', async () => {
    const s = await setup();
    const res = await req(s.token, `/api/orgs/${s.orgId}/export/financials.json`);
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('application/json');
    const data = JSON.parse(res.body);
    expect(data.exportedAt).toBeTruthy();
    expect(data.events).toHaveLength(1);
    expect(data.events[0].event.title).toBe('Export Test');
  });

  it('requires auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/orgs/fake/export/guests.csv' });
    expect(res.statusCode).toBe(401);
  });
});

describe('Org backup', () => {
  it('exports full org data as JSON backup', async () => {
    const s = await setup();
    const res = await req(s.token, `/api/orgs/${s.orgId}/export/backup.json`);
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('application/json');
    const data = JSON.parse(res.body);
    expect(data.exportedAt).toBeTruthy();
    expect(data.schemaVersion).toBeGreaterThanOrEqual(1);
    expect(data.events).toHaveLength(1);
    expect(data.guests).toHaveLength(1);
    expect(data.vendors).toHaveLength(1);
    expect(data.summary.eventCount).toBe(1);
    expect(data.summary.guestCount).toBe(1);
  });

  it('requires org.manage permission', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/orgs/fake/export/backup.json' });
    expect(res.statusCode).toBe(401);
  });
});
