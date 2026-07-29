import './../test/setup.js';
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { db } from '../db/database.js';
import { buildApp } from '../index.js';
import type { FastifyInstance } from 'fastify';
import { rolesRepo, eventsRepo, forecastRepo } from '../db/repos/index.js';

let app: FastifyInstance;
beforeAll(async () => { app = await buildApp(); await app.ready(); });

beforeEach(() => {
  for (const t of [
    'payment_links', 'budget_items', 'guests',
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
    payload: { email: `fc-${Math.random().toString(36).slice(2)}@x.com`, password: 'testpass123', fullName: 'O', orgName: 'FcOrg' },
    headers: { 'content-type': 'application/json' } });
  return { token: r.json().token as string, orgId: r.json().organizationId as string, userId: r.json().user.id as string };
}

/** ISO date N months before now, on the 15th. */
function monthsAgo(n: number): string {
  const d = new Date();
  d.setUTCMonth(d.getUTCMonth() - n);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-15`;
}

describe('forecastRepo (model)', () => {
  it('returns a zeroed, low-confidence forecast for an org with no history', async () => {
    const s = await setup();
    const f = forecastRepo.forOrg(s.orgId);
    expect(f.history.length).toBe(24);
    expect(f.projection.length).toBe(6);
    expect(f.totals.projectedRevenueCents).toBe(0);
    expect(f.meta.confidence).toBe('low');
    expect(f.meta.monthsOfHistory).toBe(0);
  });

  it('projects rising revenue from a clear upward trend', async () => {
    const s = await setup();
    // 12 months of steadily-growing completed events.
    for (let i = 13; i >= 1; i--) {
      eventsRepo.create({
        organizationId: s.orgId, title: `Wedding ${i}`, status: 'completed',
        startDate: monthsAgo(i), budgetCents: (13 - i) * 100000, // grows as i→1
        createdBy: s.userId,
      });
    }
    const f = forecastRepo.forOrg(s.orgId);
    expect(['medium', 'high']).toContain(f.meta.confidence); // calendar-slot normalization can omit the current partial month
    expect(f.trend.direction).toBe('up');
    expect(f.trend.monthlySlopeCents).toBeGreaterThan(0);
    expect(f.totals.projectedRevenueCents).toBeGreaterThan(0);
    expect(f.totals.projectedBookings).toBeGreaterThan(0);
    // history is dense (24 slots) with the last 12 populated
    expect(f.history.filter(h => h.bookings > 0).length).toBeGreaterThanOrEqual(11);
  });

  it('applies a seasonal index (a strong month projects above a quiet one)', async () => {
    const s = await setup();
    // Two years of data: every June is big, every January is tiny.
    for (let yr = 1; yr <= 2; yr++) {
      for (let m = 1; m <= 12; m++) {
        const d = new Date();
        const cnt = m === 6 ? 5 : 1;
        for (let k = 0; k < cnt; k++) {
          eventsRepo.create({
            organizationId: s.orgId, title: `E-${yr}-${m}-${k}`, status: 'completed',
            startDate: `${d.getUTCFullYear() - yr}-${String(m).padStart(2, '0')}-10`,
            budgetCents: 100000, createdBy: s.userId,
          });
        }
      }
    }
    const f = forecastRepo.forOrg(s.orgId, 36, 12);
    const june = f.projection.find(p => p.ym.endsWith('-06'));
    const jan = f.projection.find(p => p.ym.endsWith('-01'));
    expect(june).toBeTruthy();
    expect(jan).toBeTruthy();
    expect(june!.seasonalIndex).toBeGreaterThan(jan!.seasonalIndex);
  });

  it('counts future open events as pipeline', async () => {
    const s = await setup();
    const future = new Date(); future.setUTCMonth(future.getUTCMonth() + 2);
    const fStr = `${future.getUTCFullYear()}-${String(future.getUTCMonth() + 1).padStart(2, '0')}-01`;
    eventsRepo.create({ organizationId: s.orgId, title: 'Future Lead', status: 'lead', startDate: fStr, budgetCents: 500000, createdBy: s.userId });
    eventsRepo.create({ organizationId: s.orgId, title: 'Future Booked', status: 'booked', startDate: fStr, budgetCents: 300000, createdBy: s.userId });
    const f = forecastRepo.forOrg(s.orgId);
    expect(f.pipeline.openEvents).toBe(2);
    expect(f.pipeline.openRevenueCents).toBe(800000);
  });
});

describe('GET /api/orgs/:orgId/forecast', () => {
  it('returns the forecast envelope with reports.view', async () => {
    const s = await setup();
    eventsRepo.create({ organizationId: s.orgId, title: 'E', status: 'completed', startDate: monthsAgo(2), budgetCents: 200000, createdBy: s.userId });
    const res = await req(s.token, 'GET', `/api/orgs/${s.orgId}/forecast`);
    expect(res.statusCode).toBe(200);
    const f = res.json().forecast;
    expect(f).toHaveProperty('history');
    expect(f).toHaveProperty('projection');
    expect(f).toHaveProperty('trend');
    expect(f).toHaveProperty('pipeline');
    expect(f.meta.horizonMonths).toBe(6);
  });

  it('honors history/horizon query params (clamped)', async () => {
    const s = await setup();
    const res = await req(s.token, 'GET', `/api/orgs/${s.orgId}/forecast?history=12&horizon=3`);
    expect(res.statusCode).toBe(200);
    expect(res.json().forecast.history.length).toBe(12);
    expect(res.json().forecast.projection.length).toBe(3);
  });

  it('blocks cross-org access', async () => {
    const a = await setup();
    const b = await setup();
    const res = await req(a.token, 'GET', `/api/orgs/${b.orgId}/forecast`);
    expect(res.statusCode).toBe(403);
  });

  it('requires auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/orgs/x/forecast' });
    expect(res.statusCode).toBe(401);
  });
});
