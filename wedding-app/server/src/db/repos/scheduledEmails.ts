import { db } from '../database.js';
import { uuid } from '../../lib/crypto.js';

export interface ScheduledEmailRow {
  id: string;
  organization_id: string;
  event_id: string;
  guest_id: string | null;
  automation_id: string | null;
  template_id: string | null;
  trigger_type: string;
  recipient_email: string;
  subject: string;
  status: 'pending' | 'sent' | 'failed' | 'skipped';
  job_id: string | null;
  error: string | null;
  created_at: string;
  sent_at: string | null;
}

export const scheduledEmailsRepo = {
  /**
   * Insert a send-log row. Returns the row, or `undefined` if a row already
   * exists for (event, guest, trigger) — the UNIQUE constraint is our
   * idempotency guard, so a duplicate insert is silently skipped.
   */
  create(input: {
    organizationId: string;
    eventId: string;
    guestId: string | null;
    automationId?: string | null;
    templateId?: string | null;
    triggerType: string;
    recipientEmail: string;
    subject: string;
  }): ScheduledEmailRow | undefined {
    const id = uuid();
    const res = db.prepare(
      `INSERT OR IGNORE INTO scheduled_emails
        (id, organization_id, event_id, guest_id, automation_id, template_id,
         trigger_type, recipient_email, subject)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id, input.organizationId, input.eventId, input.guestId,
      input.automationId ?? null, input.templateId ?? null,
      input.triggerType, input.recipientEmail, input.subject,
    );
    if (res.changes === 0) return undefined; // duplicate — already scheduled
    return db.prepare(`SELECT * FROM scheduled_emails WHERE id = ?`).get(id) as ScheduledEmailRow;
  },

  /** Has this (event, trigger) already been processed for this guest? */
  exists(eventId: string, guestId: string | null, trigger: string): boolean {
    const row = db.prepare(
      `SELECT 1 FROM scheduled_emails
       WHERE event_id = ? AND trigger_type = ?
         AND ((guest_id IS NULL AND ? IS NULL) OR guest_id = ?)`,
    ).get(eventId, trigger, guestId, guestId);
    return !!row;
  },

  markSent(id: string, jobId?: string): void {
    db.prepare(
      `UPDATE scheduled_emails
       SET status = 'sent', sent_at = datetime('now'), job_id = COALESCE(?, job_id), error = NULL
       WHERE id = ?`,
    ).run(jobId ?? null, id);
  },

  markFailed(id: string, error: string): void {
    db.prepare(
      `UPDATE scheduled_emails SET status = 'failed', error = ? WHERE id = ?`,
    ).run(error, id);
  },

  attachJob(id: string, jobId: string): void {
    db.prepare(`UPDATE scheduled_emails SET job_id = ? WHERE id = ?`).run(jobId, id);
  },

  listForEvent(eventId: string): ScheduledEmailRow[] {
    return db.prepare(
      `SELECT * FROM scheduled_emails WHERE event_id = ? ORDER BY created_at DESC`,
    ).all(eventId) as ScheduledEmailRow[];
  },

  /** Aggregate counts for an event (for the UI summary). */
  statsForEvent(eventId: string): Record<ScheduledEmailRow['status'], number> {
    const rows = db.prepare(
      `SELECT status, COUNT(*) AS n FROM scheduled_emails
       WHERE event_id = ? AND guest_id IS NOT NULL GROUP BY status`,
    ).all(eventId) as Array<{ status: ScheduledEmailRow['status']; n: number }>;
    const out = { pending: 0, sent: 0, failed: 0, skipped: 0 };
    for (const r of rows) out[r.status] = r.n;
    return out;
  },
};
