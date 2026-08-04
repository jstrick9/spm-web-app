import './../test/setup.js';
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { buildApp } from '../index.js';
import { db } from '../db/database.js';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;

beforeAll(async () => {
  app = await buildApp();
  await app.ready();
});

beforeEach(() => {
  for (const t of ['layout_inventory_reservations', 'inventory_items', 'layouts', 'layout_versions', 'sse_events', 'audit_logs', 'venues', 'events', 'event_memberships', 'organization_memberships', 'organizations', 'users']) {
    try { db.prepare(`DELETE FROM ${t}`).run(); } catch { /* noop */ }
  }
});

async function register(prefix: string, orgName = 'Layouts Org') {
  const r = await app.inject({
    method: 'POST', url: '/api/auth/register',
    payload: { email: `${prefix}-${Math.random()}@test.com`, password: 'password123', fullName: 'Owner', orgName },
  });
  return { token: r.json().token, orgId: r.json().organizationId as string, email: r.json().user.email as string };
}

function authed(token: string, method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE', url: string, payload?: Record<string, unknown>) {
  return app.inject({
    method,
    url,
    headers: payload !== undefined
      ? { authorization: `Bearer ${token}`, 'content-type': 'application/json' }
      : { authorization: `Bearer ${token}` },
    payload,
  });
}

async function createEvent(token: string, orgId: string) {
  const r = await authed(token, 'POST', '/api/events', { organizationId: orgId, title: 'Test Wedding', status: 'booked' });
  expect(r.statusCode).toBe(201);
  return r.json().event as { id: string; organization_id: string };
}

async function addCoupleMember(token: string, orgId: string, eventId: string) {
  const u = await register('couple-user');
  const roles = await authed(token, 'GET', `/api/orgs/${orgId}/roles`);
  const coupleRole = (roles.json().roles as Array<{ id: string; key: string }>).find((r) => r.key === 'couple');
  expect(coupleRole).toBeTruthy();
  const add = await authed(token, 'POST', `/api/events/${eventId}/couple-invitations`, { email: u.email, roleId: coupleRole!.id });
  expect(add.statusCode).toBe(201);
  const login = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: u.email, password: 'password123' }, headers: { 'content-type': 'application/json' } });
  return login.json().token as string;
}

describe('Event-scoped layout access (VS-01)', () => {
  it('allows a couple to list, view versions, and read collaboration for their event layouts', async () => {
    const { token, orgId } = await register('vs01');
    const e = await createEvent(token, orgId);
    const coupleToken = await addCoupleMember(token, orgId, e.id);

    const layout = await authed(token, 'POST', '/api/layouts', { organizationId: orgId, eventId: e.id, name: 'Plan', payload: { items: [] } });
    expect(layout.statusCode).toBe(201);
    const lid = layout.json().layout.id as string;

    const list = await authed(coupleToken, 'GET', `/api/orgs/${orgId}/layouts?eventId=${e.id}`);
    expect(list.statusCode).toBe(200);
    expect(list.json().layouts.length).toBeGreaterThanOrEqual(1);

    const versions = await authed(coupleToken, 'GET', `/api/layouts/${lid}/versions`);
    expect(versions.statusCode).toBe(200);

    const collab = await authed(coupleToken, 'GET', `/api/layouts/${lid}/collaboration`);
    expect(collab.statusCode).toBe(200);
  });
});

describe('Layout delete releases inventory (VS-02)', () => {
  it('restores available_count for reserved items and audits the delete', async () => {
    const { token, orgId } = await register('vs02');
    const e = await createEvent(token, orgId);

    const inv = await authed(token, 'POST', `/api/orgs/${orgId}/inventory`, { name: 'Chiavari Chair', category: 'chair', totalCount: 100, availableCount: 90 });
    const itemId = inv.json().item.id as string;

    const layout = await authed(token, 'POST', '/api/layouts', { organizationId: orgId, eventId: e.id, name: 'Plan', payload: { items: [] } });
    const lid = layout.json().layout.id as string;

    const reserve = await authed(token, 'PUT', `/api/layouts/${lid}/inventory-reservations`, { reservations: [{ inventoryItemId: itemId, quantity: 10 }] });
    expect(reserve.statusCode).toBe(200);
    let item = db.prepare(`SELECT available_count FROM inventory_items WHERE id = ?`).get(itemId) as { available_count: number };
    expect(item.available_count).toBe(80); // 90 - 10

    const del = await authed(token, 'DELETE', `/api/layouts/${lid}`);
    expect(del.statusCode).toBe(204);

    item = db.prepare(`SELECT available_count FROM inventory_items WHERE id = ?`).get(itemId) as { available_count: number };
    expect(item.available_count).toBe(90); // released

    const audit = db.prepare(`SELECT COUNT(*) AS n FROM audit_logs WHERE action = 'layout.delete'`).get() as { n: number };
    expect(audit.n).toBeGreaterThanOrEqual(1);
  });
});

describe('Approved layout lock (VS-03)', () => {
  it('rejects editor saves on an approved layout, allows publisher saves', async () => {
    const { token, orgId } = await register('vs03');
    const e = await createEvent(token, orgId);
    const layout = await authed(token, 'POST', '/api/layouts', { organizationId: orgId, eventId: e.id, name: 'Plan', payload: { items: [] } });
    const lid = layout.json().layout.id as string;

    // Approve via a review decision (venue publish flow).
    const review = await authed(token, 'POST', `/api/layouts/${lid}/review-request`);
    expect(review.statusCode).toBe(201);
    const reviewId = review.json().review.id as string;
    const decide = await authed(token, 'POST', `/api/layouts/${lid}/reviews/${reviewId}/decision`, { decision: 'approved', note: 'Looks good' });
    expect(decide.statusCode).toBe(200);

    // A planner (edit, no publish) must be blocked.
    const planner = await register('vs03-planner');
    const roles = await authed(token, 'GET', `/api/orgs/${orgId}/roles`);
    const plannerRole = (roles.json().roles as Array<{ id: string; key: string }>).find((r) => r.key === 'planner');
    await authed(token, 'POST', `/api/orgs/${orgId}/members`, { userEmail: planner.email, roleId: plannerRole!.id });
    const plannerLogin = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: planner.email, password: 'password123' }, headers: { 'content-type': 'application/json' } });
    const blocked = await authed(plannerLogin.json().token as string, 'POST', `/api/layouts/${lid}/save`, { payload: { items: [{ id: 'x' }] } });
    expect(blocked.statusCode).toBe(403);
    expect(blocked.json().error).toBe('layout-approved-locked');

    // The owner (publish) can still save.
    const ownerSave = await authed(token, 'POST', `/api/layouts/${lid}/save`, { payload: { items: [{ id: 'y' }] } });
    expect(ownerSave.statusCode).toBe(200);
  });
});

describe('Layout realtime + approval queue (VS-04, VS-07)', () => {
  it('broadcasts layout.updated on save', async () => {
    const { token, orgId } = await register('vs04');
    const e = await createEvent(token, orgId);
    const layout = await authed(token, 'POST', '/api/layouts', { organizationId: orgId, eventId: e.id, name: 'Plan', payload: { items: [] } });
    const lid = layout.json().layout.id as string;
    const save = await authed(token, 'POST', `/api/layouts/${lid}/save`, { payload: { items: [{ id: 'a' }] } });
    expect(save.statusCode).toBe(200);
    const sse = db.prepare(`SELECT event_type, payload FROM sse_events WHERE organization_id = ? AND event_type = 'layout.updated' ORDER BY rowid DESC LIMIT 1`).get(orgId) as { event_type: string; payload: string } | undefined;
    expect(sse).toBeTruthy();
    expect(JSON.parse(sse!.payload).layoutId).toBe(lid);
  });

  it('dedupes the approval queue when multiple pending reviews exist', async () => {
    const { token, orgId } = await register('vs07');
    const e = await createEvent(token, orgId);
    const layout = await authed(token, 'POST', '/api/layouts', { organizationId: orgId, eventId: e.id, name: 'Plan', payload: { items: [] } });
    const lid = layout.json().layout.id as string;
    // Two pending review requests from two users.
    await authed(token, 'POST', `/api/layouts/${lid}/review-request`);
    const planner = await register('vs07-planner');
    const roles = await authed(token, 'GET', `/api/orgs/${orgId}/roles`);
    const plannerRole = (roles.json().roles as Array<{ id: string; key: string }>).find((r) => r.key === 'planner');
    await authed(token, 'POST', `/api/orgs/${orgId}/members`, { userEmail: planner.email, roleId: plannerRole!.id });
    const plannerLogin = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: planner.email, password: 'password123' }, headers: { 'content-type': 'application/json' } });
    const second = await authed(plannerLogin.json().token as string, 'POST', `/api/layouts/${lid}/review-request`);
    expect(second.statusCode).toBe(201);

    const queue = await authed(token, 'GET', `/api/orgs/${orgId}/layouts/approval-queue`);
    expect(queue.statusCode).toBe(200);
    const items = queue.json().items as Array<{ id: string }>;
    expect(items.filter((i) => i.id === lid).length).toBe(1);
  });
});

describe('Venue lifecycle audit (VS-05)', () => {
  it('audits venue approval, scaffold save, and delete', async () => {
    const { token, orgId } = await register('vs05');
    const v = await authed(token, 'POST', `/api/orgs/${orgId}/venues`, { name: 'Ballroom', capacity: 200 });
    expect(v.statusCode).toBe(201);
    const vid = v.json().venue.id as string;

    const approve = await authed(token, 'PATCH', `/api/venues/${vid}`, {
      approvalStatus: 'approved',
      masterLayout: { zones: [{ type: 'exit' }, { type: 'accessible_route' }, { type: 'power' }, { type: 'loading' }] },
    });
    expect(approve.statusCode).toBe(200);
    const approveAudit = db.prepare(`SELECT COUNT(*) AS n FROM audit_logs WHERE action = 'venue.update' AND target_id = ? AND details LIKE '%approved%'`).get(vid) as { n: number };
    expect(approveAudit.n).toBeGreaterThanOrEqual(1);

    const scaffold = await authed(token, 'POST', `/api/venues/${vid}/scaffold/save`, { masterLayout: { items: [] } });
    expect(scaffold.statusCode).toBe(200);
    const scaffoldAudit = db.prepare(`SELECT COUNT(*) AS n FROM audit_logs WHERE action = 'venue.scaffold.save' AND target_id = ?`).get(vid) as { n: number };
    expect(scaffoldAudit.n).toBe(1);

    const del = await authed(token, 'DELETE', `/api/venues/${vid}`);
    expect(del.statusCode).toBe(204);
    const delAudit = db.prepare(`SELECT COUNT(*) AS n FROM audit_logs WHERE action = 'venue.delete' AND target_id = ?`).get(vid) as { n: number };
    expect(delAudit.n).toBe(1);
  });
});
