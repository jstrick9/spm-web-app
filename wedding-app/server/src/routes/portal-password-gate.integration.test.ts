/**
 * Password-protected guest portal gate: the venue sets a password, the info
 * payload is REFUSED until the guest verifies the password and presents the
 * short-lived proof. Regression: previously the toggle stored a hash but
 * nothing enforced it — full guest data was returned regardless.
 */
import './../test/setup.js';
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { db } from '../db/database.js';
import { buildApp } from '../index.js';
import type { FastifyInstance } from 'fastify';
import { guestsRepo, rolesRepo } from '../db/repos/index.js';

let app: FastifyInstance;
beforeAll(async () => { app = await buildApp(); await app.ready(); });

beforeEach(() => {
  for (const t of [
    'audit_logs','guest_portal_configs','rsvp_submissions','guest_sub_event_invitations',
    'guests','layout_versions','layouts','catalog_items','venues','sub_events',
    'event_memberships','events','organization_memberships','organizations','users',
  ]) { try { db.prepare(`DELETE FROM ${t}`).run(); } catch {} }
  try { db.prepare(`DELETE FROM role_permissions WHERE role_id IN (SELECT id FROM roles WHERE is_system = 0)`).run(); db.prepare(`DELETE FROM roles WHERE is_system = 0`).run(); } catch {}
  rolesRepo.ensureSystemRoles();
});

async function setupProtectedPortal() {
  const r = await app.inject({ method: 'POST', url: '/api/auth/register',
    payload: { email: `pg-${Math.random().toString(36).slice(2)}@x.com`, password: 'testpass123', fullName: 'Owner', orgName: 'Venue' },
    headers: { 'content-type': 'application/json' } });
  const token = r.json().token, orgId = r.json().organizationId;
  const e = await app.inject({ method: 'POST', url: '/api/events',
    payload: { organizationId: orgId, title: 'Password Wedding', startDate: '2026-09-12', guestCount: 50 },
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' } });
  const eventId = e.json().event.id;
  const guest = guestsRepo.create(orgId, eventId, { fullName: 'Alice Johnson', email: 'alice@test.com' });
  const portalToken = guestsRepo.rotatePortalToken(guest.id);

  // venue sets a portal password
  const setPw = await app.inject({ method: 'PUT', url: `/api/events/${eventId}/portal-config`,
    payload: { enabled: true, password: 'guest-pass-123', config: {} },
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' } });
  expect(setPw.statusCode).toBe(200);
  return { token, orgId, eventId, guestId: guest.id, portalToken };
}

describe('Password-protected guest portal', () => {
  it('info returns ONLY the locked shell (no guest data) until a valid proof is presented', async () => {
    const s = await setupProtectedPortal();
    const locked = await app.inject({ method: 'GET', url: `/api/portal/${s.eventId}/info?guest=${s.guestId}&token=${s.portalToken}` });
    expect(locked.statusCode).toBe(200);
    const body = locked.json();
    expect(body.passwordLocked).toBe(true);
    expect(body.event.title).toBe('Password Wedding');
    expect(body.guests).toBeUndefined();
    expect(body.guestHome).toBeUndefined();
    expect(body.guestSchedule).toBeUndefined();
  });

  it('verify-password rejects wrong passwords and issues a working proof for the right one', async () => {
    const s = await setupProtectedPortal();

    const wrong = await app.inject({ method: 'POST', url: `/api/portal/${s.eventId}/verify-password`,
      payload: { password: 'nope' }, headers: { 'content-type': 'application/json' } });
    expect(wrong.statusCode).toBe(401);
    expect(wrong.json().ok).toBe(false);

    const right = await app.inject({ method: 'POST', url: `/api/portal/${s.eventId}/verify-password`,
      payload: { password: 'guest-pass-123' }, headers: { 'content-type': 'application/json' } });
    expect(right.statusCode).toBe(200);
    const { token: proof } = right.json();
    expect(proof).toBeTruthy();

    // the proof unlocks the full payload
    const open = await app.inject({ method: 'GET', url: `/api/portal/${s.eventId}/info?guest=${s.guestId}&token=${s.portalToken}&pw=${encodeURIComponent(proof)}` });
    expect(open.statusCode).toBe(200);
    const body = open.json();
    expect(body.passwordLocked).toBeFalsy();
    expect(body.event.title).toBe('Password Wedding');
    expect(Array.isArray(body.guests)).toBe(true);
    expect(body.guests.length).toBeGreaterThan(0);
  });

  it('proofs are single-event and cannot unlock a different portal', async () => {
    const s = await setupProtectedPortal();
    const right = await app.inject({ method: 'POST', url: `/api/portal/${s.eventId}/verify-password`,
      payload: { password: 'guest-pass-123' }, headers: { 'content-type': 'application/json' } });
    const { token: proof } = right.json();

    // second protected portal
    const s2 = await setupProtectedPortal();
    const other = await app.inject({ method: 'GET', url: `/api/portal/${s2.eventId}/info?guest=${s2.guestId}&token=${s2.portalToken}&pw=${encodeURIComponent(proof)}` });
    expect(other.json().passwordLocked).toBe(true);
  });

  it('portals WITHOUT a password are unaffected (no proof needed)', async () => {
    const r = await app.inject({ method: 'POST', url: '/api/auth/register',
      payload: { email: `open-${Math.random().toString(36).slice(2)}@x.com`, password: 'testpass123', fullName: 'Owner', orgName: 'Venue' },
      headers: { 'content-type': 'application/json' } });
    const token = r.json().token, orgId = r.json().organizationId;
    const e = await app.inject({ method: 'POST', url: '/api/events',
      payload: { organizationId: orgId, title: 'Open Wedding', startDate: '2026-09-12' },
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' } });
    const eventId = e.json().event.id;
    const guest = guestsRepo.create(orgId, eventId, { fullName: 'Bob', email: 'bob@test.com' });
    const pt = guestsRepo.rotatePortalToken(guest.id);
    const res = await app.inject({ method: 'GET', url: `/api/portal/${eventId}/info?guest=${guest.id}&token=${pt}` });
    expect(res.json().passwordLocked).toBeFalsy();
    expect(res.json().requiresPassword).toBe(false);
    expect(res.json().guests.length).toBeGreaterThan(0);
  });
});
