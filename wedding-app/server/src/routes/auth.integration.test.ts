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

async function register(email?: string) {
  const e = email ?? `auth-${Math.random().toString(36).slice(2)}@x.com`;
  const r = await app.inject({ method: 'POST', url: '/api/auth/register',
    payload: { email: e, password: 'testpass123', fullName: 'Tester', orgName: 'Org' },
    headers: { 'content-type': 'application/json' } });
  return { token: r.json().token, email: e };
}

describe('Auth: password change', () => {
  it('changes password with correct current password', async () => {
    const u = await register();
    const res = await app.inject({ method: 'POST', url: '/api/auth/change-password',
      payload: { currentPassword: 'testpass123', newPassword: 'newpass456789' },
      headers: { authorization: `Bearer ${u.token}`, 'content-type': 'application/json' } });
    expect(res.statusCode).toBe(200);
    expect(res.json().ok).toBe(true);

    // Old token should be invalidated (session version bumped)
    const meRes = await app.inject({ method: 'GET', url: '/api/auth/me',
      headers: { authorization: `Bearer ${u.token}` } });
    expect(meRes.statusCode).toBe(401); // session invalidated

    // Login with new password works
    const loginRes = await app.inject({ method: 'POST', url: '/api/auth/login',
      payload: { email: u.email, password: 'newpass456789' },
      headers: { 'content-type': 'application/json' } });
    expect(loginRes.statusCode).toBe(200);
  });

  it('rejects wrong current password', async () => {
    const u = await register();
    const res = await app.inject({ method: 'POST', url: '/api/auth/change-password',
      payload: { currentPassword: 'wrongpassword', newPassword: 'newpass456789' },
      headers: { authorization: `Bearer ${u.token}`, 'content-type': 'application/json' } });
    expect(res.statusCode).toBe(200);
    expect(res.json().error).toBe('invalid-current-password');
  });

  it('rejects new password too short', async () => {
    const u = await register();
    const res = await app.inject({ method: 'POST', url: '/api/auth/change-password',
      payload: { currentPassword: 'testpass123', newPassword: 'short' },
      headers: { authorization: `Bearer ${u.token}`, 'content-type': 'application/json' } });
    expect(res.statusCode).toBe(400);
  });
});

describe('Auth: profile update', () => {
  it('updates full name', async () => {
    const u = await register();
    const res = await app.inject({ method: 'PATCH', url: '/api/auth/profile',
      payload: { fullName: 'New Name' },
      headers: { authorization: `Bearer ${u.token}`, 'content-type': 'application/json' } });
    expect(res.statusCode).toBe(200);
    expect(res.json().user.fullName).toBe('New Name');
  });

  it('updates phone', async () => {
    const u = await register();
    const res = await app.inject({ method: 'PATCH', url: '/api/auth/profile',
      payload: { phone: '555-1234' },
      headers: { authorization: `Bearer ${u.token}`, 'content-type': 'application/json' } });
    expect(res.statusCode).toBe(200);
    expect(res.json().user.phone).toBe('555-1234');
  });

  it('requires auth', async () => {
    const res = await app.inject({ method: 'PATCH', url: '/api/auth/profile',
      payload: { fullName: 'Hacker' },
      headers: { 'content-type': 'application/json' } });
    expect(res.statusCode).toBe(401);
  });
});

describe('Auth: logout', () => {
  it('logout endpoint returns ok', async () => {
    const u = await register();
    const res = await app.inject({ method: 'POST', url: '/api/auth/logout',
      headers: { authorization: `Bearer ${u.token}` } });
    expect(res.statusCode).toBe(200);
    expect(res.json().ok).toBe(true);
  });

  it('register creates org + membership', async () => {
    const u = await register();
    const me = await app.inject({ method: 'GET', url: '/api/auth/me',
      headers: { authorization: `Bearer ${u.token}` } });
    expect(me.statusCode).toBe(200);
    expect(me.json().memberships.length).toBeGreaterThanOrEqual(1);
    expect(me.json().memberships[0].roleKey).toBe('owner');
  });
});
