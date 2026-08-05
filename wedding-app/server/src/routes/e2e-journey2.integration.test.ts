/**
 * E2E journey #2 — day-of operations + vendor portal + stage lifecycle.
 *
 * Complements e2e-journey.integration.test.ts (CRM core path) with the
 * operational half of the product:
 *   1. register owner → event (lead)
 *   2. stage: lead → booked → planning
 *   3. staff member invited + shift scheduled (conflict guard checked)
 *   4. layout created → save → review-request → queue-decision (approved)
 *   5. vendor portal token issued → info → questionnaire → COI upload →
 *      message send (token-gated)
 *   6. staff shift clock-in → clock-out
 *   7. stage: planning → final_review (readiness gate) → completed
 *   8. final consistency asserts (audit rows, portal token last_used)
 */
import '../test/setup.js';
import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../index.js';
import { db } from '../db/database.js';
import { SYSTEM_ROLE_IDS } from '../lib/permissions.js';

let app: FastifyInstance;
beforeAll(async () => { app = await buildApp(); await app.ready(); });
beforeEach(() => { db.exec('BEGIN'); });
afterEach(async () => { db.exec('ROLLBACK'); });

const req = (token: string, method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE', url: string, payload?: unknown) =>
  app.inject({
    method, url,
    headers: payload !== undefined
      ? { authorization: `Bearer ${token}`, 'content-type': 'application/json' }
      : { authorization: `Bearer ${token}` },
    payload: payload as never,
  });

describe('E2E journey #2 — operations half', () => {
  it('staff shift + clock, layout approval, vendor portal, stage lifecycle', async () => {
    // ═══ 1. Register owner + event (lead) ══════════════════════════════
    const reg = await app.inject({
      method: 'POST', url: '/api/auth/register',
      payload: { email: `e2e2-${Math.random().toString(36).slice(2)}@x.com`, password: 'testpass123', fullName: 'Owner', orgName: 'Ops Venue' },
      headers: { 'content-type': 'application/json' },
    });
    expect(reg.statusCode).toBe(201);
    const token = reg.json().token as string;
    const orgId = reg.json().organizationId as string;
    const ownerUserId = reg.json().user.id as string;

    const evt = await req(token, 'POST', '/api/events', { organizationId: orgId, title: 'Ops Wedding', startDate: '2026-10-03', status: 'lead' });
    expect(evt.statusCode).toBe(201);
    const eventId = evt.json().event.id as string;
    expect(evt.json().event.status).toBe('lead');

    // ═══ 2. Stage lifecycle ════════════════════════════════════════════
    for (const status of ['booked', 'planning']) {
      const st = await req(token, 'POST', `/api/events/${eventId}/stage`, { status });
      expect(st.statusCode, status).toBe(200);
    }
    const evtAfter = await req(token, 'GET', `/api/events/${eventId}`);
    expect(evtAfter.json().event.status).toBe('planning');

    // ═══ 3. Staff member + shift (conflict guard) ══════════════════════
    const staffReg = await app.inject({
      method: 'POST', url: '/api/auth/register',
      payload: { email: `e2e2s-${Math.random().toString(36).slice(2)}@x.com`, password: 'testpass123', fullName: 'Staff Sam', orgName: 'Tmp' },
      headers: { 'content-type': 'application/json' },
    });
    const staffUserId = staffReg.json().user.id as string;
    const staffRoleId = db.prepare(`SELECT id FROM roles WHERE key = 'staff' AND is_system = 1`).get() as { id: string } | undefined;
    const addMember = await req(token, 'POST', `/api/orgs/${orgId}/members`, { userEmail: staffReg.json().user.email, roleId: staffRoleId?.id ?? SYSTEM_ROLE_IDS.staff });
    expect(addMember.statusCode).toBe(201);

    const shift1 = await req(token, 'POST', `/api/orgs/${orgId}/staff/shifts`, {
      staffId: staffUserId, role: 'setup', eventId,
      startsAt: '2026-10-03T08:00:00Z', endsAt: '2026-10-03T12:00:00Z',
    });
    expect(shift1.statusCode).toBe(201);
    const shiftId = shift1.json().shift.id as string;

    // Overlapping shift for the same staff member is rejected.
    const conflict = await req(token, 'POST', `/api/orgs/${orgId}/staff/shifts`, {
      staffId: staffUserId, role: 'setup', eventId,
      startsAt: '2026-10-03T09:00:00Z', endsAt: '2026-10-03T13:00:00Z',
    });
    expect(conflict.statusCode).toBe(400);
    expect(conflict.json().error).toBe('staff-shift-conflict');

    // ═══ 4. Layout create → save → review → approve ════════════════════
    const layout = await req(token, 'POST', '/api/layouts', {
      organizationId: orgId, eventId, name: 'Reception', payload: { zones: [{ type: 'dance_floor' }], tables: [] },
    });
    expect(layout.statusCode).toBe(201);
    const layoutId = layout.json().layout.id as string;

    const save = await req(token, 'POST', `/api/layouts/${layoutId}/save`, { payload: { zones: [{ type: 'dance_floor' }], tables: [{ id: 't1', seats: 8 }] } });
    expect(save.statusCode).toBe(200);

    const reviewReq = await req(token, 'POST', `/api/layouts/${layoutId}/review-request`);
    expect(reviewReq.statusCode).toBe(201);

    const decision = await req(token, 'POST', `/api/layouts/${layoutId}/queue-decision`, { decision: 'approved', note: 'Ops review OK' });
    expect(decision.statusCode).toBe(200);
    expect(decision.json().layout.approval_status).toBe('approved');

    // ═══ 5. Vendor portal: token → info → questionnaire → COI → message ══
    const vendor = await req(token, 'POST', `/api/orgs/${orgId}/vendors`, {
      name: 'Floral Co', category: 'Floral', eventId, email: 'floral@vendor.test', contactPreference: 'email',
    });
    expect(vendor.statusCode).toBe(201);
    const vendorId = vendor.json().vendor.id as string;

    const tokRes = await req(token, 'POST', `/api/vendors/${vendorId}/portal-token`, { expiresInDays: 30 });
    expect(tokRes.statusCode).toBe(201);
    const vToken = tokRes.json().token as string;

    const info = await app.inject({ method: 'GET', url: `/api/portal/vendors/${vendorId}/info?token=${encodeURIComponent(vToken)}` });
    expect(info.statusCode).toBe(200);
    expect(info.json().vendor.id).toBe(vendorId);

    const q = await app.inject({
      method: 'POST', url: `/api/portal/vendors/${vendorId}/questionnaire`,
      payload: { token: vToken, teamSize: '4', loadIn: '10:00', vehicle: 'van' },
      headers: { 'content-type': 'application/json' },
    });
    expect(q.statusCode).toBe(200);
    expect(q.json().ok).toBe(true);

    const pdf = Buffer.from('%PDF-1.4\n1 0 obj\n%%EOF').toString('base64');
    const coi = await app.inject({
      method: 'POST', url: `/api/portal/vendors/${vendorId}/coi-upload`,
      payload: { token: vToken, fileName: 'coi.pdf', mimeType: 'application/pdf', dataUri: `data:application/pdf;base64,${pdf}` },
      headers: { 'content-type': 'application/json' },
    });
    expect(coi.statusCode).toBe(201);

    const msg = await app.inject({
      method: 'POST', url: `/api/portal/vendors/${vendorId}/messages`,
      payload: { token: vToken, body: 'Load-in confirmed for 10:00.' },
      headers: { 'content-type': 'application/json' },
    });
    expect(msg.statusCode).toBe(201);

    // Token lifecycle: rotation revokes the old token.
    const rotate = await req(token, 'POST', `/api/vendors/${vendorId}/portal-token`, { expiresInDays: 14 });
    expect(rotate.statusCode).toBe(201);
    const oldTokenDead = await app.inject({ method: 'GET', url: `/api/portal/vendors/${vendorId}/info?token=${encodeURIComponent(vToken)}` });
    expect(oldTokenDead.statusCode).toBe(401);

    // ═══ 6. Staff clock in/out on the shift ═════════════════════════════
    const clockIn = await req(token, 'POST', `/api/staff/shifts/${shiftId}/clock-in`);
    expect(clockIn.statusCode).toBe(200);
    const clockOut = await req(token, 'POST', `/api/staff/shifts/${shiftId}/clock-out`);
    expect(clockOut.statusCode).toBe(200);
    const shiftRow = db.prepare(`SELECT clocked_in_at, clocked_out_at FROM staff_shifts WHERE id = ?`).get(shiftId) as { clocked_in_at: string | null; clocked_out_at: string | null };
    expect(shiftRow.clocked_in_at).toBeTruthy();
    expect(shiftRow.clocked_out_at).toBeTruthy();

    // ═══ 7. Final review readiness gate → completed ═════════════════════
    // Readiness requires more than we seeded — the gate must reject.
    const toFinalReview = await req(token, 'POST', `/api/events/${eventId}/stage`, { status: 'final_review' });
    expect(toFinalReview.statusCode).toBe(400);
    expect(toFinalReview.json().error).toBe('final-review-not-ready');

    // Complete the readiness prerequisites (venue manager's job), then retry.
    // The approved layout payload gains an accessible route zone (direct DB
    // update — the save endpoint locks approved layouts by design).
    db.prepare(`UPDATE layouts SET payload = ? WHERE id = ?`)
      .run(JSON.stringify({ zones: [{ type: 'dance_floor' }, { type: 'accessible_route' }], tables: [] }), layoutId);
    db.prepare(`UPDATE events SET metadata = ?, status = ?, guest_count = 100 WHERE id = ?`)
      .run(JSON.stringify({
        finalGuestCountConfirmed: true, staffingReady: true, inventoryReady: true,
        rainPlanReady: false, rainPlanChecked: true, accessibilityChecked: true,
      }), 'planning', eventId);
    await req(token, 'POST', `/api/events/${eventId}/timeline`, { title: 'Ceremony', category: 'ceremony', startsAt: '2026-10-03T16:00:00' });
    db.prepare(`INSERT INTO timeline_approvals (event_id, organization_id, role, status, approved_by) VALUES (?, ?, 'manager', 'approved', ?)`).run(eventId, orgId, ownerUserId);
    // Staff member must be an EVENT member (org membership alone doesn't count).
    db.prepare(`INSERT INTO event_memberships (event_id, user_id, role_id, status) VALUES (?, ?, ?, 'active')`)
      .run(eventId, staffUserId, staffRoleId?.id ?? SYSTEM_ROLE_IDS.staff);
    // Setup packet for the approved layout (token required).
    db.prepare(`INSERT INTO layout_setup_packets (layout_id, event_id, organization_id, token, created_by) VALUES (?, ?, ?, ?, ?)`)
      .run(layoutId, eventId, orgId, `pkt-${Math.random().toString(36).slice(2)}`, ownerUserId);

    const toFR = await req(token, 'POST', `/api/events/${eventId}/stage`, { status: 'final_review' });
    expect(toFR.statusCode, toFR.body).toBe(200);

    const complete = await req(token, 'POST', `/api/events/${eventId}/stage`, { status: 'completed' });
    expect(complete.statusCode).toBe(200);
    expect(complete.json().event.status).toBe('completed');

    // ═══ 8. Final consistency ═══════════════════════════════════════════
    // Stage transitions are audited.
    const audits = db.prepare(`SELECT COUNT(*) AS n FROM audit_logs WHERE action = 'event.stage.transition' AND target_id = ?`).get(eventId) as { n: number };
    expect(audits.n).toBeGreaterThanOrEqual(3);

    // Vendor metadata persisted questionnaire + portal activity.
    const vendorRow = db.prepare(`SELECT metadata FROM vendors WHERE id = ?`).get(vendorId) as { metadata: string };
    const vMeta = JSON.parse(vendorRow.metadata);
    expect(vMeta.questionnaire.teamSize).toBe('4');
    expect(vMeta.lastPortalActivityAt).toBeTruthy();
  });
});
