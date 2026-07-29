import './../test/setup.js';
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { buildApp } from '../index.js';
import { db } from '../db/database.js';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;
beforeAll(async () => { app = await buildApp(); await app.ready(); });
beforeEach(() => {
  for (const table of ['timeline_approvals','timeline_events','layout_setup_packets','layouts','vendors','event_memberships','events','organization_memberships','organizations','users','audit_logs']) { try { db.prepare(`DELETE FROM ${table}`).run(); } catch {} }
});

describe('Final Review stage gate', () => {
  it('shows the full readiness checklist and prevents a premature transition', async () => {
    const registration = await app.inject({ method: 'POST', url: '/api/auth/register', payload: { email: `review-${Math.random()}@test.com`, password: 'password123', fullName: 'Manager', orgName: 'Seven Paths Manor' } });
    const token = registration.json().token; const orgId = registration.json().organizationId;
    const create = await app.inject({ method: 'POST', url: '/api/events', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, payload: { organizationId: orgId, title: 'Final Review Wedding', status: 'planning' } });
    const eventId = create.json().event.id;
    const readiness = await app.inject({ method: 'GET', url: `/api/events/${eventId}/final-review`, headers: { authorization: `Bearer ${token}` } });
    expect(readiness.statusCode).toBe(200);
    expect(readiness.json().finalReview.ready).toBe(false);
    const confirmedCount = await app.inject({ method: 'POST', url: `/api/events/${eventId}/final-review/checks`, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, payload: { key: 'confirmed_guest_count', complete: true } });
    expect(confirmedCount.statusCode).toBe(200);
    expect(confirmedCount.json().event.metadata).toContain('finalGuestCountConfirmed');
    expect(readiness.json().finalReview.checks.map((check: any) => check.key)).toEqual(expect.arrayContaining(['approved_layout', 'confirmed_guest_count', 'reviewed_timeline', 'vendor_assignments', 'staffing_readiness', 'setup_packet', 'inventory_readiness', 'accessibility_checks', 'rain_plan_checks']));
    const blocked = await app.inject({ method: 'POST', url: `/api/events/${eventId}/stage`, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, payload: { status: 'final_review' } });
    expect(blocked.statusCode).toBe(400);
    expect(blocked.json().error).toBe('final-review-not-ready');
  });
});
