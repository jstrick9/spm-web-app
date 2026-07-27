import './../test/setup.js';
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { db } from '../db/database.js';
import { buildApp } from '../index.js';
import type { FastifyInstance } from 'fastify';
import { SYSTEM_ROLE_IDS } from '../lib/permissions.js';

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
  db.prepare(`DELETE FROM role_permissions WHERE role_id IN (SELECT id FROM roles WHERE is_system = 0)`).run();
  db.prepare(`DELETE FROM roles WHERE is_system = 0`).run();
});

async function register(email = `pc-${Math.random().toString(36).slice(2)}@x.com`) {
  const r = await app.inject({
    method: 'POST', url: '/api/auth/register',
    payload: { email, password: 'testpass123', fullName: 'U', orgName: 'Org' },
    headers: { 'content-type': 'application/json' },
  });
  return { token: r.json().token, userId: r.json().user.id, orgId: r.json().organizationId, email };
}

const req = (token: string, method: 'GET'|'POST'|'PUT'|'PATCH'|'DELETE', url: string, payload?: unknown) =>
  app.inject({
    method, url,
    headers: payload !== undefined
      ? { authorization: `Bearer ${token}`, 'content-type': 'application/json' }
      : { authorization: `Bearer ${token}` },
    payload: payload as never,
  });

describe('Org platform config', () => {
  it('GET returns empty config initially', async () => {
    const u = await register();
    const res = await req(u.token, 'GET', `/api/orgs/${u.orgId}/config`);
    expect(res.statusCode).toBe(200);
    expect(res.json().config).toEqual({});
  });

  it('PUT then GET round-trips an arbitrary config', async () => {
    const u = await register();
    const cfg = {
      theme: { brand: '10 20 30', density: 'compact' },
      branding: { platformName: 'Acme Venues' },
    };
    const put = await req(u.token, 'PUT', `/api/orgs/${u.orgId}/config`, cfg);
    expect(put.statusCode).toBe(200);
    expect(put.json().config).toEqual(cfg);

    const get = await req(u.token, 'GET', `/api/orgs/${u.orgId}/config`);
    expect(get.json().config).toEqual(cfg);
  });

  it('uploads a public organization logo and persists the branding URL', async () => {
    const u = await register();
    const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=';
    const uploaded = await req(u.token, 'POST', `/api/orgs/${u.orgId}/config/logo`, { dataUri: png });
    expect(uploaded.statusCode).toBe(200);
    expect(uploaded.json().logoUrl).toMatch(/^\/uploads\/public\/org_logo_/);
    const get = await req(u.token, 'GET', `/api/orgs/${u.orgId}/config`);
    expect(get.json().config.branding.logoUrl).toBe(uploaded.json().logoUrl);
  });

  it('non-admin (staff) cannot PUT', async () => {
    const owner = await register();
    const staff = await register();
    await req(owner.token, 'POST', `/api/orgs/${owner.orgId}/members`, {
      userEmail: staff.email, roleId: SYSTEM_ROLE_IDS.staff,
    });
    const login = await app.inject({
      method: 'POST', url: '/api/auth/login',
      payload: { email: staff.email, password: 'testpass123' },
      headers: { 'content-type': 'application/json' },
    });
    const staffToken = login.json().token;
    const res = await req(staffToken, 'PUT', `/api/orgs/${owner.orgId}/config`, { theme: {} });
    expect(res.statusCode).toBe(403);
  });

  it('org isolation: stranger cannot read or write', async () => {
    const owner = await register();
    const stranger = await register();
    const r1 = await req(stranger.token, 'GET', `/api/orgs/${owner.orgId}/config`);
    expect(r1.statusCode).toBe(403);
    const r2 = await req(stranger.token, 'PUT', `/api/orgs/${owner.orgId}/config`, { theme: {} });
    expect(r2.statusCode).toBe(403);
  });

  it('rejects payloads larger than 64KB', async () => {
    const u = await register();
    const big = { huge: 'x'.repeat(70_000) };
    const res = await req(u.token, 'PUT', `/api/orgs/${u.orgId}/config`, big);
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('config-too-large');
  });

  it('writes an audit log entry', async () => {
    const u = await register();
    await req(u.token, 'PUT', `/api/orgs/${u.orgId}/config`, { theme: { brand: '1 2 3' } });
    const audit = await req(u.token, 'GET', `/api/orgs/${u.orgId}/audit?action=org.config.update`);
    expect(audit.json().logs.length).toBeGreaterThan(0);
  });
});

describe('Event platform config', () => {
  it('PUT + GET round-trip on an event the user can edit', async () => {
    const u = await register();
    const evt = (await req(u.token, 'POST', '/api/events', {
      organizationId: u.orgId, title: 'E',
    })).json().event;
    const cfg = { theme: { brand: '99 88 77' } };
    const put = await req(u.token, 'PUT', `/api/events/${evt.id}/config`, cfg);
    expect(put.statusCode).toBe(200);
    const get = await req(u.token, 'GET', `/api/events/${evt.id}/config`);
    expect(get.json().config).toEqual(cfg);
  });

  it('stranger cannot read or write', async () => {
    const owner = await register();
    const evt = (await req(owner.token, 'POST', '/api/events', {
      organizationId: owner.orgId, title: 'E',
    })).json().event;
    const stranger = await register();
    expect((await req(stranger.token, 'GET', `/api/events/${evt.id}/config`)).statusCode).toBe(403);
    expect((await req(stranger.token, 'PUT', `/api/events/${evt.id}/config`, {})).statusCode).toBe(403);
  });
});

describe('User preferences', () => {
  it('round-trips per-user config', async () => {
    const u = await register();
    const cfg = { theme: { colorScheme: 'dark', density: 'compact' } };
    const put = await req(u.token, 'PUT', '/api/users/me/preferences', cfg);
    expect(put.statusCode).toBe(200);
    const get = await req(u.token, 'GET', '/api/users/me/preferences');
    expect(get.json().config).toEqual(cfg);
  });

  it('two users have independent preferences', async () => {
    const a = await register();
    const b = await register();
    await req(a.token, 'PUT', '/api/users/me/preferences', { theme: { colorScheme: 'dark' } });
    await req(b.token, 'PUT', '/api/users/me/preferences', { theme: { colorScheme: 'light' } });
    expect((await req(a.token, 'GET', '/api/users/me/preferences')).json().config.theme.colorScheme).toBe('dark');
    expect((await req(b.token, 'GET', '/api/users/me/preferences')).json().config.theme.colorScheme).toBe('light');
  });

  it('unauthenticated request is rejected', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/users/me/preferences' });
    expect(res.statusCode).toBe(401);
  });
});
