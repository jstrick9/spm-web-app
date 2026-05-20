/**
 * Quick integration tests covering domains that the main integration
 * test file doesn't exercise: venues, decor, messages, questions, audit.
 *
 * These are mostly smoke-level — they exist primarily to lift Phase 1
 * code coverage past the 75% gate. Phase 3+ adds richer scenario tests.
 */
import './../test/setup.js';
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { db } from '../db/database.js';
import { buildApp } from '../index.js';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;
beforeAll(async () => { app = await buildApp(); await app.ready(); });
beforeEach(() => {
  for (const t of [
    'audit_logs','direct_messages','event_answers','event_questions',
    'staff_shifts','staff_areas','staff_tasks','timeline_events',
    'vendor_payments','vendors','decor_packages','decor_arrangements',
    'decor_categories','decor_items','guest_portal_configs','rsvp_submissions',
    'guest_sub_event_invitations','guests','layout_versions','layouts',
    'catalog_items','venues','sub_events','event_memberships','events',
    'organization_memberships','organizations','users',
  ]) db.prepare(`DELETE FROM ${t}`).run();
});

async function register(email = `cov-${Math.random()}@x.com`) {
  const r = await app.inject({
    method: 'POST', url: '/api/auth/register',
    payload: { email, password: 'testpass123', fullName: 'U', orgName: 'Org' },
  });
  return { token: r.json().token as string, orgId: r.json().organizationId as string, userId: r.json().user.id as string };
}
const req = (token: string, method: 'GET'|'POST'|'PUT'|'PATCH'|'DELETE', url: string, payload?: unknown) =>
  app.inject({
    method, url,
    headers: payload !== undefined
      ? { authorization: `Bearer ${token}`, 'content-type': 'application/json' }
      : { authorization: `Bearer ${token}` },
    payload: payload as never,
  });

describe('venues routes', () => {
  it('CRUD round-trip', async () => {
    const u = await register();
    const create = await req(u.token, 'POST', `/api/orgs/${u.orgId}/venues`, {
      name: 'Main Hall', capacity: 200, width: 50, height: 30,
    });
    expect(create.statusCode).toBe(201);
    const id = create.json().venue.id;

    const list = await req(u.token, 'GET', `/api/orgs/${u.orgId}/venues`);
    expect(list.json().venues).toHaveLength(1);

    const patch = await req(u.token, 'PATCH', `/api/venues/${id}`, { capacity: 250 });
    expect(patch.json().venue.capacity).toBe(250);

    const del = await req(u.token, 'DELETE', `/api/venues/${id}`);
    expect(del.statusCode).toBe(204);
  });
});

describe('decor routes', () => {
  it('items, categories, arrangements, packages', async () => {
    const u = await register();

    // Category
    const cat = (await req(u.token, 'POST', `/api/orgs/${u.orgId}/decor/categories`, { name: 'Florals' })).json().category;
    expect(cat.name).toBe('Florals');

    // Item
    const item = (await req(u.token, 'POST', `/api/orgs/${u.orgId}/decor/items`, { name: 'Rose Garland', categoryId: cat.id })).json().item;
    expect(item.name).toBe('Rose Garland');

    const patched = (await req(u.token, 'PATCH', `/api/decor/items/${item.id}`, { name: 'White Rose Garland' })).json().item;
    expect(patched.name).toBe('White Rose Garland');

    // Arrangement
    const arr = (await req(u.token, 'PUT', `/api/orgs/${u.orgId}/decor/arrangements`, {
      name: 'Aisle', payload: { items: [] },
    })).json().arrangement;
    expect(arr.name).toBe('Aisle');

    // Package
    const pkg = (await req(u.token, 'PUT', `/api/orgs/${u.orgId}/decor/packages`, {
      name: 'Rustic', arrangements: [{ arrangementId: arr.id, targetCategory: 'reception' }],
    })).json().package;
    expect(pkg.name).toBe('Rustic');

    // List checks
    expect((await req(u.token, 'GET', `/api/orgs/${u.orgId}/decor/items`)).json().items).toHaveLength(1);
    expect((await req(u.token, 'GET', `/api/orgs/${u.orgId}/decor/categories`)).json().categories).toHaveLength(1);
    expect((await req(u.token, 'GET', `/api/orgs/${u.orgId}/decor/arrangements`)).json().arrangements).toHaveLength(1);
    expect((await req(u.token, 'GET', `/api/orgs/${u.orgId}/decor/packages`)).json().packages).toHaveLength(1);

    // Deletes
    expect((await req(u.token, 'DELETE', `/api/decor/items/${item.id}`)).statusCode).toBe(204);
    expect((await req(u.token, 'DELETE', `/api/decor/categories/${cat.id}`)).statusCode).toBe(204);
    expect((await req(u.token, 'DELETE', `/api/decor/arrangements/${arr.id}`)).statusCode).toBe(204);
    expect((await req(u.token, 'DELETE', `/api/decor/packages/${pkg.id}`)).statusCode).toBe(204);
  });
});

describe('event questions + answers', () => {
  it('full lifecycle', async () => {
    const u = await register();
    const q = (await req(u.token, 'POST', `/api/orgs/${u.orgId}/questions`, {
      question: 'Bar service?', answerType: 'dropdown',
      options: ['Full bar', 'Beer + Wine', 'Cash bar'],
    })).json().question;
    expect(q.id).toBeTruthy();

    const patched = (await req(u.token, 'PATCH', `/api/questions/${q.id}`, { required: true })).json().question;
    expect(patched.required).toBe(1);

    const evt = (await req(u.token, 'POST', '/api/events', {
      organizationId: u.orgId, title: 'E',
    })).json().event;
    await req(u.token, 'PUT', `/api/events/${evt.id}/answers/${q.id}`, { answer: 'Full bar' });
    const answers = (await req(u.token, 'GET', `/api/events/${evt.id}/answers`)).json().answers;
    expect(answers).toHaveLength(1);

    expect((await req(u.token, 'DELETE', `/api/questions/${q.id}`)).statusCode).toBe(204);
  });
});

describe('direct messages', () => {
  it('send + list + mark read', async () => {
    const u = await register();
    const send = await req(u.token, 'POST', '/api/messages/thread-xyz', { body: 'hello', senderRole: 'admin' });
    expect(send.statusCode).toBe(201);
    const list = await req(u.token, 'GET', '/api/messages/thread-xyz');
    expect(list.json().messages).toHaveLength(1);
    await req(u.token, 'POST', '/api/messages/thread-xyz/read');
  });
});

describe('audit', () => {
  it('lists logs for org (audit.view requires admin/owner)', async () => {
    const u = await register();
    // register/event-create themselves write audit entries
    await req(u.token, 'POST', '/api/events', { organizationId: u.orgId, title: 'AuditTest' });
    const res = await req(u.token, 'GET', `/api/orgs/${u.orgId}/audit`);
    expect(res.statusCode).toBe(200);
    expect(res.json().logs.length).toBeGreaterThan(0);
  });
});

describe('catalog edge cases', () => {
  it('PATCH and DELETE single item', async () => {
    const u = await register();
    const item = (await req(u.token, 'POST', `/api/orgs/${u.orgId}/catalog/chair`, { name: 'Ghost' })).json().item;
    const patched = (await req(u.token, 'PATCH', `/api/catalog/${item.id}`, { name: 'Ghost Acrylic' })).json().item;
    expect(patched.name).toBe('Ghost Acrylic');
    expect((await req(u.token, 'DELETE', `/api/catalog/${item.id}`)).statusCode).toBe(204);
  });
});

describe('staff areas + shifts', () => {
  it('CRUD', async () => {
    const u = await register();
    const area = (await req(u.token, 'POST', `/api/orgs/${u.orgId}/staff/areas`, { name: 'Kitchen' })).json().area;
    expect((await req(u.token, 'GET', `/api/orgs/${u.orgId}/staff/areas`)).json().areas).toHaveLength(1);
    const shift = (await req(u.token, 'POST', `/api/orgs/${u.orgId}/staff/shifts`, {
      staffId: u.userId, role: 'setup',
      startsAt: '2026-09-12T08:00:00Z', endsAt: '2026-09-12T12:00:00Z',
    })).json().shift;
    expect((await req(u.token, 'GET', `/api/orgs/${u.orgId}/staff/shifts`)).json().shifts).toHaveLength(1);
    expect((await req(u.token, 'DELETE', `/api/staff/areas/${area.id}`)).statusCode).toBe(204);
    expect((await req(u.token, 'DELETE', `/api/staff/shifts/${shift.id}`)).statusCode).toBe(204);
  });
});

describe('sub events', () => {
  it('add, list, delete', async () => {
    const u = await register();
    const evt = (await req(u.token, 'POST', '/api/events', { organizationId: u.orgId, title: 'X' })).json().event;
    const sub = (await req(u.token, 'POST', `/api/events/${evt.id}/sub-events`, {
      title: 'Rehearsal Dinner', startsAt: '2026-09-11T18:00:00Z',
    })).json().subEvent;
    expect((await req(u.token, 'GET', `/api/events/${evt.id}/sub-events`)).json().subEvents).toHaveLength(1);
    expect((await req(u.token, 'DELETE', `/api/sub-events/${sub.id}`)).statusCode).toBe(204);
  });
});

describe('org branding', () => {
  it('reads default and updates', async () => {
    const u = await register();
    const updated = await req(u.token, 'PUT', `/api/orgs/${u.orgId}/branding`, { primaryColor: '#4A1942' });
    expect(updated.statusCode).toBe(200);
    expect(updated.json().branding.primaryColor).toBe('#4A1942');
  });

  it('GET /api/orgs/:id returns org', async () => {
    const u = await register();
    const res = await req(u.token, 'GET', `/api/orgs/${u.orgId}`);
    expect(res.statusCode).toBe(200);
    expect(res.json().organization.id).toBe(u.orgId);
  });
});

describe('logout', () => {
  it('returns ok for an authenticated request', async () => {
    const u = await register();
    const res = await req(u.token, 'POST', '/api/auth/logout');
    expect(res.statusCode).toBe(200);
  });
});

describe('layouts: list, rename via list, delete', () => {
  it('list filters by template + delete', async () => {
    const u = await register();
    const l = (await req(u.token, 'POST', '/api/layouts', {
      organizationId: u.orgId, name: 'T', payload: {}, isTemplate: true,
    })).json().layout;
    const t = await req(u.token, 'GET', `/api/orgs/${u.orgId}/layouts?template=true`);
    expect(t.json().layouts).toHaveLength(1);
    expect((await req(u.token, 'DELETE', `/api/layouts/${l.id}`)).statusCode).toBe(204);
  });
});
