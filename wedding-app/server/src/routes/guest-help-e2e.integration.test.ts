/**
 * Guest-help SLA + reply E2E leg — MODULE-07 CP-06 full loop.
 *
 *   1. guest submits help request through the public portal (SLA set)
 *   2. venue lists requests, assigns, updates status
 *   3. venue replies (in_app) → reply row + last_reply_* persisted, guest
 *      sees the reply in the portal messages feed
 *   4. SLA breach scan flags the overdue request: audit row (deduped),
 *      SSE event, push attempted
 *   5. resolving closes the request; the scan no longer re-flags it
 */
import '../test/setup.js';
import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../index.js';
import { db } from '../db/database.js';
import { guestsRepo } from '../db/repos/index.js';
import { scanGuestHelpSlaBreaches } from '../jobs/guestHelpSla.js';

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

describe('Guest-help SLA + reply E2E leg', () => {
  it('guest help request → assign → reply → SLA breach → resolve (no re-flag)', async () => {
    // ═══ 1. Register owner + event + guest with token ══════════════════
    const reg = await app.inject({
      method: 'POST', url: '/api/auth/register',
      payload: { email: `gh-${Math.random().toString(36).slice(2)}@x.com`, password: 'testpass123', fullName: 'Owner', orgName: 'GH Venue' },
      headers: { 'content-type': 'application/json' },
    });
    const token = reg.json().token as string;
    const orgId = reg.json().organizationId as string;

    const evt = await req(token, 'POST', '/api/events', { organizationId: orgId, title: 'GH Wedding' });
    const eventId = evt.json().event.id as string;

    const guest = guestsRepo.create(orgId, eventId, {
      fullName: 'Guest G', email: 'guestg@example.com', allowPortalAccess: true,
    } as never);
    const guestToken = guestsRepo.rotatePortalToken(guest.id);

    // ═══ 2. Guest submits a help request via the public portal ═════════
    // Guest question endpoint carries a 2-day SLA (date-only from addDaysIso).
    const help = await app.inject({
      method: 'POST', url: `/api/portal/${eventId}/question`,
      payload: { guestId: guest.id, token: guestToken, category: 'Invitation', language: 'en', question: 'My link does not work.' },
      headers: { 'content-type': 'application/json' },
    });
    expect(help.statusCode).toBe(201);
    const requestId = help.json().requestId as string;
    const reqRow = db.prepare(`SELECT * FROM guest_help_requests WHERE id = ?`).get(requestId) as any;
    expect(reqRow.sla_due_at).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(reqRow.status).toBe('open');

    // ═══ 3. Venue lists, assigns, updates ══════════════════════════════
    const list = await req(token, 'GET', `/api/events/${eventId}/guest-help-requests`);
    expect(list.statusCode).toBe(200);
    expect(list.json().requests.some((r: any) => r.id === requestId)).toBe(true);

    const assign = await req(token, 'PATCH', `/api/events/${eventId}/guest-help-requests/${requestId}`, { status: 'in_review', assignedTo: 'coordinator@venue.test', slaDueAt: new Date(Date.now() - 3600_000).toISOString() });
    expect(assign.statusCode).toBe(200);

    // ═══ 4. Venue replies (in_app) ═════════════════════════════════════
    const reply = await req(token, 'POST', `/api/events/${eventId}/guest-help-requests/${requestId}/reply`, { channel: 'in_app', message: 'Thanks for flagging — your secure link is on its way.' });
    expect(reply.statusCode).toBe(201);
    expect(reply.json().dispatchStatus).toBe('in_app_recorded');
    expect(reply.json().reply.sentByLabel).toBe(reg.json().user.email);
    const replyRow = db.prepare(`SELECT * FROM guest_help_request_replies WHERE id = ?`).get(reply.json().reply.id) as any;
    expect(replyRow.body).toContain('secure link is on its way');
    expect(replyRow.sent_by_label).toBe(reg.json().user.email);

    // ═══ 5. Guest sees the venue reply in the portal messages feed ═════
    const feed = await app.inject({
      method: 'GET', url: `/api/portal/${eventId}/messages?guest=${guest.id}&token=${encodeURIComponent(guestToken)}`,
    });
    expect(feed.statusCode).toBe(200);
    expect(feed.json().replies.some((r: any) => r.id === reply.json().reply.id)).toBe(true);
    expect(feed.json().replies[0].body).toContain('secure link is on its way');

    // ═══ 6. SLA breach scan (request is now overdue) ═══════════════════
    const scan1 = scanGuestHelpSlaBreaches();
    expect(scan1.flagged).toBe(1);
    const audit1 = db.prepare(`SELECT COUNT(*) AS n FROM audit_logs WHERE action = 'guest_help.sla_breach' AND target_id = ?`).get(requestId) as { n: number };
    expect(audit1.n).toBe(1);
    const sse1 = db.prepare(`SELECT COUNT(*) AS n FROM sse_events WHERE organization_id = ? AND event_type = 'guest_help.sla_breach'`).get(orgId) as { n: number };
    expect(sse1.n).toBe(1);

    // Second scan: deduped — no re-flag, no duplicate audit row.
    const scan2 = scanGuestHelpSlaBreaches();
    expect(scan2.flagged).toBe(0);
    const audit2 = db.prepare(`SELECT COUNT(*) AS n FROM audit_logs WHERE action = 'guest_help.sla_breach' AND target_id = ?`).get(requestId) as { n: number };
    expect(audit2.n).toBe(1);

    // ═══ 7. Resolve closes the request; scan ignores it ════════════════
    const resolve = await req(token, 'PATCH', `/api/events/${eventId}/guest-help-requests/${requestId}`, { status: 'resolved', resolutionNote: 'New link sent.' });
    expect(resolve.statusCode).toBe(200);
    const scan3 = scanGuestHelpSlaBreaches();
    expect(scan3.flagged).toBe(0);

    // ═══ 8. Cross-org isolation: another org's owner cannot see it ═════
    const other = await app.inject({
      method: 'POST', url: '/api/auth/register',
      payload: { email: `gho-${Math.random().toString(36).slice(2)}@x.com`, password: 'testpass123', fullName: 'Other', orgName: 'Other Venue' },
      headers: { 'content-type': 'application/json' },
    });
    const otherToken = other.json().token as string;
    const otherList = await req(otherToken, 'GET', `/api/events/${eventId}/guest-help-requests`);
    expect(otherList.statusCode).toBe(403);
    const otherReply = await req(otherToken, 'POST', `/api/events/${eventId}/guest-help-requests/${requestId}/reply`, { channel: 'in_app', message: 'sneaky' });
    expect(otherReply.statusCode).toBe(403);

  });
});
