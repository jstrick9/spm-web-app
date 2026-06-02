import './../test/setup.js';
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { db } from '../db/database.js';
import { buildApp } from '../index.js';
import type { FastifyInstance } from 'fastify';
import { rolesRepo, eventsRepo, guestsRepo, guestIdentityRepo } from '../db/repos/index.js';

let app: FastifyInstance;
beforeAll(async () => { app = await buildApp(); await app.ready(); });

beforeEach(() => {
  for (const t of [
    'guests', 'event_memberships', 'events', 'organization_memberships', 'organizations', 'users', 'audit_logs',
  ]) { try { db.prepare(`DELETE FROM ${t}`).run(); } catch { /* ok */ } }
  try {
    db.prepare(`DELETE FROM role_permissions WHERE role_id IN (SELECT id FROM roles WHERE is_system = 0)`).run();
    db.prepare(`DELETE FROM roles WHERE is_system = 0`).run();
  } catch { /* ok */ }
  rolesRepo.ensureSystemRoles();
});

const req = (token: string, method: 'GET'|'POST', url: string, payload?: unknown) =>
  app.inject({ method, url, headers: payload !== undefined
    ? { authorization: `Bearer ${token}`, 'content-type': 'application/json' }
    : { authorization: `Bearer ${token}` }, payload: payload as never });

async function setup() {
  const r = await app.inject({ method: 'POST', url: '/api/auth/register',
    payload: { email: `gi-${Math.random().toString(36).slice(2)}@x.com`, password: 'testpass123', fullName: 'O', orgName: 'GiOrg' },
    headers: { 'content-type': 'application/json' } });
  const token = r.json().token as string, orgId = r.json().organizationId as string, userId = r.json().user.id as string;
  const e1 = eventsRepo.create({ organizationId: orgId, title: 'Wedding A', createdBy: userId });
  const e2 = eventsRepo.create({ organizationId: orgId, title: 'Wedding B', createdBy: userId });
  return { token, orgId, userId, e1: e1.id, e2: e2.id };
}

describe('guestIdentityRepo.findDuplicates', () => {
  it('returns no clusters when all guests are distinct', async () => {
    const s = await setup();
    guestsRepo.create(s.orgId, s.e1, { fullName: 'Alice Adams', email: 'alice@x.com' });
    guestsRepo.create(s.orgId, s.e1, { fullName: 'Bob Brown', email: 'bob@x.com' });
    expect(guestIdentityRepo.findDuplicates(s.orgId)).toHaveLength(0);
  });

  it('clusters across events by exact email (high confidence)', async () => {
    const s = await setup();
    guestsRepo.create(s.orgId, s.e1, { fullName: 'Jane Doe', email: 'JANE@x.com' });
    guestsRepo.create(s.orgId, s.e2, { fullName: 'Jane D.', email: 'jane@x.com' }); // diff name, same email (case-insensitive)
    const clusters = guestIdentityRepo.findDuplicates(s.orgId);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].confidence).toBe('high');
    expect(clusters[0].signals).toContain('email');
    expect(clusters[0].members).toHaveLength(2);
    expect(clusters[0].hasInEventDuplicate).toBe(false); // different events
  });

  it('clusters by phone ignoring formatting', async () => {
    const s = await setup();
    guestsRepo.create(s.orgId, s.e1, { fullName: 'Tom One', phone: '(555) 123-4567' });
    guestsRepo.create(s.orgId, s.e2, { fullName: 'Tommy O', phone: '5551234567' });
    const clusters = guestIdentityRepo.findDuplicates(s.orgId);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].signals).toContain('phone');
    expect(clusters[0].confidence).toBe('high');
  });

  it('clusters by normalized name (medium confidence) and flags in-event duplicates', async () => {
    const s = await setup();
    // Two rows in the SAME event, same name, no contact → in-event duplicate.
    guestsRepo.create(s.orgId, s.e1, { fullName: 'Mary  Jane' });
    guestsRepo.create(s.orgId, s.e1, { fullName: 'mary jane' });
    const clusters = guestIdentityRepo.findDuplicates(s.orgId);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].confidence).toBe('medium');
    expect(clusters[0].signals).toContain('name');
    expect(clusters[0].hasInEventDuplicate).toBe(true);
  });

  it('does not cluster guests across different orgs', async () => {
    const a = await setup();
    const b = await setup();
    guestsRepo.create(a.orgId, a.e1, { fullName: 'Same Person', email: 'same@x.com' });
    guestsRepo.create(b.orgId, b.e1, { fullName: 'Same Person', email: 'same@x.com' });
    expect(guestIdentityRepo.findDuplicates(a.orgId)).toHaveLength(0);
    expect(guestIdentityRepo.findDuplicates(b.orgId)).toHaveLength(0);
  });
});

describe('guestIdentityRepo.merge', () => {
  it('backfills primary contact fields and soft-deletes duplicates', async () => {
    const s = await setup();
    const primary = guestsRepo.create(s.orgId, s.e1, { fullName: 'Kim Lee' }); // no contact
    const dup = guestsRepo.create(s.orgId, s.e2, { fullName: 'Kim Lee', email: 'kim@x.com', phone: '5551112222', dietaryRestrictions: 'Vegan' });

    const res = guestIdentityRepo.merge(s.orgId, primary.id, [dup.id]);
    expect('error' in res).toBe(false);
    if ('error' in res) return;
    expect(res.mergedCount).toBe(1);
    expect(res.primary.email).toBe('kim@x.com');
    expect(res.primary.phone).toBe('5551112222');
    expect(res.primary.dietary_restrictions).toBe('Vegan');
    // dup is soft-deleted
    expect(guestsRepo.findById(dup.id)).toBeUndefined();
    expect(guestsRepo.findById(primary.id)).toBeTruthy();
  });

  it('does not overwrite existing primary fields', async () => {
    const s = await setup();
    const primary = guestsRepo.create(s.orgId, s.e1, { fullName: 'Pat', email: 'keep@x.com' });
    const dup = guestsRepo.create(s.orgId, s.e1, { fullName: 'Pat', email: 'other@x.com' });
    const res = guestIdentityRepo.merge(s.orgId, primary.id, [dup.id]);
    if ('error' in res) throw new Error(res.error);
    expect(res.primary.email).toBe('keep@x.com');
  });

  it('rejects merges referencing another org\'s guest', async () => {
    const a = await setup();
    const b = await setup();
    const aGuest = guestsRepo.create(a.orgId, a.e1, { fullName: 'A' });
    const bGuest = guestsRepo.create(b.orgId, b.e1, { fullName: 'B' });
    // a's org cannot merge b's guest as a duplicate
    const res = guestIdentityRepo.merge(a.orgId, aGuest.id, [bGuest.id]);
    expect('error' in res && res.error).toBe('no-valid-duplicates');
    expect(guestsRepo.findById(bGuest.id)).toBeTruthy(); // untouched
  });
});

describe('guest identity routes', () => {
  it('GET /guest-duplicates returns clusters with guests.view', async () => {
    const s = await setup();
    guestsRepo.create(s.orgId, s.e1, { fullName: 'Dup Person', email: 'd@x.com' });
    guestsRepo.create(s.orgId, s.e2, { fullName: 'Dup Person', email: 'd@x.com' });
    const res = await req(s.token, 'GET', `/api/orgs/${s.orgId}/guest-duplicates`);
    expect(res.statusCode).toBe(200);
    expect(res.json().clusters).toHaveLength(1);
  });

  it('POST /guests/merge merges and audits', async () => {
    const s = await setup();
    const p = guestsRepo.create(s.orgId, s.e1, { fullName: 'Merge Me' });
    const d = guestsRepo.create(s.orgId, s.e2, { fullName: 'Merge Me', email: 'm@x.com' });
    const res = await req(s.token, 'POST', `/api/orgs/${s.orgId}/guests/merge`, { primaryId: p.id, duplicateIds: [d.id] });
    expect(res.statusCode).toBe(200);
    expect(res.json().mergedCount).toBe(1);
    expect(res.json().primary.email).toBe('m@x.com');
  });

  it('merge with no valid duplicates → 400', async () => {
    const s = await setup();
    const p = guestsRepo.create(s.orgId, s.e1, { fullName: 'Solo' });
    const res = await req(s.token, 'POST', `/api/orgs/${s.orgId}/guests/merge`, { primaryId: p.id, duplicateIds: ['nope'] });
    expect(res.statusCode).toBe(400);
  });

  it('blocks cross-org duplicate listing', async () => {
    const a = await setup();
    const b = await setup();
    const res = await req(a.token, 'GET', `/api/orgs/${b.orgId}/guest-duplicates`);
    expect(res.statusCode).toBe(403);
  });

  it('requires auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/orgs/x/guest-duplicates' });
    expect(res.statusCode).toBe(401);
  });
});
