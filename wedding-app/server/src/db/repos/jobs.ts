/**
 * Job queue repository — single-table durable queue.
 *
 * Used for async work that integrations spawn:
 *   - 'email.send'           → send transactional email
 *   - 'integration.poll'     → run a provider's poll() (e.g. Calendly sync)
 *   - 'webhook.retry'        → retry a failed webhook handler
 *
 * Workers (src/jobs/worker.ts) call `claimNext()` to atomically pick the
 * next due job. The transaction guarantees no two workers pick the same
 * job (using UPDATE ... RETURNING via a transactional SELECT+UPDATE).
 */
import { db } from '../database.js';
import { uuid } from '../../lib/crypto.js';
import { parseJson, stringifyJson } from '../../lib/json.js';

export type JobStatus = 'pending' | 'running' | 'succeeded' | 'failed' | 'dead';

export interface JobRow {
  id: string;
  kind: string;
  organization_id: string | null;
  payload: string;
  status: JobStatus;
  attempts: number;
  max_attempts: number;
  run_at: string;
  last_error: string | null;
  result: string | null;
  locked_at: string | null;
  locked_by: string | null;
  finished_at: string | null;
  created_at: string;
}

export const jobsRepo = {
  enqueue(input: {
    kind: string;
    payload?: Record<string, unknown>;
    organizationId?: string | null;
    runAt?: string;
    maxAttempts?: number;
  }): JobRow {
    const id = uuid();
    db.prepare(
      `INSERT INTO job_queue (id, kind, organization_id, payload, run_at, max_attempts)
       VALUES (?, ?, ?, ?, COALESCE(?, datetime('now')), ?)`,
    ).run(
      id,
      input.kind,
      input.organizationId ?? null,
      stringifyJson(input.payload ?? {}),
      input.runAt ?? null,
      input.maxAttempts ?? 5,
    );
    return this.findById(id)!;
  },

  findById(id: string): JobRow | undefined {
    return db.prepare(`SELECT * FROM job_queue WHERE id = ?`).get(id) as JobRow | undefined;
  },

  /**
   * Atomically claim the next due pending job. Returns undefined if the
   * queue is empty (or nothing is due yet). The worker MUST eventually
   * call markSucceeded/markFailed for the returned job.
   *
   * The claim is done via a transaction: SELECT + UPDATE in one shot so
   * concurrent workers can't double-claim.
   */
  claimNext(workerId: string): JobRow | undefined {
    let claimed: JobRow | undefined;
    const tx = db.transaction(() => {
      const candidate = db.prepare(
        `SELECT * FROM job_queue
         WHERE status = 'pending' AND run_at <= datetime('now')
         ORDER BY run_at ASC LIMIT 1`,
      ).get() as JobRow | undefined;
      if (!candidate) return;
      const res = db.prepare(
        `UPDATE job_queue
         SET status = 'running', locked_at = datetime('now'), locked_by = ?,
             attempts = attempts + 1
         WHERE id = ? AND status = 'pending'`,
      ).run(workerId, candidate.id);
      if (res.changes === 1) {
        claimed = db.prepare(`SELECT * FROM job_queue WHERE id = ?`).get(candidate.id) as JobRow;
      }
    });
    tx();
    return claimed;
  },

  markSucceeded(id: string, result?: Record<string, unknown>): void {
    db.prepare(
      `UPDATE job_queue
       SET status = 'succeeded', finished_at = datetime('now'),
           locked_at = NULL, locked_by = NULL, result = ?, last_error = NULL
       WHERE id = ?`,
    ).run(stringifyJson(result ?? {}), id);
  },

  /**
   * Mark the job failed and decide whether to retry.
   *   - If attempts < max_attempts: requeue with exponential backoff
   *     (60s × 2^(attempts-1), capped at 1 hour)
   *   - Otherwise: mark dead
   */
  markFailed(id: string, errorMessage: string): void {
    const job = this.findById(id);
    if (!job) return;
    if (job.attempts >= job.max_attempts) {
      db.prepare(
        `UPDATE job_queue
         SET status = 'dead', finished_at = datetime('now'),
             locked_at = NULL, locked_by = NULL, last_error = ?
         WHERE id = ?`,
      ).run(errorMessage, id);
      return;
    }
    const backoffSec = Math.min(60 * Math.pow(2, job.attempts - 1), 3600);
    db.prepare(
      `UPDATE job_queue
       SET status = 'pending', locked_at = NULL, locked_by = NULL,
           run_at = datetime('now', '+' || ? || ' seconds'),
           last_error = ?
       WHERE id = ?`,
    ).run(backoffSec, errorMessage, id);
  },

  /** Reclaim jobs whose worker died (no heartbeat for > 5 min). */
  reclaimStuck(): number {
    const res = db.prepare(
      `UPDATE job_queue
       SET status = 'pending', locked_at = NULL, locked_by = NULL,
           run_at = datetime('now')
       WHERE status = 'running' AND locked_at < datetime('now', '-5 minutes')`,
    ).run();
    return res.changes;
  },

  /** Stats for the system dashboard. */
  stats(): Record<JobStatus, number> {
    const rows = db.prepare(
      `SELECT status, COUNT(*) AS n FROM job_queue GROUP BY status`,
    ).all() as Array<{ status: JobStatus; n: number }>;
    const out: Record<JobStatus, number> = {
      pending: 0, running: 0, succeeded: 0, failed: 0, dead: 0,
    };
    for (const r of rows) out[r.status] = r.n;
    return out;
  },

  parsePayload<T = Record<string, unknown>>(job: JobRow): T {
    return parseJson<T>(job.payload, {} as T);
  },
};
