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
    'layout_setup_packets','layout_vendor_zone_inspections','layout_rain_plan_activations','layout_variance_evidence','layout_floor_walk_checks',
    'layout_versions','layouts','timeline_events','vendor_portal_tokens','vendor_payments','vendors','rsvp_submissions','guests',
    'event_memberships','events','organization_memberships','organizations','users','audit_logs',
  ]) { try { db.prepare(`DELETE FROM ${t}`).run(); } catch {} }
  try { db.prepare(`DELETE FROM role_permissions WHERE role_id IN (SELECT id FROM roles WHERE is_system = 0)`).run(); db.prepare(`DELETE FROM roles WHERE is_system = 0`).run(); } catch {}
  rolesRepo.ensureSystemRoles();
});

async function setup() {
  const r = await app.inject({ method: 'POST', url: '/api/auth/register',
    payload: { email: `layout-ops-${Math.random().toString(36).slice(2)}@x.com`, password: 'testpass123', fullName: 'Owner', orgName: 'Venue' },
    headers: { 'content-type': 'application/json' } });
  const token = r.json().token as string;
  const orgId = r.json().organizationId as string;
  const e = await app.inject({ method: 'POST', url: '/api/events',
    payload: { organizationId: orgId, title: 'Layout Ops Wedding', startDate: '2026-09-12' },
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' } });
  const eventId = e.json().event.id as string;
  const l = await app.inject({ method: 'POST', url: '/api/layouts',
    payload: { organizationId: orgId, eventId, name: 'Main Layout', payload: { items: [{ id: 't1', type: 'round_table', x: 1, y: 2 }] } },
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' } });
  return { token, orgId, eventId, layoutId: l.json().layout.id as string };
}

const req = (token: string, method: 'GET'|'POST', url: string, payload?: unknown) => app.inject({
  method, url,
  headers: payload !== undefined ? { authorization: `Bearer ${token}`, 'content-type': 'application/json' } : { authorization: `Bearer ${token}` },
  payload: payload as never,
});

describe('layout manager operations routes', () => {
  it('persists floor walk checks, rain plan activation, photo evidence, vendor inspections, and signed setup packets', async () => {
    const s = await setup();
    const check = await req(s.token, 'POST', `/api/layouts/${s.layoutId}/floor-walk-checks`, { checkId: 'exits', status: 'verified' });
    expect(check.statusCode).toBe(201);
    expect(check.json().check.status).toBe('verified');

    const rain = await req(s.token, 'POST', `/api/layouts/${s.layoutId}/rain-plan`, { active: true, note: 'Storm call made.' });
    expect(rain.statusCode).toBe(201);
    expect(rain.json().activation.active).toBe(1);

    const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=';
    const evidence = await req(s.token, 'POST', `/api/layouts/${s.layoutId}/variance-evidence`, { note: 'Table 4 moved six feet.', photoDataUri: png });
    expect(evidence.statusCode).toBe(201);
    expect(evidence.json().evidence.photo_url).toMatch(/^\/uploads\/private\//);
    const protectedEvidence = await req(s.token, 'GET', `/api/layouts/${s.layoutId}/variance-evidence/${evidence.json().evidence.id}/content`);
    expect(protectedEvidence.statusCode).toBe(200);
    const anonymousEvidence = await app.inject({ method: 'GET', url: `/api/layouts/${s.layoutId}/variance-evidence/${evidence.json().evidence.id}/content` });
    expect(anonymousEvidence.statusCode).toBe(401);

    const inspection = await req(s.token, 'POST', `/api/layouts/${s.layoutId}/vendor-zone-inspections`, { status: 'issue', zoneLabel: 'DJ power', note: 'Needs cable ramp.' });
    expect(inspection.statusCode).toBe(201);

    const packet = await req(s.token, 'POST', `/api/layouts/${s.layoutId}/setup-packet`, { audience: 'setup_crew', payload: { seats: 120 } });
    expect(packet.statusCode).toBe(201);
    expect(packet.json().publicUrl).toContain('/api/public/layout-packets/');

    const publicPacket = await app.inject({ method: 'GET', url: packet.json().publicUrl });
    expect(publicPacket.statusCode).toBe(200);
    expect(publicPacket.json().packet.layoutName).toBe('Main Layout');
    expect(publicPacket.json().packet.payload.seats).toBe(120);

    const comment = await req(s.token, 'POST', `/api/layouts/${s.layoutId}/comments`, { body: 'Please move the dance floor closer to the head table.' });
    expect(comment.statusCode).toBe(201);
    const review = await req(s.token, 'POST', `/api/layouts/${s.layoutId}/review-request`);
    expect(review.statusCode).toBe(201);
    const decision = await req(s.token, 'POST', `/api/layouts/${s.layoutId}/reviews/${review.json().review.id}/decision`, { decision: 'approved', note: 'Operationally approved.' });
    expect(decision.statusCode).toBe(200);
    expect(decision.json().layout.approval_status).toBe('approved');
    const collaboration = await req(s.token, 'GET', `/api/layouts/${s.layoutId}/collaboration`);
    expect(collaboration.json().comments).toHaveLength(1);

    const list = await req(s.token, 'GET', `/api/layouts/${s.layoutId}/ops`);
    expect(list.statusCode).toBe(200);
    expect(list.json().ops.floorWalkChecks).toHaveLength(1);
    expect(list.json().ops.varianceEvidence).toHaveLength(1);
    expect(list.json().ops.vendorZoneInspections).toHaveLength(1);
    expect(list.json().ops.setupPackets).toHaveLength(1);
    expect(list.json().ops.rainPlan.active).toBe(1);
  });
});
