import './../test/setup.js';
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { db } from '../db/database.js';
import { buildApp } from '../index.js';
import type { FastifyInstance } from 'fastify';
import { rolesRepo, eventsRepo, vendorsRepo, vendorRatingsRepo, vendorScoringRepo } from '../db/repos/index.js';

let app: FastifyInstance;
beforeAll(async () => { app = await buildApp(); await app.ready(); });

beforeEach(() => {
  for (const t of [
    'vendor_ratings', 'vendor_payments', 'vendors',
    'event_memberships', 'events', 'organization_memberships', 'organizations', 'users',
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
    payload: { email: `vs-${Math.random().toString(36).slice(2)}@x.com`, password: 'testpass123', fullName: 'O', orgName: 'VsOrg' },
    headers: { 'content-type': 'application/json' } });
  const token = r.json().token as string, orgId = r.json().organizationId as string, userId = r.json().user.id as string;
  const eventId = (await req(token, 'POST', '/api/events', { organizationId: orgId, title: 'E', budgetCents: 4000000 })).json().event.id as string;
  return { token, orgId, userId, eventId };
}

function rate(orgId: string, vendorId: string, eventId: string, userId: string, scores: { rating: number; q?: number; t?: number; c?: number }) {
  vendorRatingsRepo.create({
    organizationId: orgId, vendorId, eventId, ratedBy: userId,
    rating: scores.rating, qualityScore: scores.q, timelinessScore: scores.t, communicationScore: scores.c,
  });
}

describe('vendorScoringRepo.scoreAll', () => {
  it('scores unrated vendors as 0 / unrated tier', async () => {
    const s = await setup();
    vendorsRepo.create(s.orgId, { name: 'Fresh Florals', category: 'florist' });
    const scores = vendorScoringRepo.scoreAll(s.orgId);
    expect(scores).toHaveLength(1);
    expect(scores[0].reliabilityScore).toBe(0);
    expect(scores[0].tier).toBe('unrated');
  });

  it('produces a high score + top_rated tier for a strong, well-reviewed vendor', async () => {
    const s = await setup();
    const v = vendorsRepo.create(s.orgId, { name: 'Ace DJ', category: 'dj' });
    // 6 strong reviews → full confidence
    for (let i = 0; i < 6; i++) {
      const e = eventsRepo.create({ organizationId: s.orgId, title: `Ev${i}`, createdBy: s.userId });
      rate(s.orgId, v.id, e.id, s.userId, { rating: 5, q: 5, t: 5, c: 5 });
    }
    const score = vendorScoringRepo.scoreOne(s.orgId, v.id)!;
    expect(score.reliabilityScore).toBe(100);
    expect(score.tier).toBe('top_rated');
    expect(score.ratingCount).toBe(6);
  });

  it('tempers a single great review below a vendor with many good reviews (confidence)', async () => {
    const s = await setup();
    const oneShot = vendorsRepo.create(s.orgId, { name: 'OneShot', category: 'cake' });
    rate(s.orgId, oneShot.id, s.eventId, s.userId, { rating: 5, q: 5, t: 5, c: 5 });

    const proven = vendorsRepo.create(s.orgId, { name: 'Proven', category: 'cake' });
    for (let i = 0; i < 10; i++) {
      const e = eventsRepo.create({ organizationId: s.orgId, title: `P${i}`, createdBy: s.userId });
      rate(s.orgId, proven.id, e.id, s.userId, { rating: 5, q: 5, t: 4, c: 5 });
    }
    const a = vendorScoringRepo.scoreOne(s.orgId, oneShot.id)!;
    const b = vendorScoringRepo.scoreOne(s.orgId, proven.id)!;
    // Perfect-but-single should be tempered below the high-volume vendor.
    expect(a.reliabilityScore).toBeLessThan(b.reliabilityScore);
  });

  it('sorts preferred vendors first', async () => {
    const s = await setup();
    vendorsRepo.create(s.orgId, { name: 'Plain', category: 'dj' });
    vendorsRepo.create(s.orgId, { name: 'Preferred', category: 'dj', isPreferred: true });
    const scores = vendorScoringRepo.scoreAll(s.orgId);
    expect(scores[0].name).toBe('Preferred');
  });
});

describe('vendorScoringRepo.matchForEvent', () => {
  it('filters by category and ranks by fit', async () => {
    const s = await setup();
    const dj = vendorsRepo.create(s.orgId, { name: 'Great DJ', category: 'dj', contractAmountCents: 300000 });
    const e = eventsRepo.create({ organizationId: s.orgId, title: 'X', createdBy: s.userId });
    rate(s.orgId, dj.id, e.id, s.userId, { rating: 5, q: 5, t: 5, c: 5 });
    vendorsRepo.create(s.orgId, { name: 'A Florist', category: 'florist', contractAmountCents: 200000 });

    const djMatches = vendorScoringRepo.matchForEvent(s.orgId, { category: 'dj', budgetCents: 4000000 });
    expect(djMatches).toHaveLength(1);
    expect(djMatches[0].name).toBe('Great DJ');
    expect(djMatches[0].matchReasons.length).toBeGreaterThan(0);
  });

  it('flags over-budget vendors and rewards in-budget ones', async () => {
    const s = await setup();
    // Budget 4,000,000 → per-vendor envelope ≈ 1,400,000 (35%).
    vendorsRepo.create(s.orgId, { name: 'Affordable', category: 'catering', contractAmountCents: 1000000 });
    vendorsRepo.create(s.orgId, { name: 'Pricey', category: 'catering', contractAmountCents: 3000000 });
    const matches = vendorScoringRepo.matchForEvent(s.orgId, { budgetCents: 4000000 });
    const aff = matches.find(m => m.name === 'Affordable')!;
    const pricey = matches.find(m => m.name === 'Pricey')!;
    expect(aff.budgetFit).toBe('within');
    expect(pricey.budgetFit).toBe('over');
    expect(aff.fitScore).toBeGreaterThan(pricey.fitScore);
  });

  it('de-duplicates recurring vendors by name', async () => {
    const s = await setup();
    // Same vendor name attached to two events.
    vendorsRepo.create(s.orgId, { name: 'Recurring Co', category: 'dj', contractAmountCents: 100000 });
    vendorsRepo.create(s.orgId, { name: 'Recurring Co', category: 'dj', contractAmountCents: 120000 });
    const matches = vendorScoringRepo.matchForEvent(s.orgId, {});
    expect(matches.filter(m => m.name === 'Recurring Co')).toHaveLength(1);
  });
});

describe('vendor scoring routes', () => {
  it('GET /vendor-scores requires vendors.view and returns scores', async () => {
    const s = await setup();
    vendorsRepo.create(s.orgId, { name: 'V', category: 'dj' });
    const res = await req(s.token, 'GET', `/api/orgs/${s.orgId}/vendor-scores`);
    expect(res.statusCode).toBe(200);
    expect(res.json().scores).toHaveLength(1);
  });

  it('GET /vendor-matches returns ranked matches for the event', async () => {
    const s = await setup();
    vendorsRepo.create(s.orgId, { name: 'V', category: 'dj', contractAmountCents: 200000 });
    const res = await req(s.token, 'GET', `/api/events/${s.eventId}/vendor-matches`);
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.json().matches)).toBe(true);
  });

  it('blocks cross-org vendor-scores access', async () => {
    const a = await setup();
    const b = await setup();
    const res = await req(a.token, 'GET', `/api/orgs/${b.orgId}/vendor-scores`);
    expect(res.statusCode).toBe(403);
  });

  it('requires auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/orgs/x/vendor-scores' });
    expect(res.statusCode).toBe(401);
  });
});
