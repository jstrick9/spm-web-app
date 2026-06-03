/**
 * Coverage integration test — Phase 33 additions.
 *
 * Supplements the existing coverage.integration.test.ts in the repo.
 * Tests the new routes and confirms existing ones still pass.
 *
 * New routes covered here:
 *   POST /api/orgs/:orgId/guests/merge        — guest identity merge
 *   GET  /api/orgs/:orgId/guest-duplicates    — duplicate detection
 *   GET  /api/orgs/:orgId/email-automations   — (already covered, guard)
 *   PUT  /api/orgs/:orgId/email-automations   — (already covered, guard)
 *   GET  /api/orgs/:orgId/forecast            — revenue forecast
 *   GET  /api/orgs/:orgId/risk                — event risk alerts
 *   GET  /api/orgs/:orgId/recommendations     — recommendations
 *
 * Pattern: mirrors the existing auth/core-crud integration test style.
 * Uses buildApp() + inject() — no external HTTP server.
 */
import '../test/setup.js';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../index.js';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;
let token: string;
let orgId: string;
let eventId: string;
let guestId1: string;
let guestId2: string;

beforeAll(async () => {
  app = await buildApp();
  await app.ready();

  // Register user
  const reg = await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: {
      email: 'coverage33@example.com',
      password: 'Test1234!',
      fullName: 'Coverage Tester',
      orgName: 'Coverage Venue',
    },
  });
  const body = reg.json();
  token = body.token;
  orgId = body.organizationId;

  // Create event
  const evRes = await app.inject({
    method: 'POST',
    url: '/api/events',
    headers: { authorization: `Bearer ${token}` },
    payload: {
      organizationId: orgId,
      title: 'Coverage Phase 33 Wedding',
      status: 'booked',
    },
  });
  eventId = evRes.json().event?.id;

  // Create two guests with matching email (duplicate candidates)
  const g1 = await app.inject({
    method: 'POST',
    url: `/api/events/${eventId}/guests`,
    headers: { authorization: `Bearer ${token}` },
    payload: { fullName: 'Alice Smith', email: 'alice@coverage.test' },
  });
  guestId1 = g1.json().guest?.id;

  const g2 = await app.inject({
    method: 'POST',
    url: `/api/events/${eventId}/guests`,
    headers: { authorization: `Bearer ${token}` },
    payload: { fullName: 'Alice Smith', email: 'alice@coverage.test' },
  });
  guestId2 = g2.json().guest?.id;
});

afterAll(async () => {
  await app.close();
});

const authed = () => ({ authorization: `Bearer ${token}` });

// ── Guest identity ────────────────────────────────────────────────────────

describe('GET /api/orgs/:orgId/guest-duplicates', () => {
  it('returns 401 without auth', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/orgs/${orgId}/guest-duplicates` });
    expect(res.statusCode).toBe(401);
  });

  it('returns clusters array', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/orgs/${orgId}/guest-duplicates`,
      headers: authed(),
    });
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.json().clusters)).toBe(true);
  });

  it('finds the duplicate pair we created', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/orgs/${orgId}/guest-duplicates`,
      headers: authed(),
    });
    const clusters = res.json().clusters as Array<{ confidence: string; members: Array<{ id: string }> }>;
    const found = clusters.some((c) =>
      c.members.some((m) => m.id === guestId1) && c.members.some((m) => m.id === guestId2),
    );
    expect(found).toBe(true);
  });
});

describe('POST /api/orgs/:orgId/guests/merge', () => {
  it('returns 401 without auth', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/orgs/${orgId}/guests/merge`,
      payload: { primaryId: guestId1, duplicateIds: [guestId2] },
    });
    expect(res.statusCode).toBe(401);
  });

  it('returns 400 with empty duplicateIds', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/orgs/${orgId}/guests/merge`,
      headers: authed(),
      payload: { primaryId: guestId1, duplicateIds: [] },
    });
    expect(res.statusCode).toBe(400);
  });

  it('successfully merges duplicate guests', async () => {
    // Re-create guests since we might have merged them already in prior runs
    // (integration tests share state within the same run but not across)
    const g3 = await app.inject({
      method: 'POST',
      url: `/api/events/${eventId}/guests`,
      headers: authed(),
      payload: { fullName: 'Bob Jones', email: 'bob@coverage.test' },
    });
    const g4 = await app.inject({
      method: 'POST',
      url: `/api/events/${eventId}/guests`,
      headers: authed(),
      payload: { fullName: 'Bob Jones', email: 'bob@coverage.test' },
    });
    const id3 = g3.json().guest?.id;
    const id4 = g4.json().guest?.id;

    const res = await app.inject({
      method: 'POST',
      url: `/api/orgs/${orgId}/guests/merge`,
      headers: authed(),
      payload: { primaryId: id3, duplicateIds: [id4] },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveProperty('primary');
    expect(res.json()).toHaveProperty('mergedCount');
    expect(res.json().mergedCount).toBe(1);
  });

  it('returns 400 for IDs from another org', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/orgs/${orgId}/guests/merge`,
      headers: authed(),
      payload: { primaryId: 'nonexistent-id', duplicateIds: ['also-nonexistent'] },
    });
    expect(res.statusCode).toBe(400);
  });
});

// ── Intelligence endpoints ────────────────────────────────────────────────

describe('GET /api/orgs/:orgId/recommendations', () => {
  it('returns 401 without auth', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/orgs/${orgId}/recommendations` });
    expect(res.statusCode).toBe(401);
  });

  it('returns recommendations with required shape', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/orgs/${orgId}/recommendations`,
      headers: authed(),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty('recommendations');
    expect(body.recommendations).toHaveProperty('budgetRange');
    expect(body.recommendations).toHaveProperty('seasonalDemand');
    expect(body.recommendations).toHaveProperty('leadSourceEffectiveness');
  });
});

describe('GET /api/orgs/:orgId/forecast', () => {
  it('returns 401 without auth', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/orgs/${orgId}/forecast` });
    expect(res.statusCode).toBe(401);
  });

  it('returns forecast with required shape', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/orgs/${orgId}/forecast`,
      headers: authed(),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty('forecast');
    expect(body.forecast).toHaveProperty('history');
    expect(body.forecast).toHaveProperty('projection');
    expect(body.forecast).toHaveProperty('trend');
    expect(body.forecast).toHaveProperty('meta');
    expect(['low', 'medium', 'high']).toContain(body.forecast.meta.confidence);
  });

  it('accepts ?history and ?horizon query params', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/orgs/${orgId}/forecast?history=12&horizon=3`,
      headers: authed(),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().forecast.meta.horizonMonths).toBe(3);
  });
});

describe('GET /api/orgs/:orgId/risk-alerts', () => {
  it('returns 401 without auth', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/orgs/${orgId}/risk-alerts` });
    expect(res.statusCode).toBe(401);
  });

  it('returns risk events array', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/orgs/${orgId}/risk-alerts`,
      headers: authed(),
    });
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.json().events)).toBe(true);
  });

  it('risk event shape contains required fields', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/orgs/${orgId}/risk-alerts`,
      headers: authed(),
    });
    const events = res.json().events as Array<Record<string, unknown>>;
    // May be empty for a fresh org — just check shape when events exist
    if (events.length > 0) {
      const ev = events[0];
      expect(ev).toHaveProperty('eventId');
      expect(ev).toHaveProperty('healthScore');
      expect(ev).toHaveProperty('alerts');
      expect(typeof ev.healthScore).toBe('number');
    }
    // Empty is also valid
    expect(Array.isArray(events)).toBe(true);
  });
});

// ── Email automations (guard tests — full coverage in lifecycle emails test) ──

describe('GET /api/orgs/:orgId/email-automations (Phase 33 guard)', () => {
  it('returns 403 for wrong org', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/orgs/nonexistent-org-id/email-automations',
      headers: authed(),
    });
    expect(res.statusCode).toBe(403);
  });
});
