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
import { jobsRepo, type JobRow } from '../db/repos/jobs.js';
import { runAction } from '../integrations/runtime.js';
import { scanUpcomingDeadlines } from './lifecycleEmails.js';
import { hostname } from 'node:os';

const POLL_INTERVAL_MS = 1000;          // how often to look for new jobs
const RECLAIM_INTERVAL_MS = 60_000;     // how often to reclaim stuck jobs
const RSVP_SCAN_INTERVAL_MS = 6 * 60 * 60 * 1000; // lifecycle reminder scan (6h)
const WORKER_ID = `${process.pid}@${hostname()}`;

// Handler registry: kind → function
type Handler = (payload: Record<string, unknown>) => Promise<Record<string, unknown> | void>;
const handlers = new Map<string, Handler>();

export function registerHandler(kind: string, fn: Handler): void {
  handlers.set(kind, fn);
}

let stopped = false;
let tickTimer: ReturnType<typeof setTimeout> | null = null;
let reclaimTimer: ReturnType<typeof setInterval> | null = null;
let rsvpScanTimer: ReturnType<typeof setInterval> | null = null;

export function startWorker(): void {
  if (tickTimer || reclaimTimer) return;     // already running
  stopped = false;
  registerCoreHandlers();
  // Periodically rescue stuck running jobs (worker crashed mid-task)
  reclaimTimer = setInterval(() => {
    try { jobsRepo.reclaimStuck(); } catch (e) { logErr('reclaim', e); }
  }, RECLAIM_INTERVAL_MS);
  // Lifecycle email engine: scan for RSVP-deadline reminders. The daily marker
  // inside scanUpcomingDeadlines() dedupes, so running it a few times a day (and
  // once at boot) is safe and ensures reminders go out promptly.
  const runScan = () => {
    try { scanUpcomingDeadlines(); } catch (e) { logErr('rsvp-scan', e); }
  };
  rsvpScanTimer = setInterval(runScan, RSVP_SCAN_INTERVAL_MS);
  setTimeout(runScan, 5_000); // initial scan shortly after boot
  scheduleNext();
}

export function stopWorker(): void {
  stopped = true;
  if (tickTimer) { clearTimeout(tickTimer); tickTimer = null; }
  if (reclaimTimer) { clearInterval(reclaimTimer); reclaimTimer = null; }
  if (rsvpScanTimer) { clearInterval(rsvpScanTimer); rsvpScanTimer = null; }
}

function scheduleNext(): void {
  if (stopped) return;
  tickTimer = setTimeout(tick, POLL_INTERVAL_MS);
}

async function tick(): Promise<void> {
  try {
    let job: JobRow | undefined;
    while ((job = jobsRepo.claimNext(WORKER_ID))) {
      await processJob(job);
    }
  } catch (e) {
    logErr('tick', e);
  } finally {
    scheduleNext();
  }
}

async function processJob(job: JobRow): Promise<void> {
  const handler = handlers.get(job.kind);
  if (!handler) {
    jobsRepo.markFailed(job.id, `no handler registered for kind "${job.kind}"`);
    return;
  }
  try {
    const payload = jobsRepo.parsePayload(job);
    const result = await handler(payload);
    jobsRepo.markSucceeded(job.id, result ?? undefined);
  } catch (e) {
    jobsRepo.markFailed(job.id, (e as Error).message);
  }
}

function logErr(where: string, e: unknown): void {
  console.error(`[worker:${where}]`, (e as Error).message);
}

// ─── Core handlers ──────────────────────────────────────
function registerCoreHandlers(): void {
  /** Generic integration action runner — most jobs fan out through here. */
  registerHandler('integration.action', async (payload) => {
    const { integrationId, actionId, input, relatedType, relatedId } = payload as {
      integrationId: string; actionId: string; input: unknown;
      relatedType?: string; relatedId?: string;
    };
    const result = await runAction({ integrationId, actionId, input, relatedType, relatedId });
    return { result } as Record<string, unknown>;
  });

  /** Convenience: enqueue('email.send', {...}) without the integration wrapping. */
  registerHandler('email.send', async (payload) => {
    const { integrationId, ...input } = payload as {
      integrationId: string;
      to: string | string[];
      subject: string;
      html?: string;
      text?: string;
    };
    return await runAction({
      integrationId,
      actionId: 'sendEmail',
      input,
    }) as Record<string, unknown>;
  });


  /** Convenience: enqueue('sms.send', {...}) without the integration wrapping. */
  registerHandler('sms.send', async (payload) => {
    const { integrationId, ...input } = payload as {
      integrationId: string;
      to: string | string[];
      body: string;
    };
    return await runAction({
      integrationId,
      actionId: 'sendSms',
      input,
    }) as Record<string, unknown>;
  });
}
