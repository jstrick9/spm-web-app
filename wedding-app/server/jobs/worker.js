/**
 * Job worker — in-process tick loop that processes the job_queue.
 *
 *   import { startWorker } from './jobs/worker.js';
 *   startWorker();
 *
 * Why in-process not a separate worker container?
 *   - Self-hosted single-container deployment is the design goal
 *   - The job rate is low (email per RSVP, periodic polls — not high throughput)
 *   - One fewer process to monitor; one fewer thing for users to misconfigure
 *
 * If/when load demands it, the worker can be extracted to its own process
 * by simply running `node dist/jobs/worker.js` against the same DB.
 */
import { jobsRepo } from '../db/repos/jobs.js';
import { runAction } from '../integrations/runtime.js';
import { hostname } from 'node:os';
const POLL_INTERVAL_MS = 1000; // how often to look for new jobs
const RECLAIM_INTERVAL_MS = 60_000; // how often to reclaim stuck jobs
const WORKER_ID = `${process.pid}@${hostname()}`;
const handlers = new Map();
export function registerHandler(kind, fn) {
    handlers.set(kind, fn);
}
let stopped = false;
let tickTimer = null;
let reclaimTimer = null;
export function startWorker() {
    if (tickTimer || reclaimTimer)
        return; // already running
    stopped = false;
    registerCoreHandlers();
    // Periodically rescue stuck running jobs (worker crashed mid-task)
    reclaimTimer = setInterval(() => {
        try {
            jobsRepo.reclaimStuck();
        }
        catch (e) {
            logErr('reclaim', e);
        }
    }, RECLAIM_INTERVAL_MS);
    scheduleNext();
}
export function stopWorker() {
    stopped = true;
    if (tickTimer) {
        clearTimeout(tickTimer);
        tickTimer = null;
    }
    if (reclaimTimer) {
        clearInterval(reclaimTimer);
        reclaimTimer = null;
    }
}
function scheduleNext() {
    if (stopped)
        return;
    tickTimer = setTimeout(tick, POLL_INTERVAL_MS);
}
async function tick() {
    try {
        let job;
        while ((job = jobsRepo.claimNext(WORKER_ID))) {
            await processJob(job);
        }
    }
    catch (e) {
        logErr('tick', e);
    }
    finally {
        scheduleNext();
    }
}
async function processJob(job) {
    const handler = handlers.get(job.kind);
    if (!handler) {
        jobsRepo.markFailed(job.id, `no handler registered for kind "${job.kind}"`);
        return;
    }
    try {
        const payload = jobsRepo.parsePayload(job);
        const result = await handler(payload);
        jobsRepo.markSucceeded(job.id, result ?? undefined);
    }
    catch (e) {
        jobsRepo.markFailed(job.id, e.message);
    }
}
function logErr(where, e) {
    console.error(`[worker:${where}]`, e.message);
}
// ─── Core handlers ──────────────────────────────────────
function registerCoreHandlers() {
    /** Generic integration action runner — most jobs fan out through here. */
    registerHandler('integration.action', async (payload) => {
        const { integrationId, actionId, input, relatedType, relatedId } = payload;
        const result = await runAction({ integrationId, actionId, input, relatedType, relatedId });
        return { result };
    });
    /** Convenience: enqueue('email.send', {...}) without the integration wrapping. */
    registerHandler('email.send', async (payload) => {
        const { integrationId, ...input } = payload;
        return await runAction({
            integrationId,
            actionId: 'sendEmail',
            input,
        });
    });
}
//# sourceMappingURL=worker.js.map