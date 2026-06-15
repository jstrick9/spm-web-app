import './../test/setup.js';
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { db } from '../db/database.js';
import { buildApp } from '../index.js';
import type { FastifyInstance } from 'fastify';
import { rolesRepo } from '../db/repos/index.js';

let app: FastifyInstance;
beforeAll(async () => { app = await buildApp(); await app.ready(); });

beforeEach(() => {
  for (const t of [
    'vendor_ratings', 'email_templates', 'payment_links',
    'budget_items', 'webhook_deliveries', 'webhooks',
    'push_subscriptions', 'sse_events',
    'audit_logs', 'direct_messages', 'event_answers', 'event_questions',
    'staff_shifts', 'staff_areas', 'staff_tasks', 'timeline_events',
    'vendor_payments', 'vendors', 'decor_packages', 'decor_arrangements',
    'decor_categories', 'decor_items', 'guest_portal_configs', 'rsvp_submissions',
    'guest_sub_event_invitations', 'guests', 'layout_versions', 'layouts',
    'catalog_items', 'venues', 'sub_events', 'event_memberships', 'events',
    'organization_memberships', 'organizations', 'users',
  ]) {
    try { db.prepare(`DELETE FROM ${t}`).run(); } catch { /* table may not exist */ }
  }
  try {
    db.prepare(`DELETE FROM role_permissions WHERE role_id IN (SELECT id FROM roles WHERE is_system = 0)`).run();
    db.prepare(`DELETE FROM roles WHERE is_system = 0`).run();
  } catch { /* ok */ }
  rolesRepo.ensureSystemRoles();
});

const req = (token: string, method: 'GET' | 'POST' | 'PATCH' | 'DELETE', url: string, payload?: unknown) =>
  app.inject({
    method, url,
    headers: payload !== undefined
      ? { authorization: `Bearer ${token}`, 'content-type': 'application/json' }
      : { authorization: `Bearer ${token}` },
    payload: payload as never,
  });

async function makeOrg(prefix: string) {
  const regRes = await app.inject({
    method: 'POST', url: '/api/auth/register',
    payload: {
      email: `${prefix}-${Math.random().toString(36).slice(2)}@x.com`,
      password: 'testpass123', fullName: 'Owner', orgName: `${prefix}Org`,
    },
    headers: { 'content-type': 'application/json' },
  });
  const token = regRes.json().token as string;
  const orgId = regRes.json().organizationId as string;

  const evtRes = await req(token, 'POST', '/api/events', { organizationId: orgId, title: `${prefix} Wedding` });
  const eventId = evtRes.json().event.id as string;

  const vendRes = await req(token, 'POST', `/api/orgs/${orgId}/vendors`, { name: `${prefix} Florist`, category: 'florals' });
  const vendorId = vendRes.json().vendor.id as string;

  return { token, orgId, eventId, vendorId };
}

describe('Intelligence — vendor ratings', () => {
  it('creates and lists a rating with aggregate', async () => {
    const s = await makeOrg('rate');
    const create = await req(s.token, 'POST', `/api/vendors/${s.vendorId}/ratings`, {
      eventId: s.eventId, rating: 5, qualityScore: 5, timelinessScore: 4, communicationScore: 5,
      review: 'Excellent service',
    });
    expect(create.statusCode).toBe(201);
    expect(create.json().rating.rating).toBe(5);

    const list = await req(s.token, 'GET', `/api/vendors/${s.vendorId}/ratings`);
    expect(list.statusCode).toBe(200);
    expect(list.json().ratings).toHaveLength(1);
    expect(list.json().aggregate.avgRating).toBe(5);
  });

  it('rejects invalid rating values', async () => {
    const s = await makeOrg('rate');
    const res = await req(s.token, 'POST', `/api/vendors/${s.vendorId}/ratings`, { eventId: s.eventId, rating: 9 });
    expect(res.statusCode).toBe(400);
  });

  it('404s on an unknown vendor', async () => {
    const s = await makeOrg('rate');
    const res = await req(s.token, 'POST', `/api/vendors/does-not-exist/ratings`, { eventId: s.eventId, rating: 4 });
    expect(res.statusCode).toBe(404);
  });

  it('requires authentication', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/vendors/x/ratings' });
    expect(res.statusCode).toBe(401);
  });

  // Regression: the empty-scope RBAC bug let an Org A user rate Org B vendors.
  it('blocks cross-org rating (IDOR regression)', async () => {
    const a = await makeOrg('orgA');
    const b = await makeOrg('orgB');
    // User A tries to rate a vendor that belongs to Org B.
    const create = await req(a.token, 'POST', `/api/vendors/${b.vendorId}/ratings`, { eventId: b.eventId, rating: 1 });
    expect(create.statusCode).toBe(403);
    // And cannot read Org B's vendor ratings either.
    const read = await req(a.token, 'GET', `/api/vendors/${b.vendorId}/ratings`);
    expect(read.statusCode).toBe(403);
  });
});

describe('Intelligence — email templates', () => {
  it('creates, lists, previews, and deletes a template', async () => {
    const s = await makeOrg('tpl');
    const create = await req(s.token, 'POST', `/api/orgs/${s.orgId}/email-templates`, {
      name: 'RSVP reminder', subject: 'Hi {{guest_name}}', bodyHtml: '<p>{{event_title}}</p>',
      category: 'rsvp_reminder',
    });
    expect(create.statusCode).toBe(201);
    const id = create.json().template.id as string;

    const list = await req(s.token, 'GET', `/api/orgs/${s.orgId}/email-templates`);
    expect(list.json().templates).toHaveLength(1);

    const preview = await req(s.token, 'POST', `/api/email-templates/${id}/preview`);
    expect(preview.statusCode).toBe(200);
    expect(preview.json().rendered.subject).toContain('Jane Smith');
    expect(preview.json().rendered.html).toContain('Smith Wedding');

    const del = await req(s.token, 'DELETE', `/api/email-templates/${id}`);
    expect(del.statusCode).toBe(204);
  });

  // Regression: preview previously had no RBAC check.
  it('blocks cross-org template preview', async () => {
    const a = await makeOrg('tplA');
    const b = await makeOrg('tplB');
    const create = await req(b.token, 'POST', `/api/orgs/${b.orgId}/email-templates`, {
      name: 'B secret', subject: 'x', bodyHtml: '<p>x</p>',
    });
    const id = create.json().template.id as string;
    const preview = await req(a.token, 'POST', `/api/email-templates/${id}/preview`);
    expect(preview.statusCode).toBe(403);
  });
});

describe('Intelligence — payment links', () => {
  it('creates, lists, and updates a payment status', async () => {
    const s = await makeOrg('pay');
    const create = await req(s.token, 'POST', `/api/events/${s.eventId}/payments`, {
      provider: 'manual', amountCents: 250000,
    });
    expect(create.statusCode).toBe(201);
    const id = create.json().payment.id as string;

    const list = await req(s.token, 'GET', `/api/events/${s.eventId}/payments`);
    expect(list.json().payments).toHaveLength(1);

    const patch = await req(s.token, 'PATCH', `/api/payments/${id}/status`, { status: 'completed' });
    expect(patch.statusCode).toBe(200);
    expect(patch.json().payment.status).toBe('completed');
  });

  it('rejects a non-positive amount', async () => {
    const s = await makeOrg('pay');
    const res = await req(s.token, 'POST', `/api/events/${s.eventId}/payments`, { amountCents: 0 });
    expect(res.statusCode).toBe(400);
  });
});

describe('Intelligence — recommendations', () => {
  it('returns the recommendations envelope', async () => {
    const s = await makeOrg('rec');
    const res = await req(s.token, 'GET', `/api/orgs/${s.orgId}/recommendations`);
    expect(res.statusCode).toBe(200);
    const r = res.json().recommendations;
    expect(r).toHaveProperty('budgetRange');
    expect(r).toHaveProperty('seasonalDemand');
    expect(Array.isArray(r.seasonalDemand)).toBe(true);
    expect(r).toHaveProperty('leadSourceEffectiveness');
  });

  it('blocks cross-org recommendations', async () => {
    const a = await makeOrg('recA');
    const b = await makeOrg('recB');
    const res = await req(a.token, 'GET', `/api/orgs/${b.orgId}/recommendations`);
    expect(res.statusCode).toBe(403);
  });
});

describe('Intelligence — Event Health Command Center', () => {
  it('consolidates risk, RSVP, timeline, vendor, guest identity, and forecast signals into actions', async () => {
    const s = await makeOrg('cmd');

    const soon = new Date(Date.now() + 10 * 86_400_000).toISOString().slice(0, 10);
    const overdue = new Date(Date.now() - 2 * 86_400_000).toISOString().slice(0, 10);
    db.prepare(`UPDATE events SET start_date = ?, rsvp_deadline = ?, budget_cents = ? WHERE id = ?`)
      .run(soon, overdue, 1000000, s.eventId);

    // RSVP lag + guest identity duplicate cluster.
    await req(s.token, 'POST', `/api/events/${s.eventId}/guests`, { fullName: 'Alex Guest', email: 'alex@example.com' });
    await req(s.token, 'POST', `/api/events/${s.eventId}/guests`, { fullName: 'Alex Guest', email: 'alex@example.com' });
    await req(s.token, 'POST', `/api/events/${s.eventId}/guests`, { fullName: 'Pending Guest 3' });

    // Low vendor reliability.
    const vendorRes = await req(s.token, 'POST', `/api/orgs/${s.orgId}/vendors`, {
      name: 'Risky DJ', category: 'music', eventId: s.eventId, contractAmountCents: 250000,
    });
    const vendorId = vendorRes.json().vendor.id as string;
    await req(s.token, 'POST', `/api/vendors/${vendorId}/ratings`, {
      eventId: s.eventId, rating: 1, qualityScore: 1, timelinessScore: 1, communicationScore: 1,
    });

    const res = await req(s.token, 'GET', `/api/orgs/${s.orgId}/health-command-center`);
    expect(res.statusCode).toBe(200);
    const cc = res.json().commandCenter;
    expect(cc.summary.openEvents).toBeGreaterThanOrEqual(1);
    expect(cc.summary.rsvpLagEvents).toBeGreaterThanOrEqual(1);
    expect(cc.summary.timelineIncompleteEvents).toBeGreaterThanOrEqual(1);
    expect(cc.summary.lowReliabilityVendors).toBeGreaterThanOrEqual(1);
    expect(cc.summary.guestDuplicateClusters).toBeGreaterThanOrEqual(1);

    const sources = cc.actions.map((a: any) => a.source);
    expect(sources).toContain('rsvp_lag');
    expect(sources).toContain('timeline_completeness');
    expect(sources).toContain('vendor_reliability');
    expect(sources).toContain('guest_identity');
    expect(cc.actions[0]).toHaveProperty('priority');
    expect(cc.actions[0]).toHaveProperty('href');
  });

  it('blocks cross-org command center access', async () => {
    const a = await makeOrg('cmdA');
    const b = await makeOrg('cmdB');
    const res = await req(a.token, 'GET', `/api/orgs/${b.orgId}/health-command-center`);
    expect(res.statusCode).toBe(403);
  });
});
