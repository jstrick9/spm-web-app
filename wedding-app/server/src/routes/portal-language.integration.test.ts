/**
 * Guest portal display-language persistence: the /api/portal/:eventId/language
 * endpoint validates the guest token, stores the language on the GUEST record
 * (never inside reminderPreferences, so shell language can't clobber reminder
 * opt-ins), and the info payload restores it on the next load.
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

async function setupGuest() {
  const r = await app.inject({ method: 'POST', url: '/api/auth/register',
    payload: { email: `pl-${Math.random().toString(36).slice(2)}@x.com`, password: 'testpass123', fullName: 'Owner', orgName: 'Venue' },
    headers: { 'content-type': 'application/json' } });
  const token = r.json().token, orgId = r.json().organizationId;
  const e = await app.inject({ method: 'POST', url: '/api/events',
    payload: { organizationId: orgId, title: 'Language Wedding', startDate: '2026-09-12', guestCount: 50 },
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' } });
  const eventId = e.json().event.id;
  const guest = guestsRepo.create(orgId, eventId, { fullName: 'Alice Johnson', email: 'alice@test.com' });
  const portalToken = guestsRepo.rotatePortalToken(guest.id);
  return { token, orgId, eventId, guestId: guest.id, portalToken };
}

describe('Public portal: display language persistence', () => {
  it('stores the guest language and returns it from the info payload', async () => {
    const s = await setupGuest();
    const res = await app.inject({ method: 'POST', url: `/api/portal/${s.eventId}/language`,
      payload: { guestId: s.guestId, token: s.portalToken, language: 'es' },
      headers: { 'content-type': 'application/json' } });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ ok: true, language: 'es' });

    const info = await app.inject({ method: 'GET', url: `/api/portal/${s.eventId}/info?guest=${s.guestId}&token=${s.portalToken}` });
    expect(info.statusCode).toBe(200);
    expect(info.json().language).toBe('es');
  });

  it('defaults to en for guests who never chose a language', async () => {
    const s = await setupGuest();
    const info = await app.inject({ method: 'GET', url: `/api/portal/${s.eventId}/info?guest=${s.guestId}&token=${s.portalToken}` });
    expect(info.json().language).toBe('en');
  });

  it('rejects invalid languages and tokens', async () => {
    const s = await setupGuest();
    const badLang = await app.inject({ method: 'POST', url: `/api/portal/${s.eventId}/language`,
      payload: { guestId: s.guestId, token: s.portalToken, language: 'xx' },
      headers: { 'content-type': 'application/json' } });
    expect(badLang.statusCode).toBe(400);

    const badToken = await app.inject({ method: 'POST', url: `/api/portal/${s.eventId}/language`,
      payload: { guestId: s.guestId, token: 'wrong-token', language: 'fr' },
      headers: { 'content-type': 'application/json' } });
    expect(badToken.statusCode).toBe(403);
  });

  it('does NOT clobber reminder preferences when the shell language changes', async () => {
    const s = await setupGuest();
    // guest opts into email reminders with a saved reminder language
    await app.inject({ method: 'POST', url: `/api/portal/${s.eventId}/reminder-preferences`,
      payload: { guestId: s.guestId, token: s.portalToken, emailOptIn: true, smsOptIn: false, confirmationPreference: 'email', reminderTypes: ['rsvp'], language: 'fr' },
      headers: { 'content-type': 'application/json' } });
    // switch the SHELL language to Spanish
    const lang = await app.inject({ method: 'POST', url: `/api/portal/${s.eventId}/language`,
      payload: { guestId: s.guestId, token: s.portalToken, language: 'es' },
      headers: { 'content-type': 'application/json' } });
    expect(lang.statusCode).toBe(200);

    const info = await app.inject({ method: 'GET', url: `/api/portal/${s.eventId}/info?guest=${s.guestId}&token=${s.portalToken}` });
    const body = info.json();
    expect(body.language).toBe('es');
    expect(body.guestReminders.preferences.language).toBe('fr');
    expect(body.guestReminders.preferences.emailOptIn).toBe(true);
  });
});
