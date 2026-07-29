import './../test/setup.js';
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { buildApp } from '../index.js';
import { db } from '../db/database.js';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;
beforeAll(async () => { app = await buildApp(); await app.ready(); });
beforeEach(() => { for (const table of ['timeline_events','vendors','layouts','event_memberships','events','organization_memberships','organizations','users','audit_logs']) { try { db.prepare(`DELETE FROM ${table}`).run(); } catch {} } });

describe('Event-week packets', () => {
  it('gives the operations team the detailed layout, timeline, vendors, and staffing packet', async () => {
    const registration = await app.inject({ method: 'POST', url: '/api/auth/register', payload: { email: `packet-${Math.random()}@test.com`, password: 'password123', fullName: 'Venue Manager', orgName: 'Seven Paths Manor' } });
    const token = registration.json().token; const orgId = registration.json().organizationId;
    const created = await app.inject({ method: 'POST', url: '/api/events', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, payload: { organizationId: orgId, title: 'Packet Wedding', guestCount: 80 } });
    const eventId = created.json().event.id;
    const vendor = await app.inject({ method: 'POST', url: `/api/orgs/${orgId}/vendors`, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, payload: { name: 'Bluebird Catering', eventId, category: 'catering', metadata: { loadIn: '11:00 AM loading dock' } } });
    await app.inject({ method: 'POST', url: `/api/events/${eventId}/timeline`, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, payload: { title: 'Ceremony', startsAt: '2026-10-01T16:00:00.000Z', vendorId: vendor.json().vendor.id } });
    const layout = await app.inject({ method: 'POST', url: '/api/layouts', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, payload: { organizationId: orgId, eventId, name: 'Reception', payload: { items: [] } } });
    db.prepare(`UPDATE layouts SET approval_status = 'approved' WHERE id = ?`).run(layout.json().layout.id);
    const packet = await app.inject({ method: 'GET', url: `/api/events/${eventId}/setup-packet`, headers: { authorization: `Bearer ${token}` } });
    expect(packet.statusCode).toBe(200);
    expect(packet.json().packet.layout.name).toBe('Reception');
    expect(packet.json().packet.timeline[0].vendor_name).toBe('Bluebird Catering');
    expect(packet.json().packet.vendorLoadIn[0].loadIn).toBe('11:00 AM loading dock');
    const ownerSchedule = await app.inject({ method: 'GET', url: `/api/events/${eventId}/couple-schedule`, headers: { authorization: `Bearer ${token}` } });
    expect(ownerSchedule.statusCode).toBe(403);
  });
});
