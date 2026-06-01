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
    payload: { email: `cig-${Math.random().toString(36).slice(2)}@x.com`, password: 'testpass123', fullName: 'O', orgName: 'Org' },
    headers: { 'content-type': 'application/json' } });
  const token = r.json().token, orgId = r.json().organizationId;
  const e = await app.inject({ method: 'POST', url: '/api/events',
    payload: { organizationId: orgId, title: 'Wedding' },
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' } });
  return { token, orgId, eventId: e.json().event.id };
}

const req = (token: string, method: 'GET'|'POST'|'PATCH'|'DELETE', url: string, payload?: unknown) =>
  app.inject({ method, url, headers: payload !== undefined
    ? { authorization: `Bearer ${token}`, 'content-type': 'application/json' }
    : { authorization: `Bearer ${token}` }, payload: payload as never });

// ════════════════════════════════════════════════════════════
describe('Contracts', () => {
  it('CRUD lifecycle', async () => {
    const s = await setup();
    // Create
    const cr = await req(s.token, 'POST', `/api/events/${s.eventId}/contracts`, {
      title: 'Venue Agreement', recipientName: 'Sarah', amountCents: 500000,
    });
    expect(cr.statusCode).toBe(201);
    const id = cr.json().contract.id;
    expect(cr.json().contract.status).toBe('draft');

    // List
    const lr = await req(s.token, 'GET', `/api/events/${s.eventId}/contracts`);
    expect(lr.json().contracts).toHaveLength(1);

    // Send
    const sr = await req(s.token, 'POST', `/api/contracts/${id}/send`);
    expect(sr.json().contract.status).toBe('sent');
    expect(sr.json().contract.sent_at).toBeTruthy();

    // Sign
    const sigr = await req(s.token, 'POST', `/api/contracts/${id}/sign`, { signature: 'Sarah Smith' });
    expect(sigr.json().contract.status).toBe('signed');
    expect(sigr.json().contract.signature).toBe('Sarah Smith');

    // Delete
    const dr = await req(s.token, 'DELETE', `/api/contracts/${id}`);
    expect(dr.statusCode).toBe(204);
    const lr2 = await req(s.token, 'GET', `/api/events/${s.eventId}/contracts`);
    expect(lr2.json().contracts).toHaveLength(0);
  });

  it('requires contracts.view for GET', async () => {
    const r = await app.inject({ method: 'GET', url: '/api/events/x/contracts' });
    expect(r.statusCode).toBe(401);
  });
});

// ════════════════════════════════════════════════════════════
describe('Inventory', () => {
  it('CRUD lifecycle', async () => {
    const s = await setup();
    // Create
    const cr = await req(s.token, 'POST', `/api/orgs/${s.orgId}/inventory`, {
      name: 'Gold Chiavari Chair', sku: 'CHR-001', category: 'chair', totalCount: 200, availableCount: 190,
    });
    expect(cr.statusCode).toBe(201);
    expect(cr.json().item.name).toBe('Gold Chiavari Chair');

    // List
    const lr = await req(s.token, 'GET', `/api/orgs/${s.orgId}/inventory`);
    expect(lr.json().items).toHaveLength(1);
    expect(lr.json().stats.total).toBe(1);

    // Update
    const ur = await req(s.token, 'PATCH', `/api/inventory/${cr.json().item.id}`, { availableCount: 150 });
    expect(ur.json().item.available_count).toBe(150);

    // Delete
    const dr = await req(s.token, 'DELETE', `/api/inventory/${cr.json().item.id}`);
    expect(dr.statusCode).toBe(204);
  });

  it('stats shows low stock and maintenance counts', async () => {
    const s = await setup();
    await req(s.token, 'POST', `/api/orgs/${s.orgId}/inventory`, { name: 'Low', totalCount: 5, availableCount: 3 });
    await req(s.token, 'POST', `/api/orgs/${s.orgId}/inventory`, { name: 'Broken', condition: 'maintenance' });
    const lr = await req(s.token, 'GET', `/api/orgs/${s.orgId}/inventory`);
    expect(lr.json().stats.lowStock).toBe(2); // both under 10
    expect(lr.json().stats.maintenance).toBe(1);
  });
});

// ════════════════════════════════════════════════════════════
describe('Gallery', () => {
  it('CRUD lifecycle', async () => {
    const s = await setup();
    // Upload
    const cr = await req(s.token, 'POST', `/api/events/${s.eventId}/gallery`, {
      filename: 'flower.jpg', url: 'data:image/jpeg;base64,/9j/abc', category: 'florals',
    });
    expect(cr.statusCode).toBe(201);
    expect(cr.json().image.category).toBe('florals');

    // List
    const lr = await req(s.token, 'GET', `/api/events/${s.eventId}/gallery`);
    expect(lr.json().images).toHaveLength(1);
    expect(lr.json().counts).toEqual({ florals: 1 });

    // Recategorize
    const ur = await req(s.token, 'PATCH', `/api/gallery/${cr.json().image.id}`, { category: 'ceremony' });
    expect(ur.json().image.category).toBe('ceremony');

    // Delete
    const dr = await req(s.token, 'DELETE', `/api/gallery/${cr.json().image.id}`);
    expect(dr.statusCode).toBe(204);
  });

  it('requires gallery.view for GET', async () => {
    const r = await app.inject({ method: 'GET', url: '/api/events/x/gallery' });
    expect(r.statusCode).toBe(401);
  });
});
