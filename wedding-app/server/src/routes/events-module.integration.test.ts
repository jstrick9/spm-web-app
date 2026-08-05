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
  for (const t of ['events', 'sub_events', 'sse_events', 'audit_logs', 'organization_memberships', 'organizations', 'users']) {
    try { db.prepare(`DELETE FROM ${t}`).run(); } catch { /* table may not exist in this DB */ }
  }
});

async function register(prefix: string, orgName = 'Events Org') {
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
    // Only claim a JSON body when one is sent: Fastify rejects an empty JSON
    // body with 400 FST_ERR_CTP_EMPTY_JSON_BODY (same as the real SDK, which
    // only sets Content-Type when a body exists).
    headers: payload !== undefined
      ? { authorization: `Bearer ${token}`, 'content-type': 'application/json' }
      : { authorization: `Bearer ${token}` },
    payload,
  });
}

async function createEvent(token: string, orgId: string, payload: Record<string, unknown> = {}) {
  const r = await authed(token, 'POST', '/api/events', { organizationId: orgId, title: 'Test Wedding', ...payload });
  expect(r.statusCode).toBe(201);
  return r.json().event as { id: string; status: string; start_date: string | null; end_date: string | null };
}

describe('Events module — pipeline integrity', () => {
  it('deep-merges concurrent metadata writes so day-of data is never clobbered', async () => {
    const u = await register('merge');
    const event = await createEvent(u.token, u.orgId);

    // Coordinator A logs an incident (stale base: no kit state).
    const patchA = await authed(u.token, 'PATCH', `/api/events/${event.id}`, {
      metadata: { emergency_incidents: [{ id: 'inc-1', title: 'Power outage', severity: 'critical' }] },
    });
    expect(patchA.statusCode).toBe(200);

    // Coordinator B toggles a kit item from her OWN stale base (no incident).
    // With wholesale replace this would erase A's incident — regression guard.
    const patchB = await authed(u.token, 'PATCH', `/api/events/${event.id}`, {
      metadata: { emergency_kit_checklist: [{ id: 'kit-1', status: 'low' }] },
    });
    expect(patchB.statusCode).toBe(200);

    const get = await authed(u.token, 'GET', `/api/events/${event.id}`);
    const meta = JSON.parse(get.json().event.metadata || '{}');
    expect(meta.emergency_incidents).toEqual([{ id: 'inc-1', title: 'Power outage', severity: 'critical' }]);
    expect(meta.emergency_kit_checklist).toEqual([{ id: 'kit-1', status: 'low' }]);

    // Nested object merge (RFC 7386): a partial update to a sub-object keeps
    // sibling keys.
    const patchC = await authed(u.token, 'PATCH', `/api/events/${event.id}`, {
      metadata: { emergency_kit_checklist: { config: { restocked: true } } },
    });
    expect(patchC.statusCode).toBe(200);
    const meta2 = JSON.parse((await authed(u.token, 'GET', `/api/events/${event.id}`)).json().event.metadata || '{}');
    // scalar array key replaced wholesale (RFC 7386)…
    expect(meta2.emergency_kit_checklist).toEqual({ config: { restocked: true } });
    // …but the incident from writer A survived the nested write too.
    expect(meta2.emergency_incidents).toEqual([{ id: 'inc-1', title: 'Power outage', severity: 'critical' }]);
  });

  it('rejects creating an event directly in a terminal status', async () => {
    const { token, orgId } = await register('ev-terminal');
    for (const status of ['completed', 'cancelled', 'lost']) {
      const r = await authed(token, 'POST', '/api/events', { organizationId: orgId, title: 'Bad', status });
      expect(r.statusCode).toBe(400);
    }
  });

  it('accepts entry statuses on create (lead/hold/booked/planning)', async () => {
    const { token, orgId } = await register('ev-entry');
    for (const status of ['lead', 'hold', 'booked', 'planning']) {
      const r = await authed(token, 'POST', '/api/events', { organizationId: orgId, title: `E-${status}`, status });
      expect(r.statusCode).toBe(201);
    }
  });

  it('rejects endDate before startDate on create and update', async () => {
    const { token, orgId } = await register('ev-dates');
    const bad = await authed(token, 'POST', '/api/events', { organizationId: orgId, title: 'Inverted', startDate: '2026-09-12', endDate: '2026-09-10' });
    expect(bad.statusCode).toBe(400);

    const event = await createEvent(token, orgId, { startDate: '2026-09-12', endDate: '2026-09-12' });
    const badPatch = await authed(token, 'PATCH', `/api/events/${event.id}`, { endDate: '2026-09-01' });
    expect(badPatch.statusCode).toBe(400);
  });

  it('allows equal start/end dates (single-day events)', async () => {
    const { token, orgId } = await register('ev-same');
    const ok = await createEvent(token, orgId, { startDate: '2026-09-12', endDate: '2026-09-12' });
    expect(ok.start_date).toBe('2026-09-12');
  });
});

describe('Events module — final-review gate consistency', () => {
  it('blocks PATCH into final_review when readiness checks are incomplete', async () => {
    const { token, orgId } = await register('ev-gate');
    const event = await createEvent(token, orgId, { status: 'booked' });
    const r = await authed(token, 'PATCH', `/api/events/${event.id}`, { status: 'final_review' });
    expect(r.statusCode).toBe(400);
    expect(r.json().error).toBe('final-review-not-ready');
    expect(Array.isArray(r.json().details?.checks)).toBe(true);
  });

  it('still allows other status updates via PATCH (booked → planning)', async () => {
    const { token, orgId } = await register('ev-patch-ok');
    const event = await createEvent(token, orgId, { status: 'booked' });
    const r = await authed(token, 'PATCH', `/api/events/${event.id}`, { status: 'planning' });
    expect(r.statusCode).toBe(200);
    expect(r.json().event.status).toBe('planning');
  });
});

describe('Events module — stage endpoint realtime + lifecycle parity', () => {
  it('broadcasts an SSE event when the stage changes', async () => {
    const { token, orgId } = await register('ev-stage-sse');
    const event = await createEvent(token, orgId, { status: 'booked' });
    const r = await authed(token, 'POST', `/api/events/${event.id}/stage`, { status: 'planning' });
    expect(r.statusCode).toBe(200);
    expect(r.json().event.status).toBe('planning');

    const sse = db.prepare(`SELECT event_type, payload FROM sse_events WHERE organization_id = ? AND event_type = 'event.updated' ORDER BY rowid DESC LIMIT 1`).get(orgId) as { event_type: string; payload: string } | undefined;
    expect(sse).toBeTruthy();
    expect(JSON.parse(sse!.payload).eventId).toBe(event.id);
  });

  it('rejects moving a lead straight into completed? No — allows consequential transitions via stage (permissive by design)', async () => {
    const { token, orgId } = await register('ev-stage-permissive');
    const event = await createEvent(token, orgId, { status: 'lead' });
    const r = await authed(token, 'POST', `/api/events/${event.id}/stage`, { status: 'completed' });
    // Permissive by design (venues backdate), but the transition must be audited.
    expect(r.statusCode).toBe(200);
    const audit = db.prepare(`SELECT details FROM audit_logs WHERE action = 'event.stage.transition' AND target_id = ?`).get(event.id) as { details: string } | undefined;
    expect(audit).toBeTruthy();
    expect(JSON.parse(audit!.details)).toMatchObject({ from: 'lead', to: 'completed' });
  });
});

describe('Events module — day-of-contact', () => {
  it('is readable by venue staff (events.view) and writable by editors, with audit', async () => {
    const { token, orgId } = await register('ev-doc');
    const event = await createEvent(token, orgId);

    // Owner (org member with events.view) can read.
    const read = await authed(token, 'GET', `/api/events/${event.id}/day-of-contact`);
    expect(read.statusCode).toBe(200);
    expect(read.json().contact.name).toBe('');

    // Owner can write.
    const write = await authed(token, 'PUT', `/api/events/${event.id}/day-of-contact`, { name: 'Venue Coordinator', phone: '555-0100' });
    expect(write.statusCode).toBe(200);
    expect(write.json().contact.name).toBe('Venue Coordinator');

    // The update is persisted + audited.
    const read2 = await authed(token, 'GET', `/api/events/${event.id}/day-of-contact`);
    expect(read2.json().contact.name).toBe('Venue Coordinator');
    const audit = db.prepare(`SELECT COUNT(*) AS n FROM audit_logs WHERE action = 'event.day_of_contact.update' AND target_id = ?`).get(event.id) as { n: number };
    expect(audit.n).toBe(1);
  });

  it('denies writes to a staff member without events.edit', async () => {
    const { token, orgId } = await register('ev-doc-staff');
    const event = await createEvent(token, orgId);

    // Second user joins the org as staff.
    const staffReg = await register('ev-doc-staff-2');
    // (register creates its own org; we add it to the first org below)
    const members = await authed(token, 'GET', `/api/orgs/${orgId}/roles`);
    const staffRole = (members.json().roles as Array<{ id: string; key: string }>).find((role) => role.key === 'staff');
    expect(staffRole).toBeTruthy();
    const add = await authed(token, 'POST', `/api/orgs/${orgId}/members`, { userEmail: staffReg.email, roleId: staffRole!.id });
    expect(add.statusCode).toBe(201);

    const staffLogin = await app.inject({
      method: 'POST', url: '/api/auth/login',
      payload: { email: staffReg.email, password: 'password123' },
      headers: { 'content-type': 'application/json' },
    });
    const staffToken = staffLogin.json().token as string;

    // Staff can read (events.view)…
    const read = await authed(staffToken, 'GET', `/api/events/${event.id}/day-of-contact`);
    expect(read.statusCode).toBe(200);
    // …but cannot write (no events.edit).
    const write = await authed(staffToken, 'PUT', `/api/events/${event.id}/day-of-contact`, { name: 'Nope' });
    expect(write.statusCode).toBe(403);
  });
});

describe('Events module — duplicate as template', () => {
  it('creates a fresh lead with cleared dates', async () => {
    const { token, orgId } = await register('ev-dup');
    const event = await createEvent(token, orgId, { startDate: '2026-09-12', endDate: '2026-09-14', guestCount: 120, budgetCents: 450000 });
    const dup = await authed(token, 'POST', `/api/events/${event.id}/duplicate`);
    expect(dup.statusCode).toBe(201);
    const copy = dup.json().event;
    expect(copy.status).toBe('lead');
    expect(copy.start_date).toBeNull();
    expect(copy.end_date).toBeNull();
    expect(copy.guest_count).toBe(120);
    expect(copy.budget_cents).toBe(450000);
    expect(copy.title).toContain('(Copy)');
  });
});

describe('Events module — sub-event lifecycle', () => {
  it('deletes with an audit trail and 404s on unknown sub-events', async () => {
    const { token, orgId } = await register('ev-sub');
    const event = await createEvent(token, orgId);
    const created = await authed(token, 'POST', `/api/events/${event.id}/sub-events`, { title: 'Rehearsal Dinner', startsAt: '2026-09-11T18:00:00' });
    expect(created.statusCode).toBe(201);
    const subId = created.json().subEvent.id;

    const missing = await authed(token, 'DELETE', `/api/sub-events/does-not-exist`);
    expect(missing.statusCode).toBe(404);

    const del = await authed(token, 'DELETE', `/api/sub-events/${subId}`);
    expect(del.statusCode).toBe(204);
    const audit = db.prepare(`SELECT COUNT(*) AS n FROM audit_logs WHERE action = 'sub_event.delete' AND target_id = ?`).get(subId) as { n: number };
    expect(audit.n).toBe(1);
  });
});
