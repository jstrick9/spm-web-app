/**
 * Guest help-request SLA breach scan — MODULE-07 CP-06.
 *
 * Guest portal help requests carry `sla_due_at` (link issues 3 days,
 * accessibility 1 day, day-of help same-day) but nothing ever surfaced an
 * overdue request. This hourly scan flags overdue open/in_review requests:
 *   - one audit row `guest_help.sla_breach` per request (deduped — the audit
 *     row doubles as the marker, so repeated scans don't re-flag),
 *   - one SSE broadcast `guest_help.sla_breach` so the venue's open panels
 *     can highlight the request in real time.
 * The request itself stays open — the venue resolves it via the normal flow.
 */
import { db } from '../db/database.js';
import { uuid } from '../lib/crypto.js';
import { broadcastSSE } from '../routes/sse.js';
import { sendPushToOrg } from '../push/service.js';

export function scanGuestHelpSlaBreaches(): { flagged: number } {
  const now = new Date().toISOString();
  const overdue = db.prepare(
    `SELECT id, organization_id, event_id, kind, assigned_to, sla_due_at
     FROM guest_help_requests
     WHERE status IN ('open', 'in_review') AND sla_due_at IS NOT NULL AND sla_due_at < ?
     ORDER BY sla_due_at ASC LIMIT 100`,
  ).all(now) as Array<{
    id: string; organization_id: string; event_id: string;
    kind: string; assigned_to: string | null; sla_due_at: string;
  }>;

  let flagged = 0;
  for (const row of overdue) {
    const already = db.prepare(`SELECT 1 FROM audit_logs WHERE action = 'guest_help.sla_breach' AND target_id = ?`).get(row.id);
    if (already) continue;
    db.prepare(
      `INSERT INTO audit_logs (id, organization_id, actor_user_id, actor_label, action, target_type, target_id, details, created_at)
       VALUES (?, ?, NULL, 'system', 'guest_help.sla_breach', 'guest_help_request', ?, ?, datetime('now'))`,
    ).run(uuid(), row.organization_id, row.id, JSON.stringify({ eventId: row.event_id, kind: row.kind, assignedTo: row.assigned_to, slaDueAt: row.sla_due_at }));
    broadcastSSE(row.organization_id, 'guest_help.sla_breach', {
      eventId: row.event_id, requestId: row.id, kind: row.kind, slaDueAt: row.sla_due_at,
    });
    void sendPushToOrg(row.organization_id, {
      title: '⚠ Guest help request past SLA',
      body: `A ${row.kind} help request is overdue (${row.sla_due_at}).`,
      url: `/events/${row.event_id}?tab=guest-help`,
      tag: `guest-help-sla-${row.id}`,
    }).catch((err) => console.error('[guest-help-sla] push dispatch failed:', err));
    flagged += 1;
  }
  return { flagged };
}
