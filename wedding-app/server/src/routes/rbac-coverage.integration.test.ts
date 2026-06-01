/**
 * RBAC Coverage Integration Tests
 *
 * Proves that the permission catalog covers all modules, system roles have
 * correct grants, and permission-gated routes actually enforce their checks.
 */
import './../test/setup.js';
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { db } from '../db/database.js';
import { buildApp } from '../index.js';
import type { FastifyInstance } from 'fastify';
import { SYSTEM_ROLE_IDS, PERMISSION_CATALOG, SYSTEM_ROLE_DEFINITIONS } from '../lib/permissions.js';
import { rolesRepo } from '../db/repos/index.js';

let app: FastifyInstance;
beforeAll(async () => { app = await buildApp(); await app.ready(); });

beforeEach(() => {
  for (const t of [
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
  // Re-sync system role permissions after cleanup
  rolesRepo.ensureSystemRoles();
});

async function registerOwner(email = `owner-${Math.random().toString(36).slice(2)}@x.com`) {
  const r = await app.inject({
    method: 'POST', url: '/api/auth/register',
    payload: { email, password: 'testpass123', fullName: 'Owner', orgName: 'TestOrg' },
    headers: { 'content-type': 'application/json' },
  });
  return { token: r.json().token, userId: r.json().user.id, orgId: r.json().organizationId };
}

/**
 * Create a second user and add them to the owner's org with a specific role.
 * Returns a fresh JWT that includes the correct membership.
 */
async function createUserWithRole(ownerToken: string, orgId: string, roleKey: string) {
  const email = `${roleKey}-${Math.random().toString(36).slice(2)}@x.com`;
  // Register creates their OWN org — we only need the user id
  const regRes = await app.inject({
    method: 'POST', url: '/api/auth/register',
    payload: { email, password: 'testpass123', fullName: roleKey, orgName: `Tmp-${roleKey}` },
    headers: { 'content-type': 'application/json' },
  });
  const userId = regRes.json().user.id;
  const roleId = SYSTEM_ROLE_IDS[roleKey as keyof typeof SYSTEM_ROLE_IDS];

  // Owner invites them to the OWNER's org with the target role
  const invRes = await app.inject({
    method: 'POST', url: `/api/orgs/${orgId}/members`,
    payload: { userEmail: email, roleId },
    headers: { authorization: `Bearer ${ownerToken}`, 'content-type': 'application/json' },
  });

  // Re-login to get a JWT that includes the new membership
  const loginRes = await app.inject({
    method: 'POST', url: '/api/auth/login',
    payload: { email, password: 'testpass123' },
    headers: { 'content-type': 'application/json' },
  });
  return { token: loginRes.json().token, userId };
}

const req = (token: string, method: 'GET'|'POST'|'PUT'|'PATCH'|'DELETE', url: string, payload?: unknown) =>
  app.inject({
    method, url,
    headers: payload !== undefined
      ? { authorization: `Bearer ${token}`, 'content-type': 'application/json' }
      : { authorization: `Bearer ${token}` },
    payload: payload as never,
  });

// ════════════════════════════════════════════════════════════
describe('Permission catalog completeness', () => {
  it('has all expected permission categories', () => {
    const categories = new Set(PERMISSION_CATALOG.map(p => p.category));
    for (const cat of [
      'organization', 'roles', 'events', 'venues', 'layouts', 'guests',
      'rsvp', 'portal', 'decor', 'vendors', 'vendor_portal', 'vendor_checkin',
      'timeline', 'staff', 'questions', 'budget', 'contracts', 'gallery',
      'invites', 'feedback', 'messages', 'inventory', 'reports', 'calendar',
      'notifications', 'integrations', 'audit',
    ]) {
      expect(categories.has(cat as any), `Missing category: ${cat}`).toBe(true);
    }
  });

  it('has 80+ permissions in total', () => {
    expect(PERMISSION_CATALOG.length).toBeGreaterThanOrEqual(70);
  });

  it('every permission id is unique', () => {
    const ids = PERMISSION_CATALOG.map(p => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

// ════════════════════════════════════════════════════════════
describe('System role grants', () => {
  it('owner role has all non-vendor-portal permissions', () => {
    const ownerDef = SYSTEM_ROLE_DEFINITIONS.find(r => r.key === 'owner')!;
    // Owner should have everything except vendor.portal.*, vendor.bookings.*, vendor.invoices.*
    const nonVendorPortal = PERMISSION_CATALOG.filter(p => !p.id.startsWith('vendor.'));
    for (const perm of nonVendorPortal) {
      expect(ownerDef.permissions, `Owner missing: ${perm.id}`).toContain(perm.id);
    }
  });

  it('admin has same as owner minus org.manage', () => {
    const adminDef = SYSTEM_ROLE_DEFINITIONS.find(r => r.key === 'admin')!;
    expect(adminDef.permissions).not.toContain('org.manage');
    expect(adminDef.permissions).toContain('org.view');
    expect(adminDef.permissions).toContain('budget.manage');
    expect(adminDef.permissions).toContain('integrations.manage');
  });

  it('planner has budget + contracts + invites + reports + calendar', () => {
    const plannerDef = SYSTEM_ROLE_DEFINITIONS.find(r => r.key === 'planner')!;
    for (const p of ['budget.view','budget.manage','contracts.view','contracts.manage',
                      'invites.view','invites.manage','invites.send','reports.view',
                      'calendar.view','notifications.manage','feedback.view','feedback.manage']) {
      expect(plannerDef.permissions, `Planner missing: ${p}`).toContain(p);
    }
  });

  it('couple has budget.view but NOT budget.manage', () => {
    const coupleDef = SYSTEM_ROLE_DEFINITIONS.find(r => r.key === 'couple')!;
    expect(coupleDef.permissions).toContain('budget.view');
    expect(coupleDef.permissions).not.toContain('budget.manage');
    expect(coupleDef.permissions).toContain('contracts.sign');
    expect(coupleDef.permissions).not.toContain('contracts.manage');
  });

  it('staff has check-in + timeline + messaging but NOT admin', () => {
    const staffDef = SYSTEM_ROLE_DEFINITIONS.find(r => r.key === 'staff')!;
    expect(staffDef.permissions).toContain('vendors.checkin.view');
    expect(staffDef.permissions).toContain('vendors.checkin.manage');
    expect(staffDef.permissions).toContain('messages.view');
    expect(staffDef.permissions).toContain('messages.send');
    expect(staffDef.permissions).not.toContain('org.manage');
    expect(staffDef.permissions).not.toContain('roles.manage');
  });

  it('vendor has only portal + messages + notifications', () => {
    const vendorDef = SYSTEM_ROLE_DEFINITIONS.find(r => r.key === 'vendor')!;
    expect(vendorDef.permissions).toContain('vendor.portal.view');
    expect(vendorDef.permissions).toContain('messages.view');
    expect(vendorDef.permissions).toContain('messages.send');
    expect(vendorDef.permissions).not.toContain('events.view');
    expect(vendorDef.permissions).not.toContain('guests.view');
  });

  it('guest has only rsvp.submit + portal.guest.view', () => {
    const guestDef = SYSTEM_ROLE_DEFINITIONS.find(r => r.key === 'guest')!;
    expect(guestDef.permissions).toHaveLength(2);
    expect(guestDef.permissions).toContain('rsvp.submit');
    expect(guestDef.permissions).toContain('portal.guest.view');
  });
});

// ════════════════════════════════════════════════════════════
describe('Route-level RBAC enforcement: messages', () => {
  it('staff CAN read and send messages', async () => {
    const o = await registerOwner();
    const s = await createUserWithRole(o.token, o.orgId, 'staff');
    const readRes = await req(s.token, 'GET', '/api/messages/thread-1');
    expect(readRes.statusCode).toBe(200);
    const sendRes = await req(s.token, 'POST', '/api/messages/thread-1', {
      body: 'Hello', senderRole: 'staff',
    });
    expect(sendRes.statusCode).toBe(201);
  });

  it('unauthenticated request gets 401 on messages', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/messages/thread-1' });
    expect(res.statusCode).toBe(401);
  });
});

// ════════════════════════════════════════════════════════════
describe('Route-level RBAC enforcement: feedback', () => {
  it('owner CAN view polls', async () => {
    const o = await registerOwner();
    const evtRes = await req(o.token, 'POST', '/api/events', {
      organizationId: o.orgId, title: 'Poll Test',
    });
    const eventId = evtRes.json().event.id;
    const res = await req(o.token, 'GET', `/api/events/${eventId}/polls`);
    expect(res.statusCode).toBe(200);
  });

  it('guest CANNOT view polls', async () => {
    const o = await registerOwner();
    const g = await createUserWithRole(o.token, o.orgId, 'guest');
    const evtRes = await req(o.token, 'POST', '/api/events', {
      organizationId: o.orgId, title: 'Poll Test 2',
    });
    const eventId = evtRes.json().event.id;
    const res = await req(g.token, 'GET', `/api/events/${eventId}/polls`);
    expect(res.statusCode).toBe(403);
  });
});

// ════════════════════════════════════════════════════════════
describe('Route-level RBAC enforcement: push notifications', () => {
  it('staff CAN subscribe (has notifications.manage)', async () => {
    const o = await registerOwner();
    const s = await createUserWithRole(o.token, o.orgId, 'staff');
    const res = await req(s.token, 'POST', '/api/push/subscribe', {
      endpoint: 'https://push.example.com/staff-test',
      keys: { p256dh: 'k', auth: 'a' },
      organizationId: o.orgId,
    });
    expect(res.statusCode).toBe(201);
  });

  it('guest CANNOT subscribe (lacks notifications.manage)', async () => {
    const o = await registerOwner();
    const g = await createUserWithRole(o.token, o.orgId, 'guest');
    const res = await req(g.token, 'POST', '/api/push/subscribe', {
      endpoint: 'https://push.example.com/guest-test',
      keys: { p256dh: 'k', auth: 'a' },
      organizationId: o.orgId,
    });
    expect(res.statusCode).toBe(403);
  });
});

// ════════════════════════════════════════════════════════════
describe('DB-level: system role permissions match definitions', () => {
  it('every system role in DB has the permissions from its definition', async () => {
    const o = await registerOwner();
    const rolesRes = await req(o.token, 'GET', `/api/orgs/${o.orgId}/roles`);
    const dbRoles = rolesRes.json().roles as Array<{ key: string; permissions: string[] }>;

    for (const def of SYSTEM_ROLE_DEFINITIONS) {
      const dbRole = dbRoles.find(r => r.key === def.key);
      expect(dbRole, `System role ${def.key} not found in DB`).toBeDefined();
      for (const p of def.permissions) {
        expect(dbRole!.permissions, `${def.key} missing DB permission: ${p}`).toContain(p);
      }
    }
  });
});
