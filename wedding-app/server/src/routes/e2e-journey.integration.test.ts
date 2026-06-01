/**
 * End-to-end journey test — simulates the complete venue owner workflow:
 *
 *   1. Register a new venue owner
 *   2. Create an event
 *   3. Add guests with dietary requirements
 *   4. Create a vendor + log payment
 *   5. Add budget items
 *   6. Add timeline items
 *   7. Create + sign a contract
 *   8. Guest submits RSVP via public portal
 *   9. Verify dashboard data is correct
 *  10. Export data backup
 *  11. Duplicate event
 *  12. Change password + re-login
 */
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

const req = (token: string, method: 'GET'|'POST'|'PATCH'|'DELETE', url: string, payload?: unknown) =>
  app.inject({ method, url, headers: payload !== undefined
    ? { authorization: `Bearer ${token}`, 'content-type': 'application/json' }
    : { authorization: `Bearer ${token}` }, payload: payload as never });

describe('Complete venue owner journey', () => {
  it('full workflow: register → event → guests → vendor → budget → portal RSVP → export → duplicate → password change', async () => {
    // ═══ 1. Register ═══════════════════════════════════════
    const email = 'owner@smartvenue.com';
    const regRes = await app.inject({ method: 'POST', url: '/api/auth/register',
      payload: { email, password: 'SecurePass123!', fullName: 'Jane Venue', orgName: 'Smart Venue Co' },
      headers: { 'content-type': 'application/json' } });
    expect(regRes.statusCode).toBe(201);
    let token = regRes.json().token;
    const orgId = regRes.json().organizationId;

    // Verify we're an owner
    const me = await req(token, 'GET', '/api/auth/me');
    expect(me.json().memberships[0].roleKey).toBe('owner');

    // ═══ 2. Create event ═══════════════════════════════════
    const evtRes = await req(token, 'POST', '/api/events', {
      organizationId: orgId, title: 'Johnson-Park Wedding',
      startDate: '2026-11-15', guestCount: 120, budgetCents: 6000000,
    });
    expect(evtRes.statusCode).toBe(201);
    const eventId = evtRes.json().event.id;

    // ═══ 3. Add guests ═════════════════════════════════════
    const g1 = await req(token, 'POST', `/api/events/${eventId}/guests`, {
      fullName: 'Sarah Johnson', email: 'sarah@test.com', rsvpStatus: 'pending',
      tableAssignment: 'Head Table', dietaryRestrictions: 'Vegetarian',
    });
    expect(g1.statusCode).toBe(201);
    const guestId = g1.json().guest.id;

    await req(token, 'POST', `/api/events/${eventId}/guests`, {
      fullName: 'James Park', email: 'james@test.com', rsvpStatus: 'pending',
      tableAssignment: 'Head Table',
    });

    // Bulk import
    const bulkRes = await req(token, 'POST', `/api/events/${eventId}/guests/bulk`, {
      mode: 'append',
      guests: [
        { fullName: 'Guest A' },
        { fullName: 'Guest B', email: 'b@test.com', dietaryRestrictions: 'Vegan' },
        { fullName: 'Guest C', tableAssignment: 'Table 1' },
      ],
    });
    expect([200, 201]).toContain(bulkRes.statusCode);
    expect(bulkRes.json().inserted).toBe(3);

    // ═══ 4. Create vendor + payment ════════════════════════
    const vRes = await req(token, 'POST', `/api/orgs/${orgId}/vendors`, {
      name: 'Elegant Florals', category: 'Florist', contactName: 'Maria',
      email: 'maria@florals.com', contractAmountCents: 400000, eventId,
    });
    expect(vRes.statusCode).toBe(201);
    const vendorId = vRes.json().vendor.id;

    await req(token, 'POST', `/api/vendors/${vendorId}/payments`, {
      amountCents: 200000, paidAt: '2026-06-01', method: 'check',
    });

    // ═══ 5. Budget items ═══════════════════════════════════
    await req(token, 'POST', `/api/events/${eventId}/budget`, {
      category: 'Venue', title: 'Rental Fee', plannedCents: 2000000, actualCents: 2000000,
    });
    await req(token, 'POST', `/api/events/${eventId}/budget`, {
      category: 'Florals', title: 'Arrangements', plannedCents: 400000,
    });

    const budgetRes = await req(token, 'GET', `/api/events/${eventId}/budget`);
    expect(budgetRes.json().items).toHaveLength(2);
    expect(budgetRes.json().totals.planned).toBe(2400000);

    // ═══ 6. Timeline ═══════════════════════════════════════
    await req(token, 'POST', `/api/events/${eventId}/timeline`, {
      title: 'Ceremony', startsAt: '2026-11-15T16:00:00Z', durationMin: 30,
    });
    await req(token, 'POST', `/api/events/${eventId}/timeline`, {
      title: 'Reception', startsAt: '2026-11-15T18:00:00Z', durationMin: 240,
    });

    const tlRes = await req(token, 'GET', `/api/events/${eventId}/timeline`);
    expect(tlRes.json().items).toHaveLength(2);

    // ═══ 7. Contract ═══════════════════════════════════════
    const cRes = await req(token, 'POST', `/api/events/${eventId}/contracts`, {
      title: 'Venue Agreement', recipientName: 'Sarah Johnson', amountCents: 2000000,
    });
    expect(cRes.statusCode).toBe(201);
    const contractId = cRes.json().contract.id;

    // Send + sign
    await req(token, 'POST', `/api/contracts/${contractId}/send`);
    const signRes = await req(token, 'POST', `/api/contracts/${contractId}/sign`, { signature: 'Sarah Johnson' });
    expect(signRes.json().contract.status).toBe('signed');

    // ═══ 8. Public portal RSVP ═════════════════════════════
    const portalRes = await app.inject({ method: 'GET', url: `/api/portal/${eventId}/info` });
    expect(portalRes.statusCode).toBe(200);
    expect(portalRes.json().guests.length).toBeGreaterThanOrEqual(1);

    // Guest submits RSVP
    const rsvpRes = await app.inject({ method: 'POST', url: `/api/portal/${eventId}/rsvp`,
      payload: { guestId, attending: true, mealChoice: 'vegetarian', notes: 'So excited!' },
      headers: { 'content-type': 'application/json' } });
    expect(rsvpRes.statusCode).toBe(201);

    // ═══ 9. Verify data consistency ════════════════════════
    const guestsRes = await req(token, 'GET', `/api/events/${eventId}/guests`);
    expect(guestsRes.json().counts.attending).toBe(1);
    expect(guestsRes.json().counts.pending).toBe(4); // 5 total - 1 attending

    const vendorsRes = await req(token, 'GET', `/api/orgs/${orgId}/vendors`);
    expect(vendorsRes.json().vendors).toHaveLength(1);
    expect(vendorsRes.json().vendors[0].amount_paid_cents).toBe(200000);

    // Cross-org guest search
    const crossRes = await req(token, 'GET', `/api/orgs/${orgId}/guests?search=Sarah`);
    expect(crossRes.json().guests).toHaveLength(1);
    expect(crossRes.json().guests[0].full_name).toBe('Sarah Johnson');

    // ═══ 10. Data export ═══════════════════════════════════
    const backupRes = await req(token, 'GET', `/api/orgs/${orgId}/export/backup.json`);
    expect(backupRes.statusCode).toBe(200);
    const backup = JSON.parse(backupRes.body);
    expect(backup.summary.eventCount).toBe(1);
    expect(backup.summary.guestCount).toBe(5);
    expect(backup.summary.vendorCount).toBe(1);

    // ═══ 11. Duplicate event ═══════════════════════════════
    const dupRes = await req(token, 'POST', `/api/events/${eventId}/duplicate`);
    expect([200, 201]).toContain(dupRes.statusCode);
    expect(dupRes.json().event.title).toBe('Johnson-Park Wedding (Copy)');
    expect(dupRes.json().event.status).toBe('lead');

    // Verify both exist
    const listRes = await req(token, 'GET', `/api/orgs/${orgId}/events`);
    expect(listRes.json().events).toHaveLength(2);

    // ═══ 12. Password change + re-login ════════════════════
    const pwdRes = await req(token, 'POST', '/api/auth/change-password', {
      currentPassword: 'SecurePass123!', newPassword: 'EvenMoreSecure456!',
    });
    expect(pwdRes.json().ok).toBe(true);

    // Old token should be invalidated
    const oldTokenRes = await req(token, 'GET', '/api/auth/me');
    expect(oldTokenRes.statusCode).toBe(401);

    // Login with new password
    const loginRes = await app.inject({ method: 'POST', url: '/api/auth/login',
      payload: { email, password: 'EvenMoreSecure456!' },
      headers: { 'content-type': 'application/json' } });
    expect(loginRes.statusCode).toBe(200);
    token = loginRes.json().token;

    // Verify we can still access data
    const finalMe = await req(token, 'GET', '/api/auth/me');
    expect(finalMe.statusCode).toBe(200);
    expect(finalMe.json().user.email).toBe(email);

    // ═══ 13. Audit log has full history ════════════════════
    const auditRes = await req(token, 'GET', `/api/orgs/${orgId}/audit`);
    expect(auditRes.json().logs.length).toBeGreaterThanOrEqual(5);
    const actions = auditRes.json().logs.map((l: any) => l.action);
    expect(actions).toContain('event.create');
    expect(actions).toContain('guest.create');
    expect(actions).toContain('rsvp.submit');
    expect(actions).toContain('contract.create');
  });
});
