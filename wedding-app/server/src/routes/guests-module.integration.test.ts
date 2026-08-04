import './../test/setup.js';
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { buildApp } from '../index.js';
import { db } from '../db/database.js';
import { uuid } from '../lib/crypto.js';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;

beforeAll(async () => {
  app = await buildApp();
  await app.ready();
});

beforeEach(() => {
  for (const t of ['rsvp_submissions', 'guest_sub_event_invitations', 'guests', 'events', 'sse_events', 'audit_logs', 'guest_portal_configs', 'event_memberships', 'organization_memberships', 'organizations', 'users']) {
    try { db.prepare(`DELETE FROM ${t}`).run(); } catch { /* table may not exist in this DB */ }
  }
});

async function register(prefix: string, orgName = 'Guests Org') {
  const r = await app.inject({
    method: 'POST', url: '/api/auth/register',
    payload: { email: `${prefix}-${Math.random()}@test.com`, password: 'password123', fullName: 'Owner', orgName },
  });
  return { token: r.json().token, orgId: r.json().organizationId, email: r.json().user.email as string };
}

function authed(token: string, method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE', url: string, payload?: Record<string, unknown>) {
  return app.inject({
    method,
    url,
    headers: payload !== undefined
      ? { authorization: `Bearer ${token}`, 'content-type': 'application/json' }
      : { authorization: `Bearer ${token}` },
    payload,
  });
}

async function createEvent(token: string, orgId: string, payload: Record<string, unknown> = {}) {
  const r = await authed(token, 'POST', '/api/events', { organizationId: orgId, title: 'Test Wedding', status: 'booked', ...payload });
  expect(r.statusCode).toBe(201);
  return r.json().event as { id: string; organization_id: string; status: string };
}

/** Register a separate user and add them to the org + event as a couple. */
async function addCoupleMember(token: string, orgId: string, eventId: string) {
  const u = await register('couple-user');
  const roles = await authed(token, 'GET', `/api/orgs/${orgId}/roles`);
  const coupleRole = (roles.json().roles as Array<{ id: string; key: string }>).find((r) => r.key === 'couple');
  expect(coupleRole).toBeTruthy();
  const add = await authed(token, 'POST', `/api/events/${eventId}/couple-invitations`, { email: u.email, roleId: coupleRole!.id });
  expect(add.statusCode).toBe(201);
  const login = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: u.email, password: 'password123' }, headers: { 'content-type': 'application/json' } });
  return login.json().token as string;
}

function insertGuest(orgId: string, eventId: string, over: Record<string, unknown> = {}) {
  const id = uuid();
  db.prepare(
    `INSERT INTO guests (id, organization_id, event_id, full_name, email, phone, party_name, rsvp_status, allow_portal_access, metadata)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`
  ).run(
    id, orgId, eventId,
    over.fullName ?? 'Jane Guest',
    over.email ?? `guest-${Math.random()}@example.com`,
    over.phone ?? null,
    over.partyName ?? null,
    over.rsvpStatus ?? 'pending',
    JSON.stringify(over.metadata ?? {}),
  );
  return db.prepare(`SELECT * FROM guests WHERE id = ?`).get(id) as Record<string, any>;
}

describe('Guest identity merge (owner-only data-quality tool)', () => {
  it('merges duplicates as owner, preserving RSVP submissions, and audits', async () => {
    const { token, orgId } = await register('merge-owner');
    const e1 = await createEvent(token, orgId);
    const e2 = await createEvent(token, orgId);

    const a = insertGuest(orgId, e1.id, { fullName: 'Jane Guest', email: 'jane@example.com', metadata: { mealChoice: 'Chicken' } });
    const b = insertGuest(orgId, e2.id, { fullName: 'Jane Guest', email: 'jane@example.com' });
    // b already RSVP'd — that history must follow the merge.
    db.prepare(`INSERT INTO rsvp_submissions (id, organization_id, event_id, guest_id, attending, attending_days) VALUES (?, ?, ?, ?, 1, '[]')`)
      .run(uuid(), orgId, e2.id, b.id);

    const merge = await authed(token, 'POST', `/api/orgs/${orgId}/guests/merge`, { primaryId: a.id, duplicateIds: [b.id] });
    expect(merge.statusCode).toBe(200);
    expect(merge.json().mergedCount).toBe(1);

    // RSVP submission re-pointed to the primary.
    const rsvp = db.prepare(`SELECT guest_id FROM rsvp_submissions WHERE event_id = ?`).get(e2.id) as { guest_id: string } | undefined;
    expect(rsvp?.guest_id).toBe(a.id);

    // Duplicate soft-deleted.
    const dup = db.prepare(`SELECT deleted_at FROM guests WHERE id = ?`).get(b.id) as { deleted_at: string | null };
    expect(dup.deleted_at).not.toBeNull();

    // Audited.
    const audit = db.prepare(`SELECT COUNT(*) AS n FROM audit_logs WHERE action = 'guest.identity.merge' AND target_id = ?`).get(a.id) as { n: number };
    expect(audit.n).toBe(1);
  });

  it('rejects merge for non-owner staff', async () => {
    const { token, orgId } = await register('merge-manager');
    const e1 = await createEvent(token, orgId);
    const a = insertGuest(orgId, e1.id, { email: 'dup@example.com' });
    const b = insertGuest(orgId, e1.id, { email: 'dup@example.com' });

    const manager = await register('merge-manager-2');
    const roles = await authed(token, 'GET', `/api/orgs/${orgId}/roles`);
    const managerRole = (roles.json().roles as Array<{ id: string; key: string }>).find((r) => r.key === 'manager');
    await authed(token, 'POST', `/api/orgs/${orgId}/members`, { userEmail: manager.email, roleId: managerRole!.id });
    const login = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: manager.email, password: 'password123' }, headers: { 'content-type': 'application/json' } });

    const merge = await authed(login.json().token as string, 'POST', `/api/orgs/${orgId}/guests/merge`, { primaryId: a.id, duplicateIds: [b.id] });
    expect(merge.statusCode).toBe(403);
  });
});

describe('Portal token resend-link', () => {
  it('does NOT rotate the token when delivery is impossible (no SMTP)', async () => {
    const { token, orgId } = await register('resend');
    const event = await createEvent(token, orgId);
    const guest = insertGuest(orgId, event.id, { email: 'guest@example.com', fullName: 'Jane Guest' });
    const before = db.prepare(`SELECT portal_token_hash FROM guests WHERE id = ?`).get(guest.id) as { portal_token_hash: string | null };

    const res = await app.inject({
      method: 'POST', url: `/api/portal/${event.id}/resend-link`,
      payload: { email: 'guest@example.com', name: 'Jane' },
      headers: { 'content-type': 'application/json' },
    });
    expect(res.statusCode).toBe(202);
    expect(res.json().queued).toBe(false);

    const after = db.prepare(`SELECT portal_token_hash FROM guests WHERE id = ?`).get(guest.id) as { portal_token_hash: string | null };
    expect(after.portal_token_hash).toBe(before.portal_token_hash);
  });
});

describe('RSVP edit window', () => {
  async function setupEventWithWindow(deadline: string) {
    const { token, orgId } = await register('rsvpwin');
    const event = await createEvent(token, orgId, { rsvpDeadline: deadline });
    const cfg = await authed(token, 'PUT', `/api/events/${event.id}/portal-config`, {
      enabled: true,
      config: { rsvpEditWindowDays: 7 },
    });
    expect(cfg.statusCode).toBe(200);
    const coupleToken = await addCoupleMember(token, orgId, event.id);
    return { token, coupleToken, event };
  }

  it('allows editing within the window', async () => {
    const { coupleToken, event } = await setupEventWithWindow('2099-01-01');
    const guest = insertGuest(event.organization_id, event.id, { email: 'g@example.com' });

    const first = await app.inject({ method: 'POST', url: `/api/portal/${event.id}/rsvp`, payload: { guestId: guest.id, attending: true, mealChoice: 'Chicken' }, headers: { 'content-type': 'application/json' } });
    expect(first.statusCode).toBe(201);

    // Rotate a token for the guest (edits require it once a prior exists).
    const tok = await authed(coupleToken, 'POST', `/api/guests/${guest.id}/portal-token`);
    const token = tok.json().token as string;
    const edit = await app.inject({ method: 'POST', url: `/api/portal/${event.id}/rsvp`, payload: { guestId: guest.id, attending: false, token }, headers: { 'content-type': 'application/json' } });
    expect(edit.statusCode).toBe(201);
  });

  it('rejects editing after deadline + window has closed', async () => {
    const { coupleToken, event } = await setupEventWithWindow('2020-01-01'); // long past
    const guest = insertGuest(event.organization_id, event.id, { email: 'g2@example.com' });

    const first = await app.inject({ method: 'POST', url: `/api/portal/${event.id}/rsvp`, payload: { guestId: guest.id, attending: true }, headers: { 'content-type': 'application/json' } });
    expect(first.statusCode).toBe(201);

    const tok = await authed(coupleToken, 'POST', `/api/guests/${guest.id}/portal-token`);
    const token = tok.json().token as string;
    const edit = await app.inject({ method: 'POST', url: `/api/portal/${event.id}/rsvp`, payload: { guestId: guest.id, attending: false, token }, headers: { 'content-type': 'application/json' } });
    expect(edit.statusCode).toBe(403);
    expect(edit.json().error).toBe('rsvp-edit-window-closed');
  });
});

describe('Catering dietary export', () => {
  it('includes couple-entered meal choices and couple notes from guest metadata', async () => {
    const { token, orgId } = await register('catering');
    const event = await createEvent(token, orgId);

    // RSVP-based meal choice.
    const rsvpGuest = insertGuest(orgId, event.id, { fullName: 'RSVP Guest', email: 'r@example.com' });
    db.prepare(`INSERT INTO rsvp_submissions (id, organization_id, event_id, guest_id, attending, attending_days, meal_choice) VALUES (?, ?, ?, ?, 1, '[]', 'Fish')`)
      .run(uuid(), orgId, event.id, rsvpGuest.id);
    // Couple-entered meal choice (no RSVP submission).
    insertGuest(orgId, event.id, { fullName: 'Couple Guest', email: 'c@example.com', metadata: { mealChoice: 'Vegan', coupleNotes: 'Allergic to nuts' } });

    const res = await authed(token, 'GET', `/api/events/${event.id}/catering-dietary-export.csv`);
    expect(res.statusCode).toBe(200);
    const csv = res.body as string;
    expect(csv).toContain('"Fish"');
    expect(csv).toContain('"Vegan"');
    expect(csv).toContain('Couple note: Allergic to nuts');
  });
});

describe('Guest lifecycle audit + realtime', () => {
  it('audits guest delete and portal-token rotate (couple-gated)', async () => {
    const { token, orgId } = await register('lifecycle');
    const event = await createEvent(token, orgId);
    const coupleToken = await addCoupleMember(token, orgId, event.id);

    const guest = insertGuest(orgId, event.id, { email: 'life@example.com' });

    const del = await authed(coupleToken, 'DELETE', `/api/guests/${guest.id}`);
    expect(del.statusCode).toBe(204);
    const auditDel = db.prepare(`SELECT COUNT(*) AS n FROM audit_logs WHERE action = 'guest.delete' AND target_id = ?`).get(guest.id) as { n: number };
    expect(auditDel.n).toBe(1);

    const guest2 = insertGuest(orgId, event.id, { email: 'life2@example.com' });
    const rotate = await authed(coupleToken, 'POST', `/api/guests/${guest2.id}/portal-token`);
    expect(rotate.statusCode).toBe(200);
    expect(rotate.json().token).toBeTruthy();
    const auditRotate = db.prepare(`SELECT COUNT(*) AS n FROM audit_logs WHERE action = 'guest.portal_token.rotate' AND target_id = ?`).get(guest2.id) as { n: number };
    expect(auditRotate.n).toBe(1);
  });

  it('denies guest delete to venue staff (couple-only)', async () => {
    const { token, orgId } = await register('lifecycle-staff');
    const event = await createEvent(token, orgId);
    const guest = insertGuest(orgId, event.id, { email: 'staff@example.com' });

    const staff = await register('lifecycle-staff-2');
    const roles = await authed(token, 'GET', `/api/orgs/${orgId}/roles`);
    const staffRole = (roles.json().roles as Array<{ id: string; key: string }>).find((r) => r.key === 'staff');
    await authed(token, 'POST', `/api/orgs/${orgId}/members`, { userEmail: staff.email, roleId: staffRole!.id });
    const login = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: staff.email, password: 'password123' }, headers: { 'content-type': 'application/json' } });

    const del = await authed(login.json().token as string, 'DELETE', `/api/guests/${guest.id}`);
    expect(del.statusCode).toBe(403);
  });
});
