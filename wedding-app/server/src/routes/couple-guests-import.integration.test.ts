import './../test/setup.js';
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { db } from '../db/database.js';
import { buildApp } from '../index.js';
import type { FastifyInstance } from 'fastify';

/**
 * Couple guest CSV import — the save side of the import concierge.
 *
 * import-preview only analyzed CSVs; this suite locks in the actual
 * import: field mapping, email/name dedupe, RSVP normalization, row caps,
 * and cross-org authorization.
 */
let app: FastifyInstance;
beforeAll(async () => { app = await buildApp(); await app.ready(); });

beforeEach(() => {
  for (const t of ['audit_logs','guests','event_memberships','events','organization_memberships','organizations','users']) {
    try { db.prepare(`DELETE FROM ${t}`).run(); } catch { /* table might not exist yet */ }
  }
});

const CSV = [
  'fullName,email,phone,householdName,mailingAddress,rsvpStatus,mealChoice',
  'Jane Guest,jane@example.com,555-0100,Smith Family,1 Main St,attending,Chicken',
  'John Guest,john@example.com,555-0101,Smith Family,1 Main St,maybe,Beef',
  'No Email Guest,,555-0102,Smith Family,1 Main St,pending,Fish',
].join('\n');

async function register(email = `import-${Math.random().toString(36).slice(2)}@x.com`) {
  const r = await app.inject({
    method: 'POST', url: '/api/auth/register',
    payload: { email, password: 'testpass123', fullName: 'Import Tester', orgName: 'TestOrg' },
    headers: { 'content-type': 'application/json' },
  });
  return { token: r.json().token, userId: r.json().user.id, orgId: r.json().organizationId, email };
}

/** Owner creates an event; returns eventId + owner token + couple token. */
async function setupEventWithCouple() {
  const owner = await register(`owner-${Math.random().toString(36).slice(2)}@x.com`);
  const evt = await app.inject({
    method: 'POST', url: '/api/events',
    headers: { authorization: `Bearer ${owner.token}`, 'content-type': 'application/json' },
    payload: { organizationId: owner.orgId, title: 'Import Wedding' },
  });
  const eventId = (evt.json().event as { id: string }).id;
  const couple = await register(`couple-${Math.random().toString(36).slice(2)}@x.com`);
  const role = db.prepare(`SELECT id FROM roles WHERE key='couple' AND is_system=1`).get() as { id: string };
  db.prepare(`INSERT INTO event_memberships (id, event_id, user_id, role_id, status) VALUES (?, ?, ?, ?, 'active')`)
    .run(`mem-${Math.random().toString(36).slice(2)}`, eventId, couple.userId, role.id);
  return { owner, couple, eventId };
}

const post = (token: string, url: string, payload?: unknown) =>
  app.inject({
    method: 'POST', url,
    headers: payload !== undefined
      ? { authorization: `Bearer ${token}`, 'content-type': 'application/json' }
      : { authorization: `Bearer ${token}` },
    payload: payload as never,
  });

describe('Couple guest CSV import', () => {
  it('imports rows into the event guest list with full field mapping', async () => {
    const { couple, eventId } = await setupEventWithCouple();
    const res = await post(couple.token, `/api/events/${eventId}/couple-guests/import`, { csv: CSV });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ imported: 3, skipped: 0 });

    const list = await app.inject({ method: 'GET', url: `/api/events/${eventId}/couple-guests`, headers: { authorization: `Bearer ${couple.token}` } });
    const { guests } = list.json();
    expect(guests).toHaveLength(3);
    const jane = guests.find((g: any) => g.fullName === 'Jane Guest');
    expect(jane).toMatchObject({
      email: 'jane@example.com',
      phone: '555-0100',
      householdName: 'Smith Family',
      mailingAddress: '1 Main St',
      rsvpStatus: 'attending',
      mealChoice: 'Chicken',
    });
    expect(guests.find((g: any) => g.fullName === 'No Email Guest').email).toBeNull();
  });

  it('skips rows whose email already exists (idempotent re-import)', async () => {
    const { couple, eventId } = await setupEventWithCouple();
    const first = await post(couple.token, `/api/events/${eventId}/couple-guests/import`, { csv: CSV });
    expect(first.json().imported).toBe(3);
    const second = await post(couple.token, `/api/events/${eventId}/couple-guests/import`, { csv: CSV });
    expect(second.json()).toMatchObject({ imported: 0, skipped: 3 });
    expect(second.json().duplicateSignals).toContain('jane@example.com');
  });

  it('skips duplicate names within the same file', async () => {
    const { couple, eventId } = await setupEventWithCouple();
    const dupCsv = 'fullName,email\nAlice,alice@x.com\nAlice,alice2@x.com';
    const res = await post(couple.token, `/api/events/${eventId}/couple-guests/import`, { csv: dupCsv });
    expect(res.statusCode).toBe(201);
    expect(res.json()).toMatchObject({ imported: 1, skipped: 1 });
  });

  it('allows the same name with a different email (matches preview semantics)', async () => {
    const { couple, eventId } = await setupEventWithCouple();
    await post(couple.token, `/api/events/${eventId}/couple-guests/import`, { csv: 'fullName,email\nJordan Lee,jordan1@x.com' });
    const second = await post(couple.token, `/api/events/${eventId}/couple-guests/import`, { csv: 'fullName,email\nJordan Lee,jordan2@x.com' });
    // Same name, different email = a different person; the preview reports
    // it as importable, so the import must not silently drop it.
    expect(second.json()).toMatchObject({ imported: 1, skipped: 0 });
  });

  it('rejects a CSV without a Full Name column', async () => {
    const { couple, eventId } = await setupEventWithCouple();
    const res = await post(couple.token, `/api/events/${eventId}/couple-guests/import`, { csv: 'email\nx@y.com' });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('missing-fullname-column');
  });

  it('normalizes invalid RSVP statuses to pending with a warning', async () => {
    const { couple, eventId } = await setupEventWithCouple();
    const res = await post(couple.token, `/api/events/${eventId}/couple-guests/import`, { csv: 'fullName,rsvpStatus\nBob,definitely' });
    expect(res.statusCode).toBe(201);
    expect(res.json().imported).toBe(1);
    expect(res.json().warnings.some((w: string) => w.includes('Bob')));
    const list = await app.inject({ method: 'GET', url: `/api/events/${eventId}/couple-guests`, headers: { authorization: `Bearer ${couple.token}` } });
    expect(list.json().guests[0].rsvpStatus).toBe('pending');
  });

  it('caps imports at 2,000 rows', async () => {
    const { couple, eventId } = await setupEventWithCouple();
    const rows = Array.from({ length: 2001 }, (_, i) => `G${i},g${i}@x.com`).join('\n');
    const res = await post(couple.token, `/api/events/${eventId}/couple-guests/import`, { csv: `fullName,email\n${rows}` });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('too-many-rows');
  });

  it('rejects outsiders (no event membership)', async () => {
    const { eventId } = await setupEventWithCouple();
    const outsider = await register();
    const res = await post(outsider.token, `/api/events/${eventId}/couple-guests/import`, { csv: CSV });
    expect(res.statusCode).toBe(403);
  });

  it('audits the import action', async () => {
    const { couple, eventId } = await setupEventWithCouple();
    await post(couple.token, `/api/events/${eventId}/couple-guests/import`, { csv: CSV });
    const audit = db.prepare(`SELECT * FROM audit_logs WHERE action='couple.guest.import'`).get() as any;
    expect(audit).toBeTruthy();
    expect(audit.target_id).toBe(eventId);
    expect(JSON.parse(audit.details)).toMatchObject({ imported: 3, skipped: 0 });
  });
});
