/**
 * MODULE-06 — Finance & Contracts regression tests.
 *
 * Covers FI-01..FI-15 from docs/MODULE-06-FINANCE-CONTRACTS.md: e-signature
 * grants + re-sign guard, event-scoped finance access, go/no-go flag
 * lifecycle, obligation decisions, pure financial-legal GET, audits + SSE,
 * cross-org reference validation, webhook rate limit, escalation permission
 * tightening, contract send email delivery, provider enum, view-audit noise.
 */
import './../test/setup.js';
import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../index.js';
import { db } from '../db/database.js';
import { eventsRepo, orgsRepo, rolesRepo, integrationsRepo } from '../db/repos/index.js';
import { SYSTEM_ROLE_IDS } from '../lib/permissions.js';
import { sealSecret } from '../lib/secrets.js';

let app: FastifyInstance;

beforeAll(async () => { app = await buildApp(); await app.ready(); });
beforeEach(() => { db.exec('BEGIN'); });
afterEach(async () => { db.exec('ROLLBACK'); });

interface Owner { token: string; orgId: string; userId: string }

async function registerOwner(): Promise<Owner> {
  const email = `mod6-owner-${Math.random().toString(36).slice(2)}@x.com`;
  const res = await app.inject({
    method: 'POST', url: '/api/auth/register',
    payload: { email, password: 'testpass123', fullName: 'Owner', orgName: 'Module6 Manor' },
    headers: { 'content-type': 'application/json' },
  });
  expect(res.statusCode).toBe(201);
  return { token: res.json().token, orgId: res.json().organizationId, userId: res.json().user.id };
}

async function createEvent(owner: Owner, title = 'Module6 Wedding'): Promise<string> {
  const res = await app.inject({
    method: 'POST', url: '/api/events',
    payload: { organizationId: owner.orgId, title },
    headers: { authorization: `Bearer ${owner.token}`, 'content-type': 'application/json' },
  });
  expect(res.statusCode).toBe(201);
  return res.json().event.id;
}

async function createUser(email: string): Promise<{ id: string; token: string }> {
  const res = await app.inject({
    method: 'POST', url: '/api/auth/register',
    payload: { email, password: 'testpass123', fullName: 'Member', orgName: `Tmp-${email}` },
    headers: { 'content-type': 'application/json' },
  });
  expect(res.statusCode).toBe(201);
  return { id: res.json().user.id, token: res.json().token };
}

async function createContract(owner: Owner, eventId: string, extra: Record<string, unknown> = {}): Promise<string> {
  const res = await app.inject({
    method: 'POST', url: `/api/events/${eventId}/contracts`,
    payload: {
      title: 'Venue Agreement', recipientName: 'Jane & Alex',
      recipientEmail: 'couple@example.com', amountCents: 250000,
      content: 'This agreement covers load-in, insurance/COI requirements, cleanup, and overtime curfew.',
      ...extra,
    },
    headers: { authorization: `Bearer ${owner.token}`, 'content-type': 'application/json' },
  });
  expect(res.statusCode).toBe(201);
  return res.json().contract.id;
}

function auditActions(orgId: string, action: string): number {
  return (db.prepare(`SELECT COUNT(*) AS n FROM audit_logs WHERE organization_id = ? AND action = ?`).get(orgId, action) as { n: number }).n;
}

function sseRows(orgId: string, eventType: string): number {
  return (db.prepare(`SELECT COUNT(*) AS n FROM sse_events WHERE organization_id = ? AND event_type = ?`).get(orgId, eventType) as { n: number }).n;
}

describe('FI-02 — event-scoped finance access', () => {
  it('event-scoped planner can manage budget, contracts, and payments', async () => {
    const owner = await registerOwner();
    const eventId = await createEvent(owner);
    const planner = await createUser(`fin-planner-${Math.random().toString(36).slice(2)}@x.com`);
    const role = rolesRepo.createCustom({
      organizationId: owner.orgId, key: 'fin_planner', name: 'Finance Planner', createdBy: owner.userId, hierarchy: 60,
      permissions: ['events.view', 'budget.view', 'budget.manage', 'contracts.view', 'contracts.manage', 'contracts.sign'] as never,
    });
    eventsRepo.addMember({ eventId, userId: planner.id, roleId: role.id });
    const auth = { authorization: `Bearer ${planner.token}`, 'content-type': 'application/json' };

    // Budget write
    const budgetCreate = await app.inject({
      method: 'POST', url: `/api/events/${eventId}/budget`,
      payload: { category: 'Catering', title: 'Dinner service', plannedCents: 100000 },
      headers: auth,
    });
    expect(budgetCreate.statusCode).toBe(201);
    const budgetPatch = await app.inject({
      method: 'PATCH', url: `/api/budget/${budgetCreate.json().item.id}`,
      payload: { plannedCents: 120000 },
      headers: auth,
    });
    expect(budgetPatch.statusCode).toBe(200);

    // Contract write
    const contractId = await createContract(owner, eventId);
    const patch = await app.inject({
      method: 'PATCH', url: `/api/contracts/${contractId}`,
      payload: { title: 'Venue Agreement v2' },
      headers: auth,
    });
    expect(patch.statusCode).toBe(200);
    const send = await app.inject({ method: 'POST', url: `/api/contracts/${contractId}/send`, payload: {}, headers: auth });
    expect(send.statusCode).toBe(200);
    const sign = await app.inject({
      method: 'POST', url: `/api/contracts/${contractId}/sign`,
      payload: { signature: 'Planner Countersign' },
      headers: auth,
    });
    expect(sign.statusCode).toBe(200);

    // Payment status write
    const payment = await app.inject({
      method: 'POST', url: `/api/events/${eventId}/payments`,
      payload: { provider: 'manual', amountCents: 50000, metadata: { dueDate: '2026-08-15', milestone: 'Deposit' } },
      headers: auth,
    });
    expect(payment.statusCode).toBe(201);
    const statusPatch = await app.inject({
      method: 'PATCH', url: `/api/payments/${payment.json().payment.id}/status`,
      payload: { status: 'completed', reconciliationNote: 'Cash received' },
      headers: auth,
    });
    expect(statusPatch.statusCode).toBe(200);
    expect(statusPatch.json().payment.status).toBe('completed');
  });
});

describe('FI-01/09 — e-signature', () => {
  it('staff cannot sign; owner can; re-sign is rejected', async () => {
    const owner = await registerOwner();
    const eventId = await createEvent(owner);
    const staff = await createUser(`fin-staff-${Math.random().toString(36).slice(2)}@x.com`);
    orgsRepo.addMember({ orgId: owner.orgId, userId: staff.id, roleId: SYSTEM_ROLE_IDS.staff });
    const contractId = await createContract(owner, eventId);

    const staffSign = await app.inject({
      method: 'POST', url: `/api/contracts/${contractId}/sign`,
      payload: { signature: 'Staff Sig' },
      headers: { authorization: `Bearer ${staff.token}`, 'content-type': 'application/json' },
    });
    expect(staffSign.statusCode).toBe(403);

    const sign = await app.inject({
      method: 'POST', url: `/api/contracts/${contractId}/sign`,
      payload: { signature: 'Owner Sig' },
      headers: { authorization: `Bearer ${owner.token}`, 'content-type': 'application/json' },
    });
    expect(sign.statusCode).toBe(200);
    expect(sign.json().contract.status).toBe('signed');

    const resign = await app.inject({
      method: 'POST', url: `/api/contracts/${contractId}/sign`,
      payload: { signature: 'Impostor Sig' },
      headers: { authorization: `Bearer ${owner.token}`, 'content-type': 'application/json' },
    });
    expect(resign.statusCode).toBe(400);
    expect(resign.json().error).toBe('contract-already-signed');

    // Audits + SSE for the genuine signature
    expect(auditActions(owner.orgId, 'contract.sign')).toBe(1);
    expect(sseRows(owner.orgId, 'contract.signed')).toBe(1);
  });

  it('couple sign route also rejects re-signing and broadcasts', async () => {
    const owner = await registerOwner();
    const eventId = await createEvent(owner);
    const couple = await createUser(`fin-couple-${Math.random().toString(36).slice(2)}@x.com`);
    eventsRepo.addMember({ eventId, userId: couple.id, roleId: SYSTEM_ROLE_IDS.couple });
    const contractId = await createContract(owner, eventId);
    const auth = { authorization: `Bearer ${couple.token}`, 'content-type': 'application/json' };

    const first = await app.inject({
      method: 'POST', url: `/api/events/${eventId}/couple-finance/contracts/${contractId}/sign`,
      payload: { signature: 'Jane Client' },
      headers: auth,
    });
    expect(first.statusCode).toBe(200);
    expect(sseRows(owner.orgId, 'contract.signed')).toBe(1);

    const second = await app.inject({
      method: 'POST', url: `/api/events/${eventId}/couple-finance/contracts/${contractId}/sign`,
      payload: { signature: 'Jane Client 2' },
      headers: auth,
    });
    expect(second.statusCode).toBe(400);
    expect(second.json().error).toBe('contract-already-signed');
  });
});

describe('FI-03 — go/no-go flag lifecycle', () => {
  it('manager cannot approve; owner can; manager resolves', async () => {
    const owner = await registerOwner();
    const eventId = await createEvent(owner);
    const manager = await createUser(`fin-mgr-${Math.random().toString(36).slice(2)}@x.com`);
    orgsRepo.addMember({ orgId: owner.orgId, userId: manager.id, roleId: SYSTEM_ROLE_IDS.manager });
    const mgrAuth = { authorization: `Bearer ${manager.token}`, 'content-type': 'application/json' };
    const ownerAuth = { authorization: `Bearer ${owner.token}`, 'content-type': 'application/json' };

    const created = await app.inject({
      method: 'POST', url: `/api/events/${eventId}/financial-legal/escalations`,
      payload: { severity: 'blocked', label: 'Unsigned ops contract blocks event', createGoNoGoFlag: true },
      headers: mgrAuth,
    });
    expect(created.statusCode).toBe(201);
    const flagId = created.json().flag.id;

    const mgrApprove = await app.inject({
      method: 'POST', url: `/api/events/${eventId}/financial-legal/go-no-go-flags/${flagId}/approve`,
      payload: {},
      headers: mgrAuth,
    });
    expect(mgrApprove.statusCode).toBe(403);
    expect(mgrApprove.json().error).toBe('owner-approval-required');

    const ownerApprove = await app.inject({
      method: 'POST', url: `/api/events/${eventId}/financial-legal/go-no-go-flags/${flagId}/approve`,
      payload: {},
      headers: ownerAuth,
    });
    expect(ownerApprove.statusCode).toBe(200);
    expect(ownerApprove.json().flag.status).toBe('owner_approved');
    expect(ownerApprove.json().flag.approved_by).toBe(owner.userId);

    const resolve = await app.inject({
      method: 'POST', url: `/api/events/${eventId}/financial-legal/go-no-go-flags/${flagId}/resolve`,
      payload: {},
      headers: mgrAuth,
    });
    expect(resolve.statusCode).toBe(200);
    expect(resolve.json().flag.status).toBe('resolved');

    expect(auditActions(owner.orgId, 'financial_legal.go_no_go.approve')).toBe(1);
    expect(sseRows(owner.orgId, 'financial_legal.updated')).toBe(2);
  });
});

describe('FI-04/05 — obligation extracts', () => {
  it('GET financial-legal is pure; explicit extraction + decisions work', async () => {
    const owner = await registerOwner();
    const eventId = await createEvent(owner);
    const auth = { authorization: `Bearer ${owner.token}`, 'content-type': 'application/json' };

    // A contract inserted directly (as if created before obligation extraction
    // existed) — the OLD code's GET would have upserted extracts as a side
    // effect; the fixed GET must leave them untouched.
    db.prepare(`INSERT INTO contracts (id, organization_id, event_id, title, recipient_name, content, created_by)
                VALUES ('legacy-contract-1', ?, ?, 'Legacy Agreement', 'Old Couple', 'Load-in and insurance/COI plus cleanup terms.', ?)`)
      .run(owner.orgId, eventId, owner.userId);
    const get1 = await app.inject({ method: 'GET', url: `/api/events/${eventId}/financial-legal`, headers: auth });
    expect(get1.statusCode).toBe(200);
    const legacyExtracts = get1.json().financialLegal.obligationExtracts as Array<{ contract_id: string }>;
    expect(legacyExtracts.filter((e) => e.contract_id === 'legacy-contract-1')).toHaveLength(0);

    const contractId = await createContract(owner, eventId);
    const extracted = await app.inject({
      method: 'POST', url: `/api/contracts/${contractId}/extract-obligations`,
      payload: {},
      headers: auth,
    });
    expect(extracted.statusCode).toBe(201);
    const keys = (extracted.json().extracts as Array<{ obligation_key: string }>).map((e) => e.obligation_key);
    expect(keys).toContain('insurance');
    expect(keys).toContain('cleanup');
    const obligationId = extracted.json().extracts.find((e: any) => e.obligation_key === 'insurance').id;

    const decided = await app.inject({
      method: 'POST', url: `/api/contracts/${contractId}/obligations/${obligationId}`,
      payload: { status: 'approved' },
      headers: auth,
    });
    expect(decided.statusCode).toBe(200);
    expect(decided.json().obligation.status).toBe('approved');
    expect(decided.json().obligation.approved_by).toBe(owner.userId);
    expect(auditActions(owner.orgId, 'financial_legal.obligation.decide')).toBe(1);
  });
});

describe('FI-06/07 — audits + SSE on finance mutations', () => {
  it('budget update/delete, contract update/delete, payment create/status are audited + broadcast', async () => {
    const owner = await registerOwner();
    const eventId = await createEvent(owner);
    const auth = { authorization: `Bearer ${owner.token}`, 'content-type': 'application/json' };

    const budget = await app.inject({
      method: 'POST', url: `/api/events/${eventId}/budget`,
      payload: { category: 'Floral', title: 'Centerpieces', plannedCents: 30000 },
      headers: auth,
    });
    const budgetId = budget.json().item.id;
    await app.inject({ method: 'PATCH', url: `/api/budget/${budgetId}`, payload: { plannedCents: 35000 }, headers: auth });
    expect(auditActions(owner.orgId, 'budget.update')).toBe(1);

    const contractId = await createContract(owner, eventId);
    await app.inject({ method: 'PATCH', url: `/api/contracts/${contractId}`, payload: { title: 'Renamed' }, headers: auth });
    expect(auditActions(owner.orgId, 'contract.update')).toBe(1);
    expect(sseRows(owner.orgId, 'contract.updated')).toBe(1);

    const payment = await app.inject({
      method: 'POST', url: `/api/events/${eventId}/payments`,
      payload: { provider: 'manual', amountCents: 100000 },
      headers: auth,
    });
    expect(sseRows(owner.orgId, 'payment.created')).toBe(1);
    await app.inject({
      method: 'PATCH', url: `/api/payments/${payment.json().payment.id}/status`,
      payload: { status: 'completed' },
      headers: auth,
    });
    expect(auditActions(owner.orgId, 'payment.status_update')).toBe(1);
    expect(sseRows(owner.orgId, 'payment.updated')).toBe(1);

    await app.inject({ method: 'DELETE', url: `/api/contracts/${contractId}`, headers: { authorization: `Bearer ${owner.token}` } });
    expect(auditActions(owner.orgId, 'contract.delete')).toBe(1);
    expect(sseRows(owner.orgId, 'contract.deleted')).toBe(1);

    await app.inject({ method: 'DELETE', url: `/api/budget/${budgetId}`, headers: { authorization: `Bearer ${owner.token}` } });
    expect(auditActions(owner.orgId, 'budget.delete')).toBe(1);
  });
});

describe('FI-08/15 — validation', () => {
  it('rejects cross-org budget vendor and foreign contract payment links; paypal rejected', async () => {
    const owner = await registerOwner();
    const eventId = await createEvent(owner);
    const otherOrg = await registerOwner();
    const otherEvent = await createEvent(otherOrg, 'Other Wedding');
    const otherContract = await createContract(otherOrg, otherEvent);
    const auth = { authorization: `Bearer ${owner.token}`, 'content-type': 'application/json' };

    const foreignVendor = await app.inject({
      method: 'POST', url: `/api/events/${eventId}/budget`,
      payload: { category: 'X', title: 'Cross-org', plannedCents: 100, vendorId: 'vendor-from-elsewhere' },
      headers: auth,
    });
    expect(foreignVendor.statusCode).toBe(400);
    expect(foreignVendor.json().error).toBe('vendor-not-in-org');

    const foreignContractPayment = await app.inject({
      method: 'POST', url: `/api/events/${eventId}/payments`,
      payload: { provider: 'manual', amountCents: 5000, contractId: otherContract },
      headers: auth,
    });
    expect(foreignContractPayment.statusCode).toBe(400);
    expect(foreignContractPayment.json().error).toBe('contract-not-in-event');

    const paypal = await app.inject({
      method: 'POST', url: `/api/events/${eventId}/payments`,
      payload: { provider: 'paypal', amountCents: 5000 },
      headers: auth,
    });
    expect(paypal.statusCode).toBe(400);
  });
});

describe('FI-10 — webhook rate limit', () => {
  it('rate-limits public payment webhooks', async () => {
    const owner = await registerOwner();
    integrationsRepo.upsert({
      organizationId: owner.orgId, provider: 'stripe', displayName: 'Stripe', status: 'connected',
      config: {}, secretPayload: sealSecret({ webhookSigningSecret: 'whsec_test' }),
    });
    const integrationId = (db.prepare(`SELECT id FROM integrations WHERE organization_id = ? AND provider = 'stripe'`).get(owner.orgId) as { id: string }).id;
    // The global plugin allow-lists localhost in test mode, so simulate a
    // real provider endpoint (non-allowlisted IP) to exercise the limit.
    let last = 0;
    for (let i = 0; i < 61; i++) {
      const res = await app.inject({
        method: 'POST', url: `/api/payments/webhooks/stripe/${integrationId}`,
        payload: { type: 'checkout.session.completed', data: { object: { id: `cs_${i}` } } },
        headers: { 'content-type': 'application/json' },
        remoteAddress: '203.0.113.10',
      });
      last = res.statusCode;
    }
    expect(last).toBe(429);
  });
});

describe('FI-11 — escalation permission tightening', () => {
  it('couple and staff (budget.view) cannot escalate; manager can', async () => {
    const owner = await registerOwner();
    const eventId = await createEvent(owner);
    const couple = await createUser(`esc-couple-${Math.random().toString(36).slice(2)}@x.com`);
    eventsRepo.addMember({ eventId, userId: couple.id, roleId: SYSTEM_ROLE_IDS.couple });
    const staff = await createUser(`esc-staff-${Math.random().toString(36).slice(2)}@x.com`);
    orgsRepo.addMember({ orgId: owner.orgId, userId: staff.id, roleId: SYSTEM_ROLE_IDS.staff });
    const manager = await createUser(`esc-mgr-${Math.random().toString(36).slice(2)}@x.com`);
    orgsRepo.addMember({ orgId: owner.orgId, userId: manager.id, roleId: SYSTEM_ROLE_IDS.manager });

    for (const u of [couple, staff]) {
      const res = await app.inject({
        method: 'POST', url: `/api/events/${eventId}/financial-legal/escalations`,
        payload: { label: 'Payment risk', createGoNoGoFlag: true },
        headers: { authorization: `Bearer ${u.token}`, 'content-type': 'application/json' },
      });
      expect(res.statusCode).toBe(403);
    }

    const mgrEscalation = await app.inject({
      method: 'POST', url: `/api/events/${eventId}/financial-legal/escalations`,
      payload: { label: 'Payment balance risk', createGoNoGoFlag: true },
      headers: { authorization: `Bearer ${manager.token}`, 'content-type': 'application/json' },
    });
    expect(mgrEscalation.statusCode).toBe(201);
    expect(auditActions(owner.orgId, 'financial_legal.escalation.create')).toBe(1);
  });
});

describe('FI-12 — contract send email delivery', () => {
  it('enqueues an email.send job when SMTP is connected and recipient set', async () => {
    const owner = await registerOwner();
    const eventId = await createEvent(owner);
    integrationsRepo.upsert({
      organizationId: owner.orgId, provider: 'email_smtp', displayName: 'Test SMTP', status: 'connected',
      config: { host: 'smtp.example.com', port: 587, secure: false, fromAddress: 'venue@example.com' },
      secretPayload: sealSecret({ username: 'u', password: 'p' }),
    });
    const contractId = await createContract(owner, eventId);
    const send = await app.inject({
      method: 'POST', url: `/api/contracts/${contractId}/send`,
      payload: {},
      headers: { authorization: `Bearer ${owner.token}`, 'content-type': 'application/json' },
    });
    expect(send.statusCode).toBe(200);
    expect(send.json().emailed).toBe(true);
    const job = db.prepare(`SELECT payload FROM job_queue WHERE kind = 'email.send' AND organization_id = ? ORDER BY created_at DESC LIMIT 1`).get(owner.orgId) as { payload: string } | undefined;
    expect(job).toBeTruthy();
    expect(JSON.parse(job!.payload).to).toBe('couple@example.com');
  });

  it('send without SMTP still flips status (best-effort email)', async () => {
    const owner = await registerOwner();
    const eventId = await createEvent(owner);
    const contractId = await createContract(owner, eventId);
    const send = await app.inject({
      method: 'POST', url: `/api/contracts/${contractId}/send`,
      payload: {},
      headers: { authorization: `Bearer ${owner.token}`, 'content-type': 'application/json' },
    });
    expect(send.statusCode).toBe(200);
    expect(send.json().emailed).toBe(false);
    expect(send.json().contract.status).toBe('sent');
  });
});
