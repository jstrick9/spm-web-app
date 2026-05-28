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
export const jobsRepo = {
    enqueue(input) {
        const id = uuid();
        db.prepare(`INSERT INTO job_queue (id, kind, organization_id, payload, run_at, max_attempts)
       VALUES (?, ?, ?, ?, COALESCE(?, datetime('now')), ?)`).run(id, input.kind, input.organizationId ?? null, stringifyJson(input.payload ?? {}), input.runAt ?? null, input.maxAttempts ?? 5);
        return this.findById(id);
    },
    findById(id) {
        return db.prepare(`SELECT * FROM job_queue WHERE id = ?`).get(id);
    },
    /**
     * Atomically claim the next due pending job. Returns undefined if the
     * queue is empty (or nothing is due yet). The worker MUST eventually
     * call markSucceeded/markFailed for the returned job.
     *
     * The claim is done via a transaction: SELECT + UPDATE in one shot so
     * concurrent workers can't double-claim.
     */
    claimNext(workerId) {
        let claimed;
        const tx = db.transaction(() => {
            const candidate = db.prepare(`SELECT * FROM job_queue
         WHERE status = 'pending' AND run_at <= datetime('now')
         ORDER BY run_at ASC LIMIT 1`).get();
            if (!candidate)
                return;
            const res = db.prepare(`UPDATE job_queue
         SET status = 'running', locked_at = datetime('now'), locked_by = ?,
             attempts = attempts + 1
         WHERE id = ? AND status = 'pending'`).run(workerId, candidate.id);
            if (res.changes === 1) {
                claimed = db.prepare(`SELECT * FROM job_queue WHERE id = ?`).get(candidate.id);
            }
        });
        tx();
        return claimed;
    },
    markSucceeded(id, result) {
        db.prepare(`UPDATE job_queue
       SET status = 'succeeded', finished_at = datetime('now'),
           locked_at = NULL, locked_by = NULL, result = ?, last_error = NULL
       WHERE id = ?`).run(stringifyJson(result ?? {}), id);
    },
    /**
     * Mark the job failed and decide whether to retry.
     *   - If attempts < max_attempts: requeue with exponential backoff
     *     (60s × 2^(attempts-1), capped at 1 hour)
     *   - Otherwise: mark dead
     */
    markFailed(id, errorMessage) {
        const job = this.findById(id);
        if (!job)
            return;
        if (job.attempts >= job.max_attempts) {
            db.prepare(`UPDATE job_queue
         SET status = 'dead', finished_at = datetime('now'),
             locked_at = NULL, locked_by = NULL, last_error = ?
         WHERE id = ?`).run(errorMessage, id);
            return;
        }
        const backoffSec = Math.min(60 * Math.pow(2, job.attempts - 1), 3600);
        db.prepare(`UPDATE job_queue
       SET status = 'pending', locked_at = NULL, locked_by = NULL,
           run_at = datetime('now', '+' || ? || ' seconds'),
           last_error = ?
       WHERE id = ?`).run(backoffSec, errorMessage, id);
    },
    /** Reclaim jobs whose worker died (no heartbeat for > 5 min). */
    reclaimStuck() {
        const res = db.prepare(`UPDATE job_queue
       SET status = 'pending', locked_at = NULL, locked_by = NULL,
           run_at = datetime('now')
       WHERE status = 'running' AND locked_at < datetime('now', '-5 minutes')`).run();
        return res.changes;
    },
    /** Stats for the system dashboard. */
    stats() {
        const rows = db.prepare(`SELECT status, COUNT(*) AS n FROM job_queue GROUP BY status`).all();
        const out = {
            pending: 0, running: 0, succeeded: 0, failed: 0, dead: 0,
        };
        for (const r of rows)
            out[r.status] = r.n;
        return out;
    },
    parsePayload(job) {
        return parseJson(job.payload, {});
    },
};
//# sourceMappingURL=jobs.js.map