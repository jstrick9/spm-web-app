import { db } from '../database.js';
import { uuid } from '../../lib/crypto.js';
import { jobsRepo } from './jobs.js';

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

  /** Find a recent send for an event and trigger type within a cooldown window. */
  findRecentSend(
    eventId: string,
    triggerType: string,
    cooldownMinutes: number,
  ): ScheduledEmailRow | undefined {
    return db.prepare(
      `SELECT * FROM scheduled_emails
       WHERE event_id = ? AND trigger_type = ?
         AND created_at > datetime('now', '-' || ? || ' minutes')
       ORDER BY created_at DESC LIMIT 1`,
    ).get(eventId, triggerType, cooldownMinutes) as ScheduledEmailRow | undefined;
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

  /** Find a scheduled email by its unique idempotency key segments. */
  findByIdempotencyKey(
    eventId: string,
    guestId: string | null,
    triggerType: string,
    dateString: string,
  ): ScheduledEmailRow | undefined {
    return db.prepare(
      `SELECT * FROM scheduled_emails
       WHERE event_id = ?
         AND ((guest_id IS NULL AND ? IS NULL) OR guest_id = ?)
         AND trigger_type = ?
         AND strftime('%Y-%m-%d', created_at) = ?
       LIMIT 1`,
    ).get(eventId, guestId, guestId, triggerType, dateString) as ScheduledEmailRow | undefined;
  },

  /** Enqueue a scheduled email row and a corresponding sending job. */
  enqueue(input: {
    eventId: string;
    guestId: string | null;
    templateId: string | null;
    triggerType: string;
    toEmail: string;
    toName: string;
    subject: string;
    bodyHtml?: string;
    bodyText?: string;
    idempotencyKey?: string;
    scheduledFor?: string;
  }): ScheduledEmailRow {
    const id = uuid();
    // 1. Get organization_id of the event
    const eventRow = db.prepare(`SELECT organization_id FROM events WHERE id = ?`).get(input.eventId) as { organization_id: string } | undefined;
    const organizationId = eventRow?.organization_id ?? '';

    // 2. Get active SMTP integration
    const smtpRow = db.prepare(
      `SELECT id FROM integrations
       WHERE organization_id = ? AND provider = 'email_smtp' AND status = 'connected'
       LIMIT 1`
    ).get(organizationId) as { id: string } | undefined;
    const smtpIntegrationId = smtpRow?.id ?? '';

    // 3. Enqueue the email send job in job_queue
    const job = jobsRepo.enqueue({
      kind: 'email.send',
      organizationId,
      payload: {
        integrationId: smtpIntegrationId,
        to: input.toEmail,
        subject: input.subject,
        html: input.bodyHtml,
        text: input.bodyText,
      },
    });

    // 4. Create the scheduled_emails send-log row with status 'sent' and job_id
    db.prepare(
      `INSERT INTO scheduled_emails
        (id, organization_id, event_id, guest_id, template_id, trigger_type, recipient_email, subject, status, job_id, sent_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'sent', ?, datetime('now'))`
    ).run(
      id,
      organizationId,
      input.eventId,
      input.guestId,
      input.templateId,
      input.triggerType,
      input.toEmail,
      input.subject,
      job.id,
    );

    return db.prepare(`SELECT * FROM scheduled_emails WHERE id = ?`).get(id) as ScheduledEmailRow;
  },
};
