import './../test/setup.js';
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { buildApp } from '../index.js';
import { db } from '../db/database.js';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;
beforeAll(async () => { app = await buildApp(); await app.ready(); });
beforeEach(() => { for (const table of ['events','venues','organization_memberships','organizations','users']) { try { db.prepare(`DELETE FROM ${table}`).run(); } catch {} } });

describe('Space calendar', () => {
  it('returns approved spaces and their event commitments', async () => {
    const registration = await app.inject({ method: 'POST', url: '/api/auth/register', payload: { email: `space-${Math.random()}@test.com`, password: 'password123', fullName: 'Owner', orgName: 'Seven Paths Manor' } });
    const token = registration.json().token; const orgId = registration.json().organizationId;
    const venue = await app.inject({ method: 'POST', url: `/api/orgs/${orgId}/venues`, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, payload: { name: 'Grand Hall', capacity: 100, width: 40, height: 30, masterLayout: { zones: [] } } });
    await app.inject({ method: 'PATCH', url: `/api/venues/${venue.json().venue.id}`, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, payload: { approvalStatus: 'approved', metadata: { approvalOverrideReason: 'Reviewed' } } });
    await app.inject({ method: 'POST', url: '/api/events', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, payload: { organizationId: orgId, title: 'Space Wedding', startDate: '2027-04-10', venueId: venue.json().venue.id, guestCount: 80 } });
    const res = await app.inject({ method: 'GET', url: `/api/orgs/${orgId}/space-calendar?startsAt=2027-04-01&endsAt=2027-04-30`, headers: { authorization: `Bearer ${token}` } });
    expect(res.statusCode).toBe(200);
    expect(res.json().calendar.spaces[0]).toMatchObject({ name: 'Grand Hall', capacity: 100 });
    expect(res.json().calendar.commitments[0]).toMatchObject({ title: 'Space Wedding', venue_name: 'Grand Hall' });
  });
});
