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
  for (const t of ['audit_logs', 'events', 'venues', 'organization_memberships', 'organizations', 'users']) {
    try { db.prepare(`DELETE FROM ${t}`).run(); } catch { /* noop */ }
  }
});

async function register() {
  const r = await app.inject({
    method: 'POST', url: '/api/auth/register',
    payload: { email: `rain-${Math.random()}@test.com`, password: 'password123', fullName: 'Owner', orgName: 'Rain Venue' },
  });
  return { token: r.json().token, orgId: r.json().organizationId };
}

function authed(token: string, method: 'POST' | 'PATCH' | 'GET', url: string, payload?: Record<string, unknown>) {
  return app.inject({
    method,
    url,
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    payload,
  });
}

describe('Rain-plan alternate space', () => {
  it('rejects a rain-plan reference to a missing, foreign, or draft space', async () => {
    const { token, orgId } = await register();
    const lawn = await authed(token, 'POST', `/api/orgs/${orgId}/venues`, { name: 'Lawn', capacity: 300 });
    const lawnId = lawn.json().venue.id;

    const badRef = await authed(token, 'PATCH', `/api/venues/${lawnId}`, { metadata: { rainPlanVenueId: 'does-not-exist' } });
    expect(badRef.statusCode).toBe(400);
    expect(badRef.json().error).toBe('invalid-rain-plan-space');

    // Draft space is not an acceptable alternate.
    const draft = await authed(token, 'POST', `/api/orgs/${orgId}/venues`, { name: 'Draft Tent', capacity: 100 });
    const badDraft = await authed(token, 'PATCH', `/api/venues/${lawnId}`, { metadata: { rainPlanVenueId: draft.json().venue.id } });
    expect(badDraft.statusCode).toBe(400);
  });

  it('accepts an approved alternate space and activates it for the event', async () => {
    const { token, orgId } = await register();
    const lawn = await authed(token, 'POST', `/api/orgs/${orgId}/venues`, { name: 'Lawn', capacity: 300 });
    const tent = await authed(token, 'POST', `/api/orgs/${orgId}/venues`, { name: 'Tent', capacity: 150 });
    const lawnId = lawn.json().venue.id;
    const tentId = tent.json().venue.id;

    // Approve both spaces (complete zones so approval is allowed).
    const masterLayout = { zones: [
      { type: 'exit' }, { type: 'accessible_route' }, { type: 'power' }, { type: 'loading' },
    ] };
    const approve = await authed(token, 'PATCH', `/api/venues/${lawnId}`, { approvalStatus: 'approved', masterLayout });
    expect(approve.statusCode).toBe(200);
    await authed(token, 'PATCH', `/api/venues/${tentId}`, { approvalStatus: 'approved', masterLayout });

    const setRef = await authed(token, 'PATCH', `/api/venues/${lawnId}`, { metadata: { rainPlanVenueId: tentId } });
    expect(setRef.statusCode).toBe(200);

    const evt = await authed(token, 'POST', '/api/events', { organizationId: orgId, title: 'Outdoor Wedding', venueId: lawnId, startDate: '2026-09-12' });
    const eventId = evt.json().event.id;

    // No rain plan configured → explicit error.
    const other = await authed(token, 'POST', '/api/events', { organizationId: orgId, title: 'No Rain Plan', startDate: '2026-09-19' });
    const noPlan = await authed(token, 'POST', `/api/events/${other.json().event.id}/activate-rain-plan`, {});
    expect(noPlan.statusCode).toBe(400);
    expect(noPlan.json().error).toBe('rain-plan-requires-venue');

    const activated = await authed(token, 'POST', `/api/events/${eventId}/activate-rain-plan`, {});
    expect(activated.statusCode).toBe(200);
    expect(activated.json().rainPlan).toEqual({ fromVenue: 'Lawn', toVenue: 'Tent' });
    expect(activated.json().event.venue_id).toBe(tentId);

    // Activation records the previous space + plan flag in event metadata so
    // the coordinator can restore with one click later.
    const eventMeta = (() => { try { return JSON.parse(activated.json().event.metadata || '{}'); } catch { return {}; } })();
    expect(eventMeta.previousVenueId).toBe(lawnId);
    expect(eventMeta.emergency_active_plan).toBe('plan-b');

    const audit = db.prepare(`SELECT details FROM audit_logs WHERE action = 'event.rain_plan.activated'`).get() as { details: string } | undefined;
    expect(audit).toBeTruthy();
    expect(JSON.parse(audit!.details).fromVenueId).toBe(lawnId);
    expect(JSON.parse(audit!.details).toVenueId).toBe(tentId);
  });

  it('keeps the ORIGINAL space across repeat activations (activate→activate→restore returns home)', async () => {
    const { token, orgId } = await register();
    const lawn = await authed(token, 'POST', `/api/orgs/${orgId}/venues`, { name: 'Lawn', capacity: 300 });
    const tent = await authed(token, 'POST', `/api/orgs/${orgId}/venues`, { name: 'Tent', capacity: 150 });
    const lawnId = lawn.json().venue.id;
    const tentId = tent.json().venue.id;
    const masterLayout = { zones: [{ type: 'exit' }, { type: 'accessible_route' }, { type: 'power' }, { type: 'loading' }] };
    await authed(token, 'PATCH', `/api/venues/${lawnId}`, { approvalStatus: 'approved', masterLayout });
    await authed(token, 'PATCH', `/api/venues/${tentId}`, { approvalStatus: 'approved', masterLayout });
    await authed(token, 'PATCH', `/api/venues/${lawnId}`, { metadata: { rainPlanVenueId: tentId } });

    const evt = await authed(token, 'POST', '/api/events', { organizationId: orgId, title: 'Repeat Activate', venueId: lawnId, startDate: '2026-09-12' });
    const eventId = evt.json().event.id;

    await authed(token, 'POST', `/api/events/${eventId}/activate-rain-plan`, {});
    // Second activation while already on the backup space: idempotent no-op
    // (200, alreadyActive), and must NOT clobber the original home venue.
    const second = await authed(token, 'POST', `/api/events/${eventId}/activate-rain-plan`, {});
    expect(second.statusCode).toBe(200);
    expect(second.json().alreadyActive).toBe(true);
    expect(second.json().event.venue_id).toBe(tentId);
    const meta2 = (() => { try { return JSON.parse(second.json().event.metadata || '{}'); } catch { return {}; } })();
    expect(meta2.previousVenueId).toBe(lawnId);

    // Restore still returns to the ORIGINAL lawn, not the backup tent.
    const restored = await authed(token, 'POST', `/api/events/${eventId}/activate-rain-plan`, { restore: true });
    expect(restored.statusCode).toBe(200);
    expect(restored.json().event.venue_id).toBe(lawnId);
  });

  it('restores the event to its original space after activation', async () => {
    const { token, orgId } = await register();
    const lawn = await authed(token, 'POST', `/api/orgs/${orgId}/venues`, { name: 'Lawn', capacity: 300 });
    const tent = await authed(token, 'POST', `/api/orgs/${orgId}/venues`, { name: 'Tent', capacity: 150 });
    const lawnId = lawn.json().venue.id;
    const tentId = tent.json().venue.id;
    const masterLayout = { zones: [{ type: 'exit' }, { type: 'accessible_route' }, { type: 'power' }, { type: 'loading' }] };
    await authed(token, 'PATCH', `/api/venues/${lawnId}`, { approvalStatus: 'approved', masterLayout });
    await authed(token, 'PATCH', `/api/venues/${tentId}`, { approvalStatus: 'approved', masterLayout });
    await authed(token, 'PATCH', `/api/venues/${lawnId}`, { metadata: { rainPlanVenueId: tentId } });

    const evt = await authed(token, 'POST', '/api/events', { organizationId: orgId, title: 'Outdoor Wedding', venueId: lawnId, startDate: '2026-09-12' });
    const eventId = evt.json().event.id;

    // Restore before any activation → explicit error.
    const premature = await authed(token, 'POST', `/api/events/${eventId}/activate-rain-plan`, { restore: true });
    expect(premature.statusCode).toBe(400);
    expect(premature.json().error).toBe('rain-plan-not-active');

    await authed(token, 'POST', `/api/events/${eventId}/activate-rain-plan`, {});
    const restored = await authed(token, 'POST', `/api/events/${eventId}/activate-rain-plan`, { restore: true });
    expect(restored.statusCode).toBe(200);
    expect(restored.json().restored).toBe(true);
    expect(restored.json().event.venue_id).toBe(lawnId);
    expect(restored.json().rainPlan).toEqual({ fromVenue: 'Tent', toVenue: 'Lawn' });
    const eventMeta = (() => { try { return JSON.parse(restored.json().event.metadata || '{}'); } catch { return {}; } })();
    expect(eventMeta.previousVenueId ?? null).toBe(null);
    expect(eventMeta.emergency_active_plan).toBe('plan-a');

    const audit = db.prepare(`SELECT details FROM audit_logs WHERE action = 'event.rain_plan.restored'`).get() as { details: string } | undefined;
    expect(audit).toBeTruthy();
    expect(JSON.parse(audit!.details).toVenueId).toBe(lawnId);
  });
});
