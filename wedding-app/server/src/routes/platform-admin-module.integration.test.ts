/**
 * MODULE-08 — Platform Admin regression tests.
 *
 * Covers PA-01..PA-08 from docs/MODULE-08-PLATFORM-ADMIN.md: platform.manage
 * grants, manager read-capability removal, event-config scope, audit paging,
 * integration read gate.
 */
import './../test/setup.js';
import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../index.js';
import { db } from '../db/database.js';
import { orgsRepo, rolesRepo } from '../db/repos/index.js';
import { SYSTEM_ROLE_DEFINITIONS } from '../lib/permissions.js';

let app: FastifyInstance;

beforeAll(async () => { app = await buildApp(); await app.ready(); });
beforeEach(() => { db.exec('BEGIN'); });
afterEach(async () => { db.exec('ROLLBACK'); });

async function registerOwner(): Promise<{ token: string; orgId: string; userId: string }> {
  const email = `mod8-owner-${Math.random().toString(36).slice(2)}@x.com`;
  const res = await app.inject({
    method: 'POST', url: '/api/auth/register',
    payload: { email, password: 'testpass123', fullName: 'Owner', orgName: 'Module8 Manor' },
    headers: { 'content-type': 'application/json' },
  });
  expect(res.statusCode).toBe(201);
  return { token: res.json().token, orgId: res.json().organizationId, userId: res.json().user.id };
}

async function createUser(email: string): Promise<{ id: string; token: string }> {
  const res = await app.inject({
    method: 'POST', url: '/api/auth/register',
    payload: { email, password: 'testpass123', fullName: 'Member', orgName: `Tmp-${email}` },
    headers: { 'content-type': 'application/json' },
  });
  expect(res.statusCode).toBe(201);
  return { id: res.json().user.id, token: res.json().token };
}

function rolePerms(key: string): string[] {
  const def = SYSTEM_ROLE_DEFINITIONS.find((r) => r.key === key)!;
  return [...def.permissions];
}

describe('PA-01/02/03 — platform-admin permission grants', () => {
  it('owner/admin hold platform.manage + org.settings.manage; manager does not', () => {
    expect(rolePerms('owner')).toContain('platform.manage');
    expect(rolePerms('admin')).toContain('platform.manage');
    expect(rolePerms('owner')).toContain('org.settings.manage');
    expect(rolePerms('admin')).toContain('org.settings.manage');
    expect(rolePerms('manager')).not.toContain('platform.manage');
    expect(rolePerms('manager')).not.toContain('org.settings.manage');
  });

  it('manager no longer holds audit.view / integrations.view / reports.view', () => {
    const perms = rolePerms('manager');
    expect(perms).not.toContain('audit.view');
    expect(perms).not.toContain('integrations.view');
    expect(perms).not.toContain('reports.view');
  });

  it('planner retains reports.view (planning analytics) but no audit/integrations', () => {
    const perms = rolePerms('planner');
    expect(perms).toContain('reports.view');
    expect(perms).not.toContain('audit.view');
    expect(perms).not.toContain('integrations.view');
  });

  it('system roles are re-synced from definitions on boot', async () => {
    // ensureSystemRoles ran in buildApp; verify grants landed in the DB.
    const ownerRow = rolesRepo.findById(SYSTEM_ROLE_DEFINITIONS.find((r) => r.key === 'owner')!.id)!;
    expect(ownerRow.permissions).toContain('platform.manage');
    const managerRow = rolesRepo.findById(SYSTEM_ROLE_DEFINITIONS.find((r) => r.key === 'manager')!.id)!;
    expect(managerRow.permissions).not.toContain('audit.view');
  });
});

describe('PA-07 — event config scope', () => {
  it('event-scoped planner with events.edit can write event config', async () => {
    const owner = await registerOwner();
    const event = await app.inject({
      method: 'POST', url: '/api/events',
      payload: { organizationId: owner.orgId, title: 'Admin Wedding' },
      headers: { authorization: `Bearer ${owner.token}`, 'content-type': 'application/json' },
    });
    const eventId = event.json().event.id;
    const planner = await createUser(`evt-planner-${Math.random().toString(36).slice(2)}@x.com`);
    const plannerRole = rolesRepo.findByKey(null, 'planner')!;
    db.prepare(`INSERT INTO event_memberships (id, event_id, user_id, role_id) VALUES (?, ?, ?, ?)`)
      .run(`em-${Math.random().toString(36).slice(4)}`, eventId, planner.id, plannerRole.id);

    const put = await app.inject({
      method: 'PUT', url: `/api/events/${eventId}/config`,
      payload: { theme: { accent: '#123456' } },
      headers: { authorization: `Bearer ${planner.token}`, 'content-type': 'application/json' },
    });
    expect(put.statusCode).toBe(200);
    expect(put.json().config.theme.accent).toBe('#123456');
  });
});

describe('PA-05 — audit paging + filters', () => {
  it('rejects invalid limits; returns total + nextBefore; filters by actor', async () => {
    const owner = await registerOwner();
    const auth = { authorization: `Bearer ${owner.token}` };
    // seed a few audit rows via org config write
    for (let i = 0; i < 5; i++) {
      await app.inject({
        method: 'PUT', url: `/api/orgs/${owner.orgId}/config`,
        payload: { iteration: i },
        headers: { authorization: `Bearer ${owner.token}`, 'content-type': 'application/json' },
      });
    }
    const bad = await app.inject({ method: 'GET', url: `/api/orgs/${owner.orgId}/audit?limit=-5`, headers: auth });
    expect(bad.statusCode).toBe(400);
    const huge = await app.inject({ method: 'GET', url: `/api/orgs/${owner.orgId}/audit?limit=99999`, headers: auth });
    expect(huge.statusCode).toBe(400);

    const page = await app.inject({ method: 'GET', url: `/api/orgs/${owner.orgId}/audit?limit=3&action=org.config.update`, headers: auth });
    expect(page.statusCode).toBe(200);
    expect(page.json().logs.length).toBe(3);
    expect(page.json().total).toBe(5);
    expect(page.json().nextBefore).toBeTruthy();

    const filtered = await app.inject({ method: 'GET', url: `/api/orgs/${owner.orgId}/audit?actorEmail=nobody@example.com`, headers: auth });
    expect(filtered.statusCode).toBe(200);
    expect(filtered.json().logs.length).toBe(0);
  });
});

describe('PA-08 — integration read gate', () => {
  it('staff (no integrations.view) gets 403; owner gets 200', async () => {
    const owner = await registerOwner();
    const staff = await createUser(`staff8-${Math.random().toString(36).slice(2)}@x.com`);
    orgsRepo.addMember({ orgId: owner.orgId, userId: staff.id, roleId: rolesRepo.findByKey(null, 'staff')!.id });

    const staffList = await app.inject({ method: 'GET', url: `/api/orgs/${owner.orgId}/integrations`, headers: { authorization: `Bearer ${staff.token}` } });
    expect(staffList.statusCode).toBe(403);

    const ownerList = await app.inject({ method: 'GET', url: `/api/orgs/${owner.orgId}/integrations`, headers: { authorization: `Bearer ${owner.token}` } });
    expect(ownerList.statusCode).toBe(200);
  });
});
