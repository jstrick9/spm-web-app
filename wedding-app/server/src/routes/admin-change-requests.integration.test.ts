import './../test/setup.js';
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { db } from '../db/database.js';
import { buildApp } from '../index.js';
import type { FastifyInstance } from 'fastify';
import { rolesRepo } from '../db/repos/index.js';

let app: FastifyInstance;
beforeAll(async () => { app = await buildApp(); await app.ready(); });

beforeEach(() => {
  for (const t of ['admin_change_requests','organization_memberships','organizations','users','audit_logs']) { try { db.prepare(`DELETE FROM ${t}`).run(); } catch {} }
  try { db.prepare(`DELETE FROM role_permissions WHERE role_id IN (SELECT id FROM roles WHERE is_system = 0)`).run(); db.prepare(`DELETE FROM roles WHERE is_system = 0`).run(); } catch {}
  rolesRepo.ensureSystemRoles();
});

async function setup() {
  const r = await app.inject({ method: 'POST', url: '/api/auth/register', payload: { email: `adminreq-${Math.random().toString(36).slice(2)}@x.com`, password: 'testpass123', fullName: 'Owner', orgName: 'Venue' }, headers: { 'content-type': 'application/json' } });
  return { token: r.json().token as string, orgId: r.json().organizationId as string };
}

const req = (token: string, method: 'GET'|'POST'|'PATCH', url: string, payload?: unknown) => app.inject({ method, url, headers: payload !== undefined ? { authorization: `Bearer ${token}`, 'content-type': 'application/json' } : { authorization: `Bearer ${token}` }, payload: payload as never });

describe('admin change requests', () => {
  it('allows org members to create/list requests and owners to update status', async () => {
    const s = await setup();
    const create = await req(s.token, 'POST', `/api/orgs/${s.orgId}/admin-change-requests`, { title: 'Enable SMS alerts', area: 'notifications', reason: 'Managers need day-of alerts' });
    expect(create.statusCode).toBe(201);
    expect(create.json().request.status).toBe('open');

    const list = await req(s.token, 'GET', `/api/orgs/${s.orgId}/admin-change-requests`);
    expect(list.statusCode).toBe(200);
    expect(list.json().requests).toHaveLength(1);

    const update = await req(s.token, 'PATCH', `/api/orgs/${s.orgId}/admin-change-requests/${create.json().request.id}`, { status: 'approved', responseNote: 'Approved for managers.' });
    expect(update.statusCode).toBe(200);
    expect(update.json().request.status).toBe('approved');
  });
});
