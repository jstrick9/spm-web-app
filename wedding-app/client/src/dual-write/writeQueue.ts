/**
 * Persistent offline write queue.
 *
 * Every dual-write that fails with `ApiError.kind === 'offline'` gets
 * pushed onto this queue. On reconnect (when client.ts emits a
 * 'server-reachable' event) we drain the queue, applying each write in
 * order.
 *
 * Conflict handling (per Phase 2 design decision):
 *   - If the replayed write returns ApiError.kind === 'conflict',
 *     we revert the local optimistic state and emit a 'sync-conflict'
 *     event so the UI can surface it.
 *   - If it returns 'unauthorized', we drop the write (token expired)
 *     and emit 'sync-auth-expired'.
 *   - If 'server' (5xx), we keep it in the queue and retry with
 *     exponential backoff.
 *
 * The queue is keyed on a stable client-generated `clientId` per write
 * so optimistic UI can deduplicate.
 */
import { subscribe, type ClientEvent } from '../sdk/client.js';
import type { Domain } from './featureFlags.js';

export interface QueuedWrite {
  clientId: string;
  domain: Domain;
  /** Free-form op id ('events.create', 'guests.update', etc.) for telemetry */
  op: string;
  /** Arbitrary payload the executor knows how to replay */
  payload: unknown;
  queuedAt: number;
  attempts: number;
  lastError?: string;
}

export type QueueEvent =
  | { kind: 'queued';           write: QueuedWrite }
  | { kind: 'replay-start';     write: QueuedWrite }
  | { kind: 'replay-success';   write: QueuedWrite }
  | { kind: 'replay-conflict';  write: QueuedWrite; reason: string }
  | { kind: 'replay-failed';    write: QueuedWrite; reason: string; willRetry: boolean }
  | { kind: 'drained' };

const STORAGE_KEY = 'wedding.writeQueue';
const MAX_ATTEMPTS = 5;

type Executor = (write: QueuedWrite) => Promise<void>;
const executors = new Map<string, Executor>();

/**
 * Register how a particular (domain, op) pair should be replayed.
 * Called once by each domain hook at module-load time.
 *
 * Example:
 *   registerExecutor('guests', 'create', async (w) => {
 *     await sdk.guests.create(w.payload.eventId, w.payload.input);
 *   });
 */
export function registerExecutor(domain: Domain, op: string, fn: Executor): void {
  executors.set(`${domain}:${op}`, fn);
  // A domain chunk (lazy-loaded) just registered its replay executor — if
  // there are queued writes for it (e.g. the startup drain found none and
  // bailed), retry draining now that the executor exists.
  if (read().some((w) => w.domain === domain && w.op === op)) {
    void drain();
  }
}

// ─── Listeners ─────────────────────────────────────
type Listener = (e: QueueEvent) => void;
const listeners = new Set<Listener>();

export function subscribeQueue(fn: Listener): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

function notify(e: QueueEvent) {
  for (const l of listeners) {
    try { l(e); } catch { /* */ }
  }
}

// ─── Persistence ───────────────────────────────────
function read(): QueuedWrite[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as QueuedWrite[]) : [];
  } catch { return []; }
}

function write(q: QueuedWrite[]): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(q)); }
  catch { /* */ }
}

// ─── Public API ────────────────────────────────────
export function enqueue(input: Omit<QueuedWrite, 'queuedAt' | 'attempts' | 'clientId'> & { clientId?: string }): QueuedWrite {
  const w: QueuedWrite = {
    clientId: input.clientId ?? `w-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    domain: input.domain,
    op: input.op,
    payload: input.payload,
    queuedAt: Date.now(),
    attempts: 0,
  };
  const q = read();
  q.push(w);
  write(q);
  notify({ kind: 'queued', write: w });
  return w;
}

export function peek(): QueuedWrite[] {
  return read();
}

export function size(): number {
  return read().length;
}

export function clear(): void {
  write([]);
}

// ─── Replay engine ─────────────────────────────────
let draining = false;

/**
 * Drain the queue, attempting each write in order. Stops on the first
 * permanent failure (5xx, will retry on next tick) or when the queue
 * is empty.
 */
export async function drain(): Promise<void> {
  if (draining) return;
  draining = true;
  try {
    while (true) {
      const q = read();
      if (q.length === 0) {
        notify({ kind: 'drained' });
        return;
      }
      const head = q[0];
      const exec = executors.get(`${head.domain}:${head.op}`);
      if (!exec) {
        // Executor not registered yet (the domain chunk may still be
        // loading). Keep the write and stop — registerExecutor() kicks a
        // drain when the executor arrives. DROPPING here silently lost
        // writes: the app's startup drain (100ms) raced the lazy-loaded
        // check-in chunk and wiped the queue.
        notify({ kind: 'replay-failed', write: head, reason: 'no-executor', willRetry: true });
        return;
      }

      notify({ kind: 'replay-start', write: head });
      head.attempts++;
      try {
        await exec(head);
        // success → pop the head
        write(read().slice(1));
        notify({ kind: 'replay-success', write: head });
        continue;
      } catch (err) {
        const e = err as { kind?: string; code?: string; message?: string };
        const reason = e.code ?? e.message ?? 'unknown';

        if (e.kind === 'conflict') {
          // Permanent: server has newer data. Drop and let UI handle.
          write(read().slice(1));
          notify({ kind: 'replay-conflict', write: head, reason });
          continue;
        }
        if (e.kind === 'unauthorized') {
          // Token died; queue stays until user re-auths (startAutoReplay
          // drains again on 'token-changed').
          notify({ kind: 'replay-failed', write: head, reason: 'unauthorized', willRetry: true });
          return;
        }
        if (e.kind === 'validation' || e.kind === 'forbidden') {
          // Permanent: the payload is rejected by the server (malformed or
          // no permission) and retrying can never change that. Drop and let
          // the UI surface it instead of blocking the queue head for 5 rounds.
          write(read().slice(1));
          notify({ kind: 'replay-failed', write: head, reason: e.code ?? e.kind, willRetry: false });
          continue;
        }
        if (e.kind === 'offline') {
          // Still offline; stop and wait for next 'server-reachable' event.
          notify({ kind: 'replay-failed', write: head, reason: 'offline', willRetry: true });
          return;
        }
        // 5xx / validation / other
        head.lastError = reason;
        if (head.attempts >= MAX_ATTEMPTS) {
          write(read().slice(1));
          notify({ kind: 'replay-failed', write: head, reason, willRetry: false });
          continue;
        }
        // Persist attempt count and stop (back off; next drain will retry)
        const q2 = read();
        q2[0] = head;
        write(q2);
        notify({ kind: 'replay-failed', write: head, reason, willRetry: true });
        return;
      }
    }
  } finally {
    draining = false;
  }
}

// ─── Auto-replay on reconnect ──────────────────────
let autoStarted = false;
export function startAutoReplay(): void {
  if (autoStarted) return;
  autoStarted = true;
  subscribe((e: ClientEvent) => {
    if (e.kind === 'server-reachable') void drain();
    // Re-auth after an 'unauthorized' pause: 'server-reachable' won't fire
    // again (the 401 response already marked the server reachable), so the
    // queue would otherwise sit forever after a fresh login.
    if (e.kind === 'token-changed' && e.hasToken) void drain();
  });
  // Try once on startup too, in case there's a leftover queue from a
  // previous session and the server is up.
  if (typeof window !== 'undefined') {
    setTimeout(() => void drain(), 100);
  }
}
