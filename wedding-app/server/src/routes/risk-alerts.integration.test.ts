import './../test/setup.js';
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { db } from '../db/database.js';
import { buildApp } from '../index.js';
import type { FastifyInstance } from 'fastify';
import { rolesRepo, eventsRepo, guestsRepo, contractsRepo, budgetRepo, riskRepo } from '../db/repos/index.js';

let app: FastifyInstance;
beforeAll(async () => { app = await buildApp(); await app.ready(); });

beforeEach(() => {
  for (const t of [
    'contracts', 'budget_items', 'timeline_events', 'vendors', 'guests',
    'event_memberships', 'events', 'organization_memberships', 'organizations', 'users', 'audit_logs',
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
    payload: { email: `rk-${Math.random().toString(36).slice(2)}@x.com`, password: 'testpass123', fullName: 'O', orgName: 'RkOrg' },
    headers: { 'content-type': 'application/json' } });
  return { token: r.json().token as string, orgId: r.json().organizationId as string, userId: r.json().user.id as string };
}

/** ISO date `days` from now (UTC). */
function dateIn(days: number): string {
  const d = new Date(); d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

describe('riskRepo.forEvent', () => {
  it('flags RSVP deadline passed with pending guests (critical)', async () => {
    const s = await setup();
    const e = eventsRepo.create({ organizationId: s.orgId, title: 'Late RSVP', status: 'booked', startDate: dateIn(20), createdBy: s.userId });
    db.prepare(`UPDATE events SET rsvp_deadline = ? WHERE id = ?`).run(dateIn(-3), e.id);
    guestsRepo.create(s.orgId, e.id, { fullName: 'A', rsvpStatus: 'pending' });
    guestsRepo.create(s.orgId, e.id, { fullName: 'B', rsvpStatus: 'attending' });

    const risk = riskRepo.forEvent(e.id)!;
    const a = risk.alerts.find(x => x.kind === 'rsvp_overdue');
    expect(a).toBeTruthy();
    expect(a!.severity).toBe('critical');
    expect(risk.healthScore).toBeLessThan(100);
  });

  it('flags unsigned contracts near the event (critical when very soon)', async () => {
    const s = await setup();
    const e = eventsRepo.create({ organizationId: s.orgId, title: 'Soon', status: 'planning', startDate: dateIn(7), createdBy: s.userId });
    contractsRepo.create({ organizationId: s.orgId, eventId: e.id, title: 'Venue', recipientName: 'X', createdBy: s.userId }); // draft

    const risk = riskRepo.forEvent(e.id)!;
    const a = risk.alerts.find(x => x.kind === 'unsigned_contracts');
    expect(a).toBeTruthy();
    expect(a!.severity).toBe('critical');
    expect(a!.href).toContain('tab=contracts');
  });

  it('flags budget overrun when actual exceeds planned', async () => {
    const s = await setup();
    const e = eventsRepo.create({ organizationId: s.orgId, title: 'Overspend', status: 'planning', startDate: dateIn(120), createdBy: s.userId });
    budgetRepo.create(s.orgId, e.id, { category: 'Catering', title: 'Dinner', plannedCents: 100000, actualCents: 140000, paidCents: 0 }, s.userId);

    const risk = riskRepo.forEvent(e.id)!;
    const a = risk.alerts.find(x => x.kind === 'budget_overrun');
    expect(a).toBeTruthy();
    expect(['warning', 'critical']).toContain(a!.severity);
  });

  it('flags a large balance due near the event', async () => {
    const s = await setup();
    const e = eventsRepo.create({ organizationId: s.orgId, title: 'Owes', status: 'booked', startDate: dateIn(10), createdBy: s.userId });
    budgetRepo.create(s.orgId, e.id, { category: 'Venue', title: 'Rental', plannedCents: 200000, actualCents: 200000, paidCents: 20000 }, s.userId);

    const risk = riskRepo.forEvent(e.id)!;
    expect(risk.alerts.some(x => x.kind === 'balance_due')).toBe(true);
  });

  it('flags no vendors + no timeline for a very-soon event', async () => {
    const s = await setup();
    const e = eventsRepo.create({ organizationId: s.orgId, title: 'Bare', status: 'booked', startDate: dateIn(5), createdBy: s.userId });
    const risk = riskRepo.forEvent(e.id)!;
    expect(risk.alerts.some(x => x.kind === 'no_vendors')).toBe(true);
    expect(risk.alerts.some(x => x.kind === 'no_timeline')).toBe(true);
  });

  it('flags over-capacity when attending exceeds planned guest count', async () => {
    const s = await setup();
    const e = eventsRepo.create({ organizationId: s.orgId, title: 'Packed', status: 'planning', startDate: dateIn(200), guestCount: 1, createdBy: s.userId });
    guestsRepo.create(s.orgId, e.id, { fullName: 'A', rsvpStatus: 'attending' });
    guestsRepo.create(s.orgId, e.id, { fullName: 'B', rsvpStatus: 'attending' });
    const risk = riskRepo.forEvent(e.id)!;
    expect(risk.alerts.some(x => x.kind === 'over_capacity')).toBe(true);
  });

  it('returns full health with no alerts for a far-off, well-prepared event', async () => {
    const s = await setup();
    const e = eventsRepo.create({ organizationId: s.orgId, title: 'Chill', status: 'planning', startDate: dateIn(300), createdBy: s.userId });
    const risk = riskRepo.forEvent(e.id)!;
    expect(risk.alerts).toHaveLength(0);
    expect(risk.healthScore).toBe(100);
  });

  it('health score decreases with severity', async () => {
    const s = await setup();
    const e = eventsRepo.create({ organizationId: s.orgId, title: 'Risky', status: 'booked', startDate: dateIn(5), createdBy: s.userId });
    contractsRepo.create({ organizationId: s.orgId, eventId: e.id, title: 'C', recipientName: 'X', createdBy: s.userId });
    const risk = riskRepo.forEvent(e.id)!;
    // at least unsigned_contracts (critical) + no_vendors + no_timeline (warnings)
    expect(risk.healthScore).toBeLessThanOrEqual(100 - 30);
  });
});

describe('riskRepo.forOrg', () => {
  it('returns only events with alerts, riskiest first, excludes completed/cancelled', async () => {
    const s = await setup();
    // Risky (very soon, unsigned contract → critical)
    const risky = eventsRepo.create({ organizationId: s.orgId, title: 'Risky', status: 'booked', startDate: dateIn(3), createdBy: s.userId });
    contractsRepo.create({ organizationId: s.orgId, eventId: risky.id, title: 'C', recipientName: 'X', createdBy: s.userId });
    // Healthy far-off
    eventsRepo.create({ organizationId: s.orgId, title: 'Healthy', status: 'planning', startDate: dateIn(300), createdBy: s.userId });
    // Completed (excluded entirely)
    const done = eventsRepo.create({ organizationId: s.orgId, title: 'Done', status: 'completed', startDate: dateIn(2), createdBy: s.userId });
    contractsRepo.create({ organizationId: s.orgId, eventId: done.id, title: 'C', recipientName: 'X', createdBy: s.userId });

    const events = riskRepo.forOrg(s.orgId);
    const titles = events.map(e => e.eventTitle);
    expect(titles).toContain('Risky');
    expect(titles).not.toContain('Healthy'); // no alerts → filtered out
    expect(titles).not.toContain('Done');    // completed → excluded
    expect(events[0].eventTitle).toBe('Risky'); // riskiest first
  });
});

describe('risk routes', () => {
  it('GET /events/:id/risk-alerts requires events.view', async () => {
    const s = await setup();
    const e = eventsRepo.create({ organizationId: s.orgId, title: 'E', status: 'booked', startDate: dateIn(5), createdBy: s.userId });
    const res = await req(s.token, 'GET', `/api/events/${e.id}/risk-alerts`);
    expect(res.statusCode).toBe(200);
    expect(res.json().risk.eventId).toBe(e.id);
  });

  it('GET /orgs/:id/risk-alerts returns the org list', async () => {
    const s = await setup();
    const e = eventsRepo.create({ organizationId: s.orgId, title: 'E', status: 'booked', startDate: dateIn(5), createdBy: s.userId });
    contractsRepo.create({ organizationId: s.orgId, eventId: e.id, title: 'C', recipientName: 'X', createdBy: s.userId });
    const res = await req(s.token, 'GET', `/api/orgs/${s.orgId}/risk-alerts`);
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.json().events)).toBe(true);
  });

  it('blocks cross-org risk listing', async () => {
    const a = await setup();
    const b = await setup();
    const res = await req(a.token, 'GET', `/api/orgs/${b.orgId}/risk-alerts`);
    expect(res.statusCode).toBe(403);
  });

  it('requires auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/orgs/x/risk-alerts' });
    expect(res.statusCode).toBe(401);
  });
});
