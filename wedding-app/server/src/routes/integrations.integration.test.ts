import '../test/setup.js';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../index.js';
import { db } from '../db/database.js';
import { SYSTEM_ROLE_IDS } from '../lib/permissions.js';

let app: FastifyInstance;
beforeAll(async () => { app = await buildApp(); await app.ready(); });

beforeEach(() => {
  for (const t of [
    'integration_events', 'integrations',
    'audit_logs',
    'organization_memberships', 'organizations', 'users',
  ]) db.prepare(`DELETE FROM ${t}`).run();
  db.prepare(`DELETE FROM role_permissions WHERE role_id IN (SELECT id FROM roles WHERE is_system = 0)`).run();
  db.prepare(`DELETE FROM roles WHERE is_system = 0`).run();
});

async function register(email = `i-${Math.random().toString(36).slice(2)}@x.com`) {
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

describe('GET /integrations/providers', () => {
  it('lists available providers (includes email_smtp)', async () => {
    const u = await register();
    const res = await req(u.token, 'GET', `/api/orgs/${u.orgId}/integrations/providers`);
    expect(res.statusCode).toBe(200);
    const ids = res.json().providers.map((p: { id: string }) => p.id);
    expect(ids).toContain('email_smtp');
  });

  it('forbids non-admin users', async () => {
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
    const res = await req(staffToken, 'GET', `/api/orgs/${owner.orgId}/integrations/providers`);
    expect(res.statusCode).toBe(403);
  });
});

describe('POST /integrations (api_key / smtp providers)', () => {
  it('rejects unknown providers', async () => {
    const u = await register();
    const res = await req(u.token, 'POST', `/api/orgs/${u.orgId}/integrations`, {
      provider: 'does_not_exist', secrets: {},
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('unknown-provider');
  });

  it('validates config + secrets against the provider schema', async () => {
    const u = await register();
    // email_smtp requires host (1+ char) and fromAddress (valid email)
    const res = await req(u.token, 'POST', `/api/orgs/${u.orgId}/integrations`, {
      provider: 'email_smtp',
      config:  { host: 'smtp.example.com', port: 587, fromAddress: 'not-an-email' },
      secrets: { username: 'u', password: 'p' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('invalid-config');
  });

  it('creates a pending integration and attempts verify (which fails for non-real SMTP)', async () => {
    const u = await register();
    const res = await req(u.token, 'POST', `/api/orgs/${u.orgId}/integrations`, {
      provider: 'email_smtp',
      displayName: 'Acme SMTP',
      config: {
        host: 'localhost',
        port: 65530,         // unreachable on purpose
        secure: false,
        fromAddress: 'venue@example.com',
        fromName: 'Acme Venues',
      },
      secrets: { username: 'u', password: 'p' },
    });
    expect(res.statusCode).toBe(201);
    const integ = res.json().integration;
    expect(integ.provider).toBe('email_smtp');
    expect(integ.display_name).toBe('Acme SMTP');
    // verify failed because nothing is listening on :65530
    expect(integ.status).toBe('error');
    expect(integ.last_error).toBeTruthy();
    // Secret payload is NOT returned in the public view
    expect(integ.secret_payload).toBeUndefined();
    expect(integ.hasSecrets).toBe(true);
  });

  it('forbids non-admin', async () => {
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
    const res = await req(staffToken, 'POST', `/api/orgs/${owner.orgId}/integrations`, {
      provider: 'email_smtp',
      config: { host: 'x', port: 587, fromAddress: 'a@b.com' },
      secrets: { username: 'u', password: 'p' },
    });
    expect(res.statusCode).toBe(403);
  });
});

describe('Integration lifecycle', () => {
  async function seed(token: string, orgId: string) {
    const res = await req(token, 'POST', `/api/orgs/${orgId}/integrations`, {
      provider: 'email_smtp',
      config: { host: 'localhost', port: 65530, secure: false, fromAddress: 'a@b.com' },
      secrets: { username: 'u', password: 'p' },
    });
    return res.json().integration;
  }

  it('GET list returns the org\'s integrations (no secrets)', async () => {
    const u = await register();
    await seed(u.token, u.orgId);
    const res = await req(u.token, 'GET', `/api/orgs/${u.orgId}/integrations`);
    expect(res.statusCode).toBe(200);
    expect(res.json().integrations).toHaveLength(1);
    expect(res.json().integrations[0].secret_payload).toBeUndefined();
  });

  it('PATCH updates display name', async () => {
    const u = await register();
    const integ = await seed(u.token, u.orgId);
    const res = await req(u.token, 'PATCH', `/api/integrations/${integ.id}`, { displayName: 'New Name' });
    expect(res.statusCode).toBe(200);
    expect(res.json().integration.display_name).toBe('New Name');
  });

  it('DELETE removes the integration', async () => {
    const u = await register();
    const integ = await seed(u.token, u.orgId);
    const del = await req(u.token, 'DELETE', `/api/integrations/${integ.id}`);
    expect(del.statusCode).toBe(204);
    const list = await req(u.token, 'GET', `/api/orgs/${u.orgId}/integrations`);
    expect(list.json().integrations).toHaveLength(0);
  });

  it('org isolation: another user cannot see or modify', async () => {
    const owner = await register();
    const integ = await seed(owner.token, owner.orgId);
    const stranger = await register();
    expect((await req(stranger.token, 'GET', `/api/orgs/${owner.orgId}/integrations`)).statusCode).toBe(403);
    expect((await req(stranger.token, 'PATCH', `/api/integrations/${integ.id}`, { displayName: 'X' })).statusCode).toBe(403);
    expect((await req(stranger.token, 'DELETE', `/api/integrations/${integ.id}`)).statusCode).toBe(403);
  });
});
