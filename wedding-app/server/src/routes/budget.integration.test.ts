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
    'budget_items', 'webhook_deliveries', 'webhooks',
    'push_subscriptions', 'sse_events',
    'audit_logs','direct_messages','event_answers','event_questions',
    'staff_shifts','staff_areas','staff_tasks','timeline_events',
    'vendor_payments','vendors','decor_packages','decor_arrangements',
    'decor_categories','decor_items','guest_portal_configs','rsvp_submissions',
    'guest_sub_event_invitations','guests','layout_versions','layouts',
    'catalog_items','venues','sub_events','event_memberships','events',
    'organization_memberships','organizations','users',
  ]) {
    try { db.prepare(`DELETE FROM ${t}`).run(); } catch { /* ok */ }
  }
  try {
    db.prepare(`DELETE FROM role_permissions WHERE role_id IN (SELECT id FROM roles WHERE is_system = 0)`).run();
    db.prepare(`DELETE FROM roles WHERE is_system = 0`).run();
  } catch { /* ok */ }
  rolesRepo.ensureSystemRoles();
});

async function setup() {
  const regRes = await app.inject({
    method: 'POST', url: '/api/auth/register',
    payload: { email: `bud-${Math.random().toString(36).slice(2)}@x.com`, password: 'testpass123', fullName: 'Owner', orgName: 'BudgetOrg' },
    headers: { 'content-type': 'application/json' },
  });
  const token = regRes.json().token;
  const orgId = regRes.json().organizationId;

  const evtRes = await app.inject({
    method: 'POST', url: '/api/events',
    payload: { organizationId: orgId, title: 'Budget Test Wedding' },
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
  });
  const eventId = evtRes.json().event.id;

  return { token, orgId, eventId };
}

const req = (token: string, method: 'GET'|'POST'|'PATCH'|'DELETE', url: string, payload?: unknown) =>
  app.inject({
    method, url,
    headers: payload !== undefined
      ? { authorization: `Bearer ${token}`, 'content-type': 'application/json' }
      : { authorization: `Bearer ${token}` },
    payload: payload as never,
  });

describe('Budget CRUD', () => {
  it('GET returns empty items initially', async () => {
    const s = await setup();
    const res = await req(s.token, 'GET', `/api/events/${s.eventId}/budget`);
    expect(res.statusCode).toBe(200);
    expect(res.json().items).toHaveLength(0);
    expect(res.json().totals).toEqual({ planned: 0, actual: 0, paid: 0 });
  });

  it('POST creates a budget item', async () => {
    const s = await setup();
    const res = await req(s.token, 'POST', `/api/events/${s.eventId}/budget`, {
      category: 'Catering',
      title: 'Dinner Service',
      plannedCents: 850000,
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().item.title).toBe('Dinner Service');
    expect(res.json().item.planned_cents).toBe(850000);
    expect(res.json().item.paid_cents).toBe(0);
  });

  it('GET returns items with correct totals after creation', async () => {
    const s = await setup();
    await req(s.token, 'POST', `/api/events/${s.eventId}/budget`, {
      category: 'Venue', title: 'Rental', plannedCents: 1000000, actualCents: 1000000, paidCents: 500000,
    });
    await req(s.token, 'POST', `/api/events/${s.eventId}/budget`, {
      category: 'Photo', title: 'Package A', plannedCents: 450000,
    });

    const res = await req(s.token, 'GET', `/api/events/${s.eventId}/budget`);
    expect(res.json().items).toHaveLength(2);
    expect(res.json().totals.planned).toBe(1450000);
    expect(res.json().totals.actual).toBe(1000000);
    expect(res.json().totals.paid).toBe(500000);
  });

  it('PATCH updates a budget item', async () => {
    const s = await setup();
    const createRes = await req(s.token, 'POST', `/api/events/${s.eventId}/budget`, {
      category: 'DJ', title: 'DJ Set', plannedCents: 200000,
    });
    const id = createRes.json().item.id;

    const patchRes = await req(s.token, 'PATCH', `/api/budget/${id}`, {
      actualCents: 250000,
      paidCents: 100000,
    });
    expect(patchRes.statusCode).toBe(200);
    expect(patchRes.json().item.actual_cents).toBe(250000);
    expect(patchRes.json().item.paid_cents).toBe(100000);
  });

  it('DELETE removes a budget item', async () => {
    const s = await setup();
    const createRes = await req(s.token, 'POST', `/api/events/${s.eventId}/budget`, {
      category: 'Florals', title: 'Centerpieces', plannedCents: 300000,
    });
    const id = createRes.json().item.id;

    const delRes = await req(s.token, 'DELETE', `/api/budget/${id}`);
    expect(delRes.statusCode).toBe(204);

    const listRes = await req(s.token, 'GET', `/api/events/${s.eventId}/budget`);
    expect(listRes.json().items).toHaveLength(0);
  });

  it('rejects invalid input', async () => {
    const s = await setup();
    const res = await req(s.token, 'POST', `/api/events/${s.eventId}/budget`, {
      category: '', // too short
      title: '',    // too short
      plannedCents: -100,
    });
    expect(res.statusCode).toBe(400);
  });

  it('requires budget.view permission for GET', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/events/fake/budget' });
    expect(res.statusCode).toBe(401);
  });
});
