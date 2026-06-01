/**
 * End-to-end portal flow tests — simulates the complete guest RSVP journey
 * from portal info → guest selection → RSVP submission → verification.
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

async function setupEvent() {
  const r = await app.inject({ method: 'POST', url: '/api/auth/register',
    payload: { email: `pf-${Math.random().toString(36).slice(2)}@x.com`, password: 'testpass123', fullName: 'Owner', orgName: 'Venue' },
    headers: { 'content-type': 'application/json' } });
  const token = r.json().token, orgId = r.json().organizationId;
  const e = await app.inject({ method: 'POST', url: '/api/events',
    payload: { organizationId: orgId, title: 'Smith Wedding', startDate: '2026-09-12', guestCount: 100 },
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' } });
  const eventId = e.json().event.id;

  // Add guests
  const g1 = await app.inject({ method: 'POST', url: `/api/events/${eventId}/guests`,
    payload: { fullName: 'Alice Johnson', email: 'alice@test.com', tableAssignment: 'Table 1' },
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' } });
  const g2 = await app.inject({ method: 'POST', url: `/api/events/${eventId}/guests`,
    payload: { fullName: 'Bob Williams', email: 'bob@test.com' },
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' } });

  return { token, orgId, eventId, guestId1: g1.json().guest.id, guestId2: g2.json().guest.id };
}

describe('Public portal: full RSVP flow', () => {
  it('1. Portal info returns event + guest list (no auth needed)', async () => {
    const s = await setupEvent();
    const res = await app.inject({ method: 'GET', url: `/api/portal/${s.eventId}/info` });
    expect(res.statusCode).toBe(200);
    expect(res.json().event.title).toBe('Smith Wedding');
    expect(res.json().event.startDate).toBe('2026-09-12');
    expect(res.json().guests).toHaveLength(2);
    expect(res.json().guests[0].fullName).toBe('Alice Johnson');
    expect(res.json().guests[0].tableAssignment).toBe('Table 1');
  });

  it('2. Guest submits RSVP (attending + meal choice)', async () => {
    const s = await setupEvent();
    const res = await app.inject({ method: 'POST', url: `/api/portal/${s.eventId}/rsvp`,
      payload: { guestId: s.guestId1, attending: true, mealChoice: 'vegetarian', notes: 'Looking forward!' },
      headers: { 'content-type': 'application/json' } });
    expect(res.statusCode).toBe(201);
    expect(res.json().ok).toBe(true);
    expect(res.json().rsvpId).toBeTruthy();
  });

  it('3. RSVP updates guest status to attending', async () => {
    const s = await setupEvent();
    await app.inject({ method: 'POST', url: `/api/portal/${s.eventId}/rsvp`,
      payload: { guestId: s.guestId1, attending: true },
      headers: { 'content-type': 'application/json' } });

    // Verify via authenticated guest list
    const guests = await app.inject({ method: 'GET', url: `/api/events/${s.eventId}/guests`,
      headers: { authorization: `Bearer ${s.token}` } });
    expect(guests.json().counts.attending).toBe(1);
    expect(guests.json().counts.pending).toBe(1); // g2 still pending
  });

  it('4. Guest declines RSVP', async () => {
    const s = await setupEvent();
    await app.inject({ method: 'POST', url: `/api/portal/${s.eventId}/rsvp`,
      payload: { guestId: s.guestId2, attending: false },
      headers: { 'content-type': 'application/json' } });

    const guests = await app.inject({ method: 'GET', url: `/api/events/${s.eventId}/guests`,
      headers: { authorization: `Bearer ${s.token}` } });
    expect(guests.json().counts.declined).toBe(1);
  });

  it('5. Portal rejects RSVP for non-existent guest', async () => {
    const s = await setupEvent();
    const res = await app.inject({ method: 'POST', url: `/api/portal/${s.eventId}/rsvp`,
      payload: { guestId: 'fake-guest-id', attending: true },
      headers: { 'content-type': 'application/json' } });
    expect(res.statusCode).toBe(400);
  });

  it('6. Portal returns 404 for non-existent event', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/portal/fake-event-id/info' });
    expect(res.statusCode).toBe(404);
  });

  it('7. Multiple RSVPs from same guest (latest wins)', async () => {
    const s = await setupEvent();
    // First: attend
    await app.inject({ method: 'POST', url: `/api/portal/${s.eventId}/rsvp`,
      payload: { guestId: s.guestId1, attending: true },
      headers: { 'content-type': 'application/json' } });
    // Then: decline
    await app.inject({ method: 'POST', url: `/api/portal/${s.eventId}/rsvp`,
      payload: { guestId: s.guestId1, attending: false },
      headers: { 'content-type': 'application/json' } });

    const guests = await app.inject({ method: 'GET', url: `/api/events/${s.eventId}/guests`,
      headers: { authorization: `Bearer ${s.token}` } });
    expect(guests.json().counts.declined).toBe(1);
    expect(guests.json().counts.attending).toBe(0);
  });

  it('8. Portal includes theme config for styling', async () => {
    const s = await setupEvent();
    const res = await app.inject({ method: 'GET', url: `/api/portal/${s.eventId}/info` });
    // theme may be null if no config set, but the field should exist
    expect(res.json()).toHaveProperty('theme');
  });
});
