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
    'layout_versions','layouts','timeline_events','vendor_portal_tokens','vendor_payments','vendors','rsvp_submissions','guests',
    'event_memberships','events','organization_memberships','organizations','users','audit_logs',
  ]) { try { db.prepare(`DELETE FROM ${t}`).run(); } catch {} }
  try { db.prepare(`DELETE FROM role_permissions WHERE role_id IN (SELECT id FROM roles WHERE is_system = 0)`).run(); db.prepare(`DELETE FROM roles WHERE is_system = 0`).run(); } catch {}
  rolesRepo.ensureSystemRoles();
});

async function setup() {
  const r = await app.inject({ method: 'POST', url: '/api/auth/register',
    payload: { email: `ready-${Math.random().toString(36).slice(2)}@x.com`, password: 'testpass123', fullName: 'Owner', orgName: 'Venue' },
    headers: { 'content-type': 'application/json' } });
  const token = r.json().token as string;
  const orgId = r.json().organizationId as string;
  const e = await app.inject({ method: 'POST', url: '/api/events',
    payload: { organizationId: orgId, title: 'Readiness Wedding', startDate: '2026-09-12' },
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' } });
  return { token, orgId, eventId: e.json().event.id as string };
}

const req = (token: string, method: 'GET'|'POST', url: string, payload?: unknown) => app.inject({
  method, url,
  headers: payload !== undefined ? { authorization: `Bearer ${token}`, 'content-type': 'application/json' } : { authorization: `Bearer ${token}` },
  payload: payload as never,
});

describe('Event readiness route', () => {
  it('detects timeline overlaps, vendor coverage gaps, layout seat shortages and collisions', async () => {
    const s = await setup();
    const vendor = await req(s.token, 'POST', `/api/orgs/${s.orgId}/vendors`, { name: 'DJ', eventId: s.eventId });
    const vendorId = vendor.json().vendor.id;
    await req(s.token, 'POST', `/api/events/${s.eventId}/guests`, { fullName: 'A', rsvpStatus: 'attending' });
    await req(s.token, 'POST', `/api/events/${s.eventId}/guests`, { fullName: 'B', rsvpStatus: 'attending' });

    await req(s.token, 'POST', `/api/events/${s.eventId}/timeline`, { title: 'Ceremony', category: 'ceremony', startsAt: '2026-09-12T16:00:00.000Z', durationMin: 60 });
    await req(s.token, 'POST', `/api/events/${s.eventId}/timeline`, { title: 'Photos', category: 'photos', startsAt: '2026-09-12T16:30:00.000Z', durationMin: 30 });

    await app.inject({ method: 'POST', url: '/api/layouts',
      payload: { organizationId: s.orgId, eventId: s.eventId, name: 'Draft Layout', payload: { items: [
        { id: 'seat-1', type: 'chair', x: 10, y: 10, radius: 6, guestId: 'guest-a' },
        { id: 'table-1', type: 'rect_table', x: 100, y: 100, width: 100, height: 60 },
        { id: 'table-2', type: 'rect_table', x: 120, y: 110, width: 100, height: 60 },
      ] } },
      headers: { authorization: `Bearer ${s.token}`, 'content-type': 'application/json' },
    });

    const res = await req(s.token, 'GET', `/api/events/${s.eventId}/readiness`);
    expect(res.statusCode).toBe(200);
    const readiness = res.json().readiness;
    const ids = readiness.issues.map((i: any) => i.id);
    expect(ids.some((id: string) => id.startsWith('timeline-overlap'))).toBe(true);
    expect(ids).toContain('vendors-without-timeline');
    expect(ids).toContain('layout-not-approved');
    expect(ids).toContain('layout-seat-shortage');
    expect(ids).toContain('layout-collisions');
    expect(readiness.score).toBeLessThan(100);
    expect(readiness.summary.vendors).toBe(1);
    expect(readiness.summary.layoutSeats).toBe(1);
    expect(vendorId).toBeTruthy();
  });
});
