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
  for (const t of ['vendor_checkins', 'vendor_payments', 'vendors', 'events', 'sse_events', 'audit_logs', 'organization_memberships', 'organizations', 'users']) {
    try { db.prepare(`DELETE FROM ${t}`).run(); } catch { /* noop */ }
  }
});

async function register(prefix: string, orgName = 'Vendors Org') {
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

async function createEvent(token: string, orgId: string) {
  const r = await authed(token, 'POST', '/api/events', { organizationId: orgId, title: 'Test Wedding', status: 'booked', startDate: '2026-09-12' });
  expect(r.statusCode).toBe(201);
  return r.json().event as { id: string; organization_id: string };
}

async function createVendor(token: string, orgId: string, eventId: string | null, over: Record<string, unknown> = {}) {
  const r = await authed(token, 'POST', `/api/orgs/${orgId}/vendors`, { name: 'DJ Dave', category: 'dj', email: 'dj@example.com', eventId, ...over });
  expect(r.statusCode).toBe(201);
  return r.json().vendor as { id: string; organization_id: string; event_id: string | null };
}

describe('Vendor check-in integrity', () => {
  it('deep-merges vendor metadata from venue and portal writers', async () => {
    const { token, orgId } = await register('ve-merge');
    const e1 = await createEvent(token, orgId);
    const v = await createVendor(token, orgId, e1.id);

    // Venue staff saves COI fields from their snapshot (no questionnaire yet).
    const r1 = await authed(token, 'PATCH', `/api/vendors/${v.id}`, {
      metadata: { coi: { insurer: 'State Farm', policyNumber: 'P-1' } },
    });
    expect(r1.statusCode).toBe(200);

    // Vendor portal questionnaire submits from ITS stale base (no COI data).
    const meta = { questionnaire: { loadInRoute: 'Dock A', powerNeeds: '20A' }, submittedAt: new Date().toISOString() };
    const r2 = await authed(token, 'PATCH', `/api/vendors/${v.id}`, { metadata: meta });
    expect(r2.statusCode).toBe(200);

    const get = await authed(token, 'GET', `/api/orgs/${orgId}/vendors`);
    const vendor = get.json().vendors.find((x: any) => x.id === v.id);
    const m = JSON.parse(vendor.metadata || '{}');
    expect(m.coi.insurer).toBe('State Farm');
    expect(m.questionnaire.loadInRoute).toBe('Dock A');
  });

  it('rejects checking in a vendor from a different event', async () => {
    const { token, orgId } = await register('ve-checkin');
    const e1 = await createEvent(token, orgId);
    const e2 = await createEvent(token, orgId);
    const v = await createVendor(token, orgId, e1.id);

    const bad = await authed(token, 'POST', `/api/events/${e2.id}/checkins`, { vendorId: v.id, status: 'arrived' });
    expect(bad.statusCode).toBe(400);
    expect(bad.json().error).toBe('vendor-not-in-event');

    const good = await authed(token, 'POST', `/api/events/${e1.id}/checkins`, { vendorId: v.id, status: 'arrived' });
    expect(good.statusCode).toBe(200);
  });

  it('reports late vendors in counts', async () => {
    const { token, orgId } = await register('ve-late');
    const e1 = await createEvent(token, orgId);
    const v = await createVendor(token, orgId, e1.id);
    await authed(token, 'POST', `/api/events/${e1.id}/checkins`, { vendorId: v.id, status: 'late' });
    const list = await authed(token, 'GET', `/api/events/${e1.id}/checkins`);
    expect(list.json().counts.late).toBe(1);
  });
});

describe('COI review workflow', () => {
  it('rejects review before a COI is received', async () => {
    const { token, orgId } = await register('ve-coi-none');
    const e1 = await createEvent(token, orgId);
    const v = await createVendor(token, orgId, e1.id);
    const res = await authed(token, 'POST', `/api/vendors/${v.id}/coi-review`, { status: 'approved' });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('coi-not-received');
  });

  it('approves a received COI, audits, and reflects the status', async () => {
    const { token, orgId } = await register('ve-coi');
    const e1 = await createEvent(token, orgId);
    const v = await createVendor(token, orgId, e1.id);

    // Simulate a vendor-uploaded COI (metadata written directly).
    const meta = { coiReceived: true, coiVerificationStatus: 'pending_review', coiAssetId: 'asset-1' };
    await authed(token, 'PATCH', `/api/vendors/${v.id}`, { metadata: meta });

    const res = await authed(token, 'POST', `/api/vendors/${v.id}/coi-review`, { status: 'approved', note: 'Looks good' });
    expect(res.statusCode).toBe(200);
    const parsed = typeof res.json().vendor.metadata === 'string' ? JSON.parse(res.json().vendor.metadata) : res.json().vendor.metadata;
    expect(parsed.coiVerificationStatus).toBe('approved');
    expect(parsed.coiReviewedBy).toBeTruthy();

    const audit = db.prepare(`SELECT COUNT(*) AS n FROM audit_logs WHERE action = 'vendor.coi.review' AND target_id = ?`).get(v.id) as { n: number };
    expect(audit.n).toBe(1);
  });

  it('shows the review decision in the public vendor portal view', async () => {
    const { token, orgId } = await register('ve-coi-portal');
    const e1 = await createEvent(token, orgId);
    const v = await createVendor(token, orgId, e1.id);
    const meta = { coiReceived: true, coiVerificationStatus: 'approved', coiReviewedBy: 'owner@x.com' };
    await authed(token, 'PATCH', `/api/vendors/${v.id}`, { metadata: meta });
    const { token: portalToken } = await authed(token, 'POST', `/api/vendors/${v.id}/portal-token`, { expiresInDays: 30 }).then((r) => r.json());

    const info = await app.inject({ method: 'GET', url: `/api/portal/vendors/${v.id}/info?token=${portalToken}` });
    expect(info.statusCode).toBe(200);
    const vendorMeta = typeof info.json().vendor.metadata === 'string' ? JSON.parse(info.json().vendor.metadata) : info.json().vendor.metadata;
    expect(vendorMeta.coiVerificationStatus).toBe('approved');
  });
});

describe('Vendor portal data sanitization (VE-04)', () => {
  it('strips internal event metadata and other vendors internal timeline notes', async () => {
    const { token, orgId } = await register('ve-sanitize');
    const e1 = await createEvent(token, orgId);
    const v = await createVendor(token, orgId, e1.id);

    // Internal event metadata (must never reach the vendor portal).
    await authed(token, 'PATCH', `/api/events/${e1.id}`, { metadata: { budgetCents: 999999, salesToOperationsHandoff: { secret: true }, dayOfContact: { name: 'Internal' }, managerWarning: 'internal' } });
    // Timeline: one item assigned to this vendor (full), one internal for another vendor.
    const t1 = await authed(token, 'POST', `/api/events/${e1.id}/timeline`, { title: 'Vendor load-in', startsAt: '2026-09-12T08:00:00', vendorId: v.id, notes: 'Vendor-specific detail', metadata: {} });
    const t2 = await authed(token, 'POST', `/api/events/${e1.id}/timeline`, { title: 'Internal huddle', startsAt: '2026-09-12T07:00:00', notes: 'SECRET INTERNAL NOTES', metadata: {} });
    expect(t1.statusCode).toBe(201);
    expect(t2.statusCode).toBe(201);

    const { token: portalToken } = await authed(token, 'POST', `/api/vendors/${v.id}/portal-token`, { expiresInDays: 30 }).then((r) => r.json());
    const info = await app.inject({ method: 'GET', url: `/api/portal/vendors/${v.id}/info?token=${portalToken}` });
    expect(info.statusCode).toBe(200);

    // Event is sanitized — no internal metadata fields.
    expect(info.json().event.metadata).toBeUndefined();
    expect(info.json().event.title).toBe('Test Wedding');

    // Own item keeps notes; the internal item loses its notes.
    const own = info.json().timeline.find((i: any) => i.title === 'Vendor load-in');
    const internal = info.json().timeline.find((i: any) => i.title === 'Internal huddle');
    expect(own.notes).toBe('Vendor-specific detail');
    expect(internal.notes).not.toBe('SECRET INTERNAL NOTES');
    expect(internal.title).toBe('Internal huddle');
  });
});

describe('Vendor payments', () => {
  it('audits add + delete and decrements the running total', async () => {
    const { token, orgId } = await register('ve-pay');
    const e1 = await createEvent(token, orgId);
    const v = await createVendor(token, orgId, e1.id, { contractAmountCents: 100000 });

    const add = await authed(token, 'POST', `/api/vendors/${v.id}/payments`, { amountCents: 40000, paidAt: '2026-08-01', method: 'Check' });
    expect(add.statusCode).toBe(201);
    const addAudit = db.prepare(`SELECT COUNT(*) AS n FROM audit_logs WHERE action = 'vendor.payment.add' AND target_id = ?`).get(v.id) as { n: number };
    expect(addAudit.n).toBe(1);

    const paymentId = add.json().payment.id as string;
    const del = await authed(token, 'DELETE', `/api/vendors/${v.id}/payments/${paymentId}`);
    expect(del.statusCode).toBe(204);

    const delAudit = db.prepare(`SELECT details FROM audit_logs WHERE action = 'vendor.payment.delete' AND target_id = ?`).get(v.id) as { details: string } | undefined;
    expect(delAudit).toBeTruthy();
    expect(JSON.parse(delAudit!.details).amountCents).toBe(40000);

    const list = await authed(token, 'GET', `/api/orgs/${orgId}/vendors`);
    const updated = list.json().vendors.find((x: any) => x.id === v.id);
    expect(updated.amount_paid_cents).toBe(0);

    const missing = await authed(token, 'DELETE', `/api/vendors/${v.id}/payments/does-not-exist`);
    expect(missing.statusCode).toBe(404);
  });
});

describe('Vendor lifecycle audit + realtime', () => {
  it('audits vendor update and delete, and broadcasts SSE', async () => {
    const { token, orgId } = await register('ve-life');
    const e1 = await createEvent(token, orgId);
    const v = await createVendor(token, orgId, e1.id);

    const upd = await authed(token, 'PATCH', `/api/vendors/${v.id}`, { isPreferred: true });
    expect(upd.statusCode).toBe(200);
    const updAudit = db.prepare(`SELECT COUNT(*) AS n FROM audit_logs WHERE action = 'vendor.update' AND target_id = ?`).get(v.id) as { n: number };
    expect(updAudit.n).toBe(1);

    const del = await authed(token, 'DELETE', `/api/vendors/${v.id}`);
    expect(del.statusCode).toBe(204);
    const delAudit = db.prepare(`SELECT COUNT(*) AS n FROM audit_logs WHERE action = 'vendor.delete' AND target_id = ?`).get(v.id) as { n: number };
    expect(delAudit.n).toBe(1);

    const sse = db.prepare(`SELECT event_type FROM sse_events WHERE organization_id = ? AND event_type IN ('vendor.updated','vendor.deleted') ORDER BY rowid DESC LIMIT 1`).get(orgId) as { event_type: string } | undefined;
    expect(sse).toBeTruthy();
  });
});
