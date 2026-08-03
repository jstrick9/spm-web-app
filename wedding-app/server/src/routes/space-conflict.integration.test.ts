import './../test/setup.js';
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { buildApp } from '../index.js';
import { db } from '../db/database.js';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;

beforeAll(async () => {
  app = await buildApp();
  await app.ready();
});

beforeEach(() => {
  for (const t of ['events', 'venues', 'organization_memberships', 'organizations', 'users']) {
    try { db.prepare(`DELETE FROM ${t}`).run(); } catch { /* table may not exist in this DB */ }
  }
});

async function register(prefix: string) {
  const r = await app.inject({
    method: 'POST', url: '/api/auth/register',
    payload: { email: `${prefix}-${Math.random()}@test.com`, password: 'password123', fullName: 'Owner', orgName: 'Space Venue' },
  });
  return { token: r.json().token, orgId: r.json().organizationId };
}

function authed(token: string, method: 'POST' | 'PATCH' | 'GET' | 'DELETE', url: string, payload?: Record<string, unknown>) {
  return app.inject({
    method,
    url,
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    payload,
  });
}

function createEvent(token: string, orgId: string, payload: Record<string, unknown>) {
  return authed(token, 'POST', '/api/events', { organizationId: orgId, title: 'Test Wedding', ...payload });
}

describe('Venue space conflict guard', () => {
  it('blocks creating an event on a space already booked for an overlapping date', async () => {
    const { token, orgId } = await register('conflict');
    const v = await authed(token, 'POST', `/api/orgs/${orgId}/venues`, { name: 'Grand Ballroom', capacity: 200 });
    const venueId = v.json().venue.id;

    const first = await createEvent(token, orgId, { venueId, startDate: '2026-09-12', endDate: '2026-09-12', status: 'booked' });
    expect(first.statusCode).toBe(201);

    const second = await createEvent(token, orgId, { venueId, startDate: '2026-09-12', endDate: '2026-09-12', status: 'booked' });
    expect(second.statusCode).toBe(409);
    expect(second.json().error).toBe('venue-space-conflict');
    expect(second.json().details.conflicts.length).toBe(1);
    expect(second.json().details.conflicts[0].title).toBe('Test Wedding');
  });

  it('blocks overlapping ranges even when the event is a lead', async () => {
    const { token, orgId } = await register('conflict-lead');
    const v = await authed(token, 'POST', `/api/orgs/${orgId}/venues`, { name: 'Lawn', capacity: 300 });
    const venueId = v.json().venue.id;
    await createEvent(token, orgId, { venueId, startDate: '2026-09-12', endDate: '2026-09-14', status: 'booked' });
    const lead = await createEvent(token, orgId, { venueId, startDate: '2026-09-14', endDate: '2026-09-14', status: 'lead' });
    expect(lead.statusCode).toBe(409);
  });

  it('allows non-overlapping dates and different spaces', async () => {
    const { token, orgId } = await register('conflict-ok');
    const v1 = await authed(token, 'POST', `/api/orgs/${orgId}/venues`, { name: 'Ballroom', capacity: 200 });
    const v2 = await authed(token, 'POST', `/api/orgs/${orgId}/venues`, { name: 'Lawn', capacity: 300 });
    await createEvent(token, orgId, { venueId: v1.json().venue.id, startDate: '2026-09-12', status: 'booked' });
    const sameSpaceLater = await createEvent(token, orgId, { venueId: v1.json().venue.id, startDate: '2026-10-01', status: 'booked' });
    expect(sameSpaceLater.statusCode).toBe(201);
    const otherSpaceSameDay = await createEvent(token, orgId, { venueId: v2.json().venue.id, startDate: '2026-09-12', status: 'booked' });
    expect(otherSpaceSameDay.statusCode).toBe(201);
  });

  it('allows the same space for cancelled and lost events', async () => {
    const { token, orgId } = await register('conflict-cancelled');
    const v = await authed(token, 'POST', `/api/orgs/${orgId}/venues`, { name: 'Tent', capacity: 100 });
    const venueId = v.json().venue.id;
    await createEvent(token, orgId, { venueId, startDate: '2026-09-12', status: 'cancelled' });
    await createEvent(token, orgId, { venueId, startDate: '2026-09-12', status: 'lost' });
    const ok = await createEvent(token, orgId, { venueId, startDate: '2026-09-12', status: 'booked' });
    expect(ok.statusCode).toBe(201);
  });

  it('allows an explicit bookingConflictOverrideReason with an audit trail', async () => {
    const { token, orgId } = await register('conflict-override');
    const v = await authed(token, 'POST', `/api/orgs/${orgId}/venues`, { name: 'Barn', capacity: 150 });
    const venueId = v.json().venue.id;
    await createEvent(token, orgId, { venueId, startDate: '2026-09-12', status: 'booked' });
    const overridden = await createEvent(token, orgId, {
      venueId, startDate: '2026-09-12', status: 'booked',
      metadata: { bookingConflictOverrideReason: 'Rehearsal only; ceremony uses the lawn.' },
    });
    expect(overridden.statusCode).toBe(201);
    const audits = db.prepare(`SELECT action, details FROM audit_logs WHERE organization_id = ? AND action = 'event.booking_conflict.overridden'`).all(orgId) as Array<{ action: string; details: string }>;
    expect(audits.length).toBe(1);
    expect(JSON.parse(audits[0].details).reason).toBe('Rehearsal only; ceremony uses the lawn.');
  });

  it('blocks a PATCH that would create an overlap, and allows it with override', async () => {
    const { token, orgId } = await register('conflict-patch');
    const v = await authed(token, 'POST', `/api/orgs/${orgId}/venues`, { name: 'Courtyard', capacity: 80 });
    const venueId = v.json().venue.id;
    const e1 = await createEvent(token, orgId, { venueId, startDate: '2026-09-12', status: 'booked' });
    const e2 = await createEvent(token, orgId, { startDate: '2026-09-12', status: 'booked' });
    const e1Id = e1.json().event.id;
    const e2Id = e2.json().event.id;

    const blocked = await authed(token, 'PATCH', `/api/events/${e2Id}`, { venueId, startDate: '2026-09-12' });
    expect(blocked.statusCode).toBe(409);
    expect(blocked.json().error).toBe('venue-space-conflict');

    // Updating the same event to itself must not self-conflict.
    const selfOk = await authed(token, 'PATCH', `/api/events/${e1Id}`, { endDate: '2026-09-13' });
    expect(selfOk.statusCode).toBe(200);

    const withOverride = await authed(token, 'PATCH', `/api/events/${e2Id}`, {
      venueId, startDate: '2026-09-12',
      metadata: { bookingConflictOverrideReason: 'Split ceremony/reception; venue approved.' },
    });
    expect(withOverride.statusCode).toBe(200);
  });

  it('blocks venue assignment via PATCH when another event occupies the space', async () => {
    const { token, orgId } = await register('conflict-assign');
    const v = await authed(token, 'POST', `/api/orgs/${orgId}/venues`, { name: 'Terrace', capacity: 60 });
    const venueId = v.json().venue.id;
    await createEvent(token, orgId, { venueId, startDate: '2026-09-12', status: 'booked' });
    const unassigned = await createEvent(token, orgId, { startDate: '2026-09-12', status: 'booked' });
    const res = await authed(token, 'PATCH', `/api/events/${unassigned.json().event.id}`, { venueId });
    expect(res.statusCode).toBe(409);
    expect(res.json().error).toBe('venue-space-conflict');
  });
});
