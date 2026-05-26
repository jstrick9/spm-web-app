/**
 * Sync monitor: aggregates lifecycle events from the SDK client and the
 * write queue into a small queryable status object the control panel UI
 * subscribes to.
 *
 * Tracks:
 *   - Server reachability (online / offline)
 *   - Recent requests (last 50, ring buffer)
 *   - Recent sync conflicts (last 20)
 *   - Pending queue size + breakdown by domain
 *
 * Plain JS module (no React) so it can be tested in isolation.
 */
import { subscribe as subscribeClient, isServerReachable, type ClientEvent } from '../sdk/client.js';
import { subscribeQueue, peek as queuePeek, type QueueEvent } from './writeQueue.js';
import type { Domain } from './featureFlags.js';

export interface RequestEntry {
  ts: number;
  method: string;
  path: string;
  status: number;        // 0 if offline
  ok: boolean;
  ms: number;
  errorCode?: string;
}

export interface ConflictEntry {
  ts: number;
  domain: Domain;
  op: string;
  reason: string;
  clientId: string;
}

export interface SyncStatus {
  serverReachable: boolean;
  recentRequests: RequestEntry[];
  recentConflicts: ConflictEntry[];
  queueSize: number;
  queueByDomain: Partial<Record<Domain, number>>;
}

const MAX_REQUESTS  = 50;
const MAX_CONFLICTS = 20;

const recentRequests:  RequestEntry[] = [];
const recentConflicts: ConflictEntry[] = [];

type Listener = (s: SyncStatus) => void;
const listeners = new Set<Listener>();

function snapshot(): SyncStatus {
  const queue = queuePeek();
  const queueByDomain: Partial<Record<Domain, number>> = {};
  for (const w of queue) {
    queueByDomain[w.domain] = (queueByDomain[w.domain] ?? 0) + 1;
  }
  return {
    serverReachable: isServerReachable(),
    recentRequests:  [...recentRequests].reverse(),     // newest first
    recentConflicts: [...recentConflicts].reverse(),
    queueSize: queue.length,
    queueByDomain,
  };
}

function notify() {
  const s = snapshot();
  for (const l of listeners) {
    try { l(s); } catch { /* */ }
  }
}

let started = false;
export function startSyncMonitor(): void {
  if (started) return;
  started = true;

  subscribeClient((e: ClientEvent) => {
    switch (e.kind) {
      case 'request-start':
        // Don't log starts; only completions to keep the buffer useful.
        break;
      case 'request-success':
        recentRequests.push({
          ts: Date.now(), method: e.method, path: e.path,
          status: e.status, ok: true, ms: e.ms,
        });
        trimRequests();
        notify();
        break;
      case 'request-error':
        recentRequests.push({
          ts: Date.now(), method: e.method, path: e.path,
          status: e.error.status, ok: false, ms: e.ms,
          errorCode: e.error.code,
        });
        trimRequests();
        notify();
        break;
      case 'server-reachable':
      case 'server-unreachable':
        notify();
        break;
    }
  });

  subscribeQueue((e: QueueEvent) => {
    if (e.kind === 'replay-conflict') {
      recentConflicts.push({
        ts: Date.now(),
        domain: e.write.domain,
        op: e.write.op,
        reason: e.reason,
        clientId: e.write.clientId,
      });
      trimConflicts();
    }
    notify();
  });
}

function trimRequests() {
  while (recentRequests.length > MAX_REQUESTS) recentRequests.shift();
}
function trimConflicts() {
  while (recentConflicts.length > MAX_CONFLICTS) recentConflicts.shift();
}

export function subscribeSyncStatus(fn: Listener): () => void {
  listeners.add(fn);
  fn(snapshot());
  return () => { listeners.delete(fn); };
}

export function getSyncStatus(): SyncStatus {
  return snapshot();
}

// Test/dev helper
export function _resetSyncMonitor(): void {
  recentRequests.length = 0;
  recentConflicts.length = 0;
}
