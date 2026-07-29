import './../test/setup.js';
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { buildApp } from '../index.js';
import { db } from '../db/database.js';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;
beforeAll(async () => { app = await buildApp(); await app.ready(); });
beforeEach(() => { for (const table of ['final_review_change_requests','event_memberships','events','organization_memberships','organizations','users','audit_logs']) { try { db.prepare(`DELETE FROM ${table}`).run(); } catch {} } });

describe('Final Review change requests', () => {
  it('records a request and leaves the final decision with the venue manager', async () => {
    const registration = await app.inject({ method: 'POST', url: '/api/auth/register', payload: { email: `changes-${Math.random()}@test.com`, password: 'password123', fullName: 'Manager', orgName: 'Seven Paths Manor' } });
    const token = registration.json().token; const orgId = registration.json().organizationId;
    const created = await app.inject({ method: 'POST', url: '/api/events', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, payload: { organizationId: orgId, title: 'Review Wedding' } });
    const eventId = created.json().event.id;
    const requested = await app.inject({ method: 'POST', url: `/api/events/${eventId}/final-review/change-requests`, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, payload: { detail: 'Please move the family seating away from the speaker.' } });
    expect(requested.statusCode).toBe(201); expect(requested.json().request.requested_role).toBe('manager');
    const requestId = requested.json().request.id;
    const decided = await app.inject({ method: 'PATCH', url: `/api/events/${eventId}/final-review/change-requests/${requestId}`, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, payload: { status: 'accepted', managerNote: 'Venue team will revise the seating plan.' } });
    expect(decided.statusCode).toBe(200); expect(decided.json().request.status).toBe('accepted');
    const list = await app.inject({ method: 'GET', url: `/api/events/${eventId}/final-review/change-requests`, headers: { authorization: `Bearer ${token}` } });
    expect(list.json().requests[0]).toMatchObject({ status: 'accepted', manager_note: 'Venue team will revise the seating plan.' });
  });
});
