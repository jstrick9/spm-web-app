/**
 * Timeline reminder dispatch — MODULE-05 ST-06.
 *
 * `timeline-ops/reminder` rows are created with status 'queued'; this scan
 * (run every 60s by the worker) dispatches due reminders:
 *   - in_app → SSE broadcast `timeline.reminder` to the org's connected
 *     clients (NotificationCenter shows it), then status → 'sent'.
 *   - email   → enqueues an `email.send` job to the org's support email ONLY
 *     when the org has a connected email_smtp integration; otherwise the
 *     reminder stays queued and is retried on later scans (once SMTP is
 *     configured it will go out).
 *   - sms     → rejected at creation (no SMS gateway exists); any legacy
 *     queued sms rows are left untouched (harmless).
 */
import { db } from '../db/database.js';
import { broadcastSSE } from '../routes/sse.js';
import { integrationsRepo, jobsRepo, orgsRepo } from '../db/repos/index.js';

interface DueReminder {
  id: string;
  organization_id: string;
  event_id: string;
  timeline_item_id: string | null;
  remind_at: string;
  channel: string;
  audience: string;
  payload: string;
}

function parsePayload(raw: string): Record<string, unknown> {
  try { return JSON.parse(raw || '{}') as Record<string, unknown>; } catch { return {}; }
}

function markSent(id: string): void {
  db.prepare(`UPDATE timeline_reminders SET status = 'sent', updated_at = datetime('now') WHERE id = ?`).run(id);
}

export function scanDueTimelineReminders(): { dispatched: number } {
  const now = new Date().toISOString();
  const due = db.prepare(
    `SELECT id, organization_id, event_id, timeline_item_id, remind_at, channel, audience, payload
     FROM timeline_reminders
     WHERE status = 'queued' AND remind_at <= ?
     ORDER BY remind_at ASC LIMIT 100`,
  ).all(now) as DueReminder[];

  let dispatched = 0;
  for (const reminder of due) {
    try {
      const payload = parsePayload(reminder.payload);
      const item = reminder.timeline_item_id
        ? db.prepare(`SELECT title FROM timeline_events WHERE id = ?`).get(reminder.timeline_item_id) as { title: string } | undefined
        : undefined;
      const title = item?.title ?? (typeof payload.itemTitle === 'string' ? payload.itemTitle : 'Timeline reminder');

      if (reminder.channel === 'in_app') {
        broadcastSSE(reminder.organization_id, 'timeline.reminder', {
          reminderId: reminder.id,
          eventId: reminder.event_id,
          timelineItemId: reminder.timeline_item_id,
          title,
          remindAt: reminder.remind_at,
          audience: reminder.audience,
        });
        markSent(reminder.id);
        dispatched += 1;
      } else if (reminder.channel === 'email') {
        const smtp = integrationsRepo.findByOrgProvider(reminder.organization_id, 'email_smtp');
        const org = orgsRepo.findById(reminder.organization_id);
        if (smtp?.status === 'connected' && org?.support_email) {
          const lines = [
            `Timeline reminder: ${title}`,
            `Scheduled for: ${new Date(reminder.remind_at).toLocaleString()}`,
            `Event: ${reminder.event_id}`,
          ];
          jobsRepo.enqueue({
            kind: 'email.send',
            organizationId: reminder.organization_id,
            payload: {
              integrationId: smtp.id,
              to: org.support_email,
              subject: `Wedding timeline reminder: ${title}`,
              text: lines.join('\n'),
              html: `<p>${lines.map((l) => l.replace(/&/g, '&amp;').replace(/</g, '&lt;')).join('<br/>')}</p>`,
              headers: { 'X-WVI-Email-Type': 'timeline-reminder' },
            },
            maxAttempts: 3,
          });
          markSent(reminder.id);
          dispatched += 1;
        }
        // No connected SMTP (yet) → leave queued; a later scan will pick it up.
      }
    } catch (err) {
      console.error(`[reminders] dispatch failed for ${reminder.id}:`, err);
    }
  }
  return { dispatched };
}
