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
    'contract_obligation_extracts','event_go_no_go_flags','event_financial_legal_escalations',
    'payment_links','contracts','budget_items','layout_versions','layouts','timeline_events','vendors','guests',
    'event_memberships','events','organization_memberships','organizations','users','audit_logs',
  ]) { try { db.prepare(`DELETE FROM ${t}`).run(); } catch {} }
  try { db.prepare(`DELETE FROM role_permissions WHERE role_id IN (SELECT id FROM roles WHERE is_system = 0)`).run(); db.prepare(`DELETE FROM roles WHERE is_system = 0`).run(); } catch {}
  rolesRepo.ensureSystemRoles();
});

async function setup() {
  const r = await app.inject({ method: 'POST', url: '/api/auth/register',
    payload: { email: `finlegal-${Math.random().toString(36).slice(2)}@x.com`, password: 'testpass123', fullName: 'Owner', orgName: 'Venue' },
    headers: { 'content-type': 'application/json' } });
  const token = r.json().token as string;
  const orgId = r.json().organizationId as string;
  const e = await app.inject({ method: 'POST', url: '/api/events',
    payload: { organizationId: orgId, title: 'Financial Legal Wedding', startDate: '2026-09-12' },
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' } });
  return { token, orgId, eventId: e.json().event.id as string };
}

const req = (token: string, method: 'GET'|'POST', url: string, payload?: unknown) => app.inject({
  method, url,
  headers: payload !== undefined ? { authorization: `Bearer ${token}`, 'content-type': 'application/json' } : { authorization: `Bearer ${token}` },
  payload: payload as never,
});

describe('financial/legal operations', () => {
  it('normalizes escalations, go/no-go flags, contract obligations, and payment due-date risk', async () => {
    const s = await setup();
    const contract = await req(s.token, 'POST', `/api/events/${s.eventId}/contracts`, {
      title: 'Venue Agreement',
      recipientName: 'Couple',
      amountCents: 1000000,
      content: 'Vendor load-in begins at 10am. COI insurance required. Noise curfew and overtime fees apply.',
    });
    expect(contract.statusCode).toBe(201);
    const contractId = contract.json().contract.id;

    const payment = await req(s.token, 'POST', `/api/events/${s.eventId}/payments`, {
      provider: 'manual', amountCents: 250000, metadata: { dueDate: '2020-01-01', milestone: 'Deposit' },
    });
    expect(payment.statusCode).toBe(201);

    const escalation = await req(s.token, 'POST', `/api/events/${s.eventId}/financial-legal/escalations`, {
      sourceType: 'contract', sourceId: contractId, severity: 'blocked', label: 'Unsigned operational contract blocks event', createGoNoGoFlag: true,
    });
    expect(escalation.statusCode).toBe(201);
    expect(escalation.json().flag.label).toContain('Unsigned operational contract');

    const extract = await req(s.token, 'POST', `/api/contracts/${contractId}/extract-obligations`, {});
    expect(extract.statusCode).toBe(201);
    expect(extract.json().extracts.map((e: any) => e.obligation_key)).toEqual(expect.arrayContaining(['load_in', 'insurance', 'noise', 'overtime']));

    const list = await req(s.token, 'GET', `/api/events/${s.eventId}/financial-legal`);
    expect(list.statusCode).toBe(200);
    expect(list.json().financialLegal.escalations).toHaveLength(1);
    expect(list.json().financialLegal.goNoGoFlags).toHaveLength(1);
    expect(list.json().financialLegal.obligationExtracts.length).toBeGreaterThanOrEqual(4);
    expect(list.json().financialLegal.paymentDueRisk.overdue).toBe(1);
    expect(list.json().financialLegal.paymentDueRisk.pendingCents).toBe(250000);
  });
});
