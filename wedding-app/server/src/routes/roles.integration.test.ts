/**
 * Integration tests for the role management surface.
 *   - Creating custom roles
 *   - System roles are immutable
 *   - Permissions on a custom role actually gate route access
 *   - Adding members with custom roles
 *   - Vendor role baseline (now a system role)
 */
import './../test/setup.js';
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { db } from '../db/database.js';
import { buildApp } from '../index.js';
import type { FastifyInstance } from 'fastify';
import { SYSTEM_ROLE_IDS } from '../lib/permissions.js';

let app: FastifyInstance;

beforeAll(async () => {
  app = await buildApp();
  await app.ready();
});

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
  // Wipe custom roles but keep system rows.
  db.prepare(`DELETE FROM role_permissions WHERE role_id IN (SELECT id FROM roles WHERE is_system = 0)`).run();
  db.prepare(`DELETE FROM roles WHERE is_system = 0`).run();
});

async function register(email = `r-${Math.random().toString(36).slice(2)}@x.com`) {
  const r = await app.inject({
    method: 'POST', url: '/api/auth/register',
    payload: { email, password: 'testpass123', fullName: 'U', orgName: 'Org' },
    headers: { 'content-type': 'application/json' },
  });
  return { token: r.json().token as string, userId: r.json().user.id as string, orgId: r.json().organizationId as string, email };
}

function authed(token: string, method: 'GET'|'POST'|'PUT'|'PATCH'|'DELETE', url: string, payload?: unknown) {
  return app.inject({
    method, url,
    headers: payload !== undefined
      ? { authorization: `Bearer ${token}`, 'content-type': 'application/json' }
      : { authorization: `Bearer ${token}` },
    payload: payload as never,
  });
}

describe('GET /api/orgs/:id/roles/permissions', () => {
  it('returns the catalog with at least one row per category', async () => {
    const u = await register();
    const res = await authed(u.token, 'GET', `/api/orgs/${u.orgId}/roles/permissions`);
    expect(res.statusCode).toBe(200);
    const catalog = res.json().catalog as Array<{ id: string; category: string }>;
    expect(catalog.length).toBeGreaterThan(40);
    expect(catalog.some(p => p.id === 'roles.manage')).toBe(true);
    expect(catalog.some(p => p.id === 'vendor.portal.view')).toBe(true);
  });

  it('forbids users without roles.view (e.g. staff)', async () => {
    const owner = await register();
    const staff = await register();
    // Promote staff into owner's org as a staff member
    await authed(owner.token, 'POST', `/api/orgs/${owner.orgId}/members`, {
      userEmail: staff.email, roleId: SYSTEM_ROLE_IDS.staff,
    });
    // staff token won't reflect the new membership until reissued, so re-login
    const login = await app.inject({
      method: 'POST', url: '/api/auth/login',
      payload: { email: staff.email, password: 'testpass123' },
      headers: { 'content-type': 'application/json' },
    });
    const staffToken = login.json().token;
    const res = await authed(staffToken, 'GET', `/api/orgs/${owner.orgId}/roles/permissions`);
    expect(res.statusCode).toBe(403);
  });
});

describe('GET /api/orgs/:id/roles', () => {
  it('returns all system roles + any org-custom ones', async () => {
    const u = await register();
    const res = await authed(u.token, 'GET', `/api/orgs/${u.orgId}/roles`);
    expect(res.statusCode).toBe(200);
    const roles = res.json().roles as Array<{ key: string; is_system: number }>;
    const systemKeys = roles.filter(r => r.is_system === 1).map(r => r.key).sort();
    expect(systemKeys).toEqual(['admin','couple','guest','manager','owner','planner','staff','vendor']);
  });
});

describe('POST /api/orgs/:id/roles - create custom role', () => {
  it('creates and returns a custom role with given permissions', async () => {
    const u = await register();
    const res = await authed(u.token, 'POST', `/api/orgs/${u.orgId}/roles`, {
      key: 'senior-planner', name: 'Senior Planner',
      permissions: ['events.view','events.edit','vendors.manage'],
    });
    expect(res.statusCode).toBe(201);
    const role = res.json().role;
    expect(role.is_system).toBe(0);
    expect(role.permissions.sort()).toEqual(['events.edit','events.view','vendors.manage']);
  });

  it('rejects unknown permission ids', async () => {
    const u = await register();
    const res = await authed(u.token, 'POST', `/api/orgs/${u.orgId}/roles`, {
      key: 'bad', name: 'Bad', permissions: ['no.such.permission'],
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('unknown-permission');
  });

  it('rejects invalid keys', async () => {
    const u = await register();
    const res = await authed(u.token, 'POST', `/api/orgs/${u.orgId}/roles`, {
      key: 'Bad Key!', name: 'X', permissions: ['events.view'],
    });
    expect(res.statusCode).toBe(400);
  });

  it('rejects duplicate keys in the same org', async () => {
    const u = await register();
    await authed(u.token, 'POST', `/api/orgs/${u.orgId}/roles`, {
      key: 'dup', name: 'A', permissions: ['events.view'],
    });
    const res = await authed(u.token, 'POST', `/api/orgs/${u.orgId}/roles`, {
      key: 'dup', name: 'B', permissions: ['events.view'],
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().error).toBe('role-key-already-exists');
  });

  it('copyFrom seeds the new role with the source roles permissions', async () => {
    const u = await register();
    const res = await authed(u.token, 'POST', `/api/orgs/${u.orgId}/roles`, {
      key: 'planner-plus', name: 'Planner+',
      copyFrom: SYSTEM_ROLE_IDS.planner,
      permissions: ['audit.view'],   // adds on top
    });
    expect(res.statusCode).toBe(201);
    const role = res.json().role;
    // Should have everything planner has, plus audit.view
    expect(role.permissions).toContain('audit.view');
    expect(role.permissions).toContain('events.create');
    expect(role.permissions).toContain('layouts.publish');
  });

  it('forbids users without roles.manage (e.g. planner)', async () => {
    const owner = await register();
    const planner = await register();
    await authed(owner.token, 'POST', `/api/orgs/${owner.orgId}/members`, {
      userEmail: planner.email, roleId: SYSTEM_ROLE_IDS.planner,
    });
    const login = await app.inject({
      method: 'POST', url: '/api/auth/login',
      payload: { email: planner.email, password: 'testpass123' },
      headers: { 'content-type': 'application/json' },
    });
    const plannerToken = login.json().token;
    const res = await authed(plannerToken, 'POST', `/api/orgs/${owner.orgId}/roles`, {
      key: 'x', name: 'X', permissions: ['events.view'],
    });
    expect(res.statusCode).toBe(403);
  });
});

describe('PATCH / DELETE /api/roles/:id', () => {
  it('updates a custom role and the permission change takes effect immediately', async () => {
    const owner = await register();
    const created = await authed(owner.token, 'POST', `/api/orgs/${owner.orgId}/roles`, {
      key: 'finance', name: 'Finance', permissions: ['audit.view'],
    });
    const roleId = created.json().role.id;

    // Add a second user with that role
    const u2 = await register();
    await authed(owner.token, 'POST', `/api/orgs/${owner.orgId}/members`, {
      userEmail: u2.email, roleId,
    });
    const login = await app.inject({
      method: 'POST', url: '/api/auth/login',
      payload: { email: u2.email, password: 'testpass123' },
      headers: { 'content-type': 'application/json' },
    });
    const u2Token = login.json().token;

    // Before update: u2 cannot list vendors (no vendors.view)
    const v1 = await authed(u2Token, 'GET', `/api/orgs/${owner.orgId}/vendors`);
    expect(v1.statusCode).toBe(403);

    // Update the role to also grant vendors.view
    const upd = await authed(owner.token, 'PATCH', `/api/roles/${roleId}`, {
      permissions: ['audit.view', 'vendors.view'],
    });
    expect(upd.statusCode).toBe(200);

    // Now u2 can list vendors
    const v2 = await authed(u2Token, 'GET', `/api/orgs/${owner.orgId}/vendors`);
    expect(v2.statusCode).toBe(200);
  });

  it('refuses to update a system role', async () => {
    const u = await register();
    const res = await authed(u.token, 'PATCH', `/api/roles/${SYSTEM_ROLE_IDS.admin}`, {
      name: 'Hacked',
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('system-role-immutable');
  });

  it('refuses to delete a system role', async () => {
    const u = await register();
    const res = await authed(u.token, 'DELETE', `/api/roles/${SYSTEM_ROLE_IDS.owner}`);
    expect(res.statusCode).toBe(400);
  });

  it('refuses to delete a role that is in use', async () => {
    const owner = await register();
    const role = (await authed(owner.token, 'POST', `/api/orgs/${owner.orgId}/roles`, {
      key: 'inuse', name: 'In Use', permissions: ['events.view'],
    })).json().role;
    const u2 = await register();
    await authed(owner.token, 'POST', `/api/orgs/${owner.orgId}/members`, {
      userEmail: u2.email, roleId: role.id,
    });
    const res = await authed(owner.token, 'DELETE', `/api/roles/${role.id}`);
    expect(res.statusCode).toBe(409);
    expect(res.json().error).toBe('role-in-use');
  });
});

describe('Reserved system role keys', () => {
  it('does not allow a custom role to reuse a system role key', async () => {
    const owner = await register();
    const res = await authed(owner.token, 'POST', `/api/orgs/${owner.orgId}/roles`, { key: 'admin', name: 'Custom Admin', permissions: [] });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('reserved-system-role-key');
  });
});

describe('Member management', () => {
  it('lists members with their role keys', async () => {
    const u = await register();
    const res = await authed(u.token, 'GET', `/api/orgs/${u.orgId}/members`);
    expect(res.statusCode).toBe(200);
    const members = res.json().members;
    expect(members).toHaveLength(1);
    expect(members[0].role_key).toBe('owner');
  });

  it('cannot remove the org owner', async () => {
    const u = await register();
    const res = await authed(u.token, 'DELETE', `/api/orgs/${u.orgId}/members/${u.userId}`);
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('cannot-remove-owner');
  });

  it('prevents manager promotion to admin and owner role changes', async () => {
    const owner = await register();
    const manager = await register();
    const staff = await register();
    await authed(owner.token, 'POST', `/api/orgs/${owner.orgId}/members`, { userEmail: manager.email, roleId: SYSTEM_ROLE_IDS.manager });
    await authed(owner.token, 'POST', `/api/orgs/${owner.orgId}/members`, { userEmail: staff.email, roleId: SYSTEM_ROLE_IDS.staff });
    const login = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: manager.email, password: 'testpass123' }, headers: { 'content-type': 'application/json' } });
    const blocked = await authed(login.json().token, 'PATCH', `/api/orgs/${owner.orgId}/members/${staff.userId}`, { roleId: SYSTEM_ROLE_IDS.admin });
    expect(blocked.statusCode).toBe(403);
    const ownerChange = await authed(owner.token, 'PATCH', `/api/orgs/${owner.orgId}/members/${owner.userId}`, { roleId: SYSTEM_ROLE_IDS.manager });
    expect(ownerChange.statusCode).toBe(400);
    expect(ownerChange.json().error).toBe('cannot-change-owner-role');
  });

  it('change a member role (promote staff -> planner)', async () => {
    const owner = await register();
    const u2 = await register();
    await authed(owner.token, 'POST', `/api/orgs/${owner.orgId}/members`, {
      userEmail: u2.email, roleId: SYSTEM_ROLE_IDS.staff,
    });
    const res = await authed(owner.token, 'PATCH', `/api/orgs/${owner.orgId}/members/${u2.userId}`, {
      roleId: SYSTEM_ROLE_IDS.planner,
    });
    expect(res.statusCode).toBe(200);
    const members = (await authed(owner.token, 'GET', `/api/orgs/${owner.orgId}/members`)).json().members;
    const updated = members.find((m: { user_id: string }) => m.user_id === u2.userId);
    expect(updated.role_key).toBe('planner');
  });
});

describe('Vendor role baseline (now a system role)', () => {
  it('a vendor user cannot see venue internals', async () => {
    const owner = await register();
    const vendor = await register();
    await authed(owner.token, 'POST', `/api/orgs/${owner.orgId}/members`, {
      userEmail: vendor.email, roleId: SYSTEM_ROLE_IDS.vendor,
    });
    const login = await app.inject({
      method: 'POST', url: '/api/auth/login',
      payload: { email: vendor.email, password: 'testpass123' },
      headers: { 'content-type': 'application/json' },
    });
    const vToken = login.json().token;

    // Vendor cannot see guest lists, events, layouts
    expect((await authed(vToken, 'GET', `/api/orgs/${owner.orgId}/events`)).statusCode).toBe(403);
    expect((await authed(vToken, 'GET', `/api/orgs/${owner.orgId}/venues`)).statusCode).toBe(403);
  });
});
