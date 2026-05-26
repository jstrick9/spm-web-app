import { beforeEach, describe, expect, it } from 'vitest';
import {
  _resetSyncMonitor, getSyncStatus, startSyncMonitor, subscribeSyncStatus,
} from './syncMonitor.js';
import { sdk } from '../sdk/index.js';
import { resetStore } from '../test/handlers.js';
import { clear as clearQueue, enqueue } from './writeQueue.js';

beforeEach(() => {
  _resetSyncMonitor();
  clearQueue();
  resetStore();
  startSyncMonitor();
});

describe('syncMonitor', () => {
  it('records successful requests', async () => {
    await sdk.auth.register({ email: 's@x.com', password: 'pw1234', fullName: 'S', orgName: 'O' });
    const status = getSyncStatus();
    expect(status.recentRequests.length).toBeGreaterThan(0);
    const reg = status.recentRequests.find(r => r.path === '/api/auth/register');
    expect(reg).toBeTruthy();
    expect(reg!.ok).toBe(true);
    expect(reg!.status).toBe(201);
  });

  it('records failed requests with error code', async () => {
    try { await sdk.auth.login('does-not@exist.com', 'wrong'); } catch { /* */ }
    const failed = getSyncStatus().recentRequests.find(r => !r.ok);
    expect(failed).toBeTruthy();
    expect(failed!.status).toBe(401);
    expect(failed!.errorCode).toBe('invalid-credentials');
  });

  it('tracks queue size grouped by domain', () => {
    enqueue({ domain: 'guests', op: 'create', payload: {} });
    enqueue({ domain: 'guests', op: 'update', payload: {} });
    enqueue({ domain: 'events', op: 'create', payload: {} });
    const status = getSyncStatus();
    expect(status.queueSize).toBe(3);
    expect(status.queueByDomain.guests).toBe(2);
    expect(status.queueByDomain.events).toBe(1);
  });

  it('subscribers receive updates on request completion', async () => {
    let snapshot = getSyncStatus();
    const unsub = subscribeSyncStatus((s) => { snapshot = s; });
    await sdk.auth.register({ email: 'sub@x.com', password: 'pw1234', fullName: 'S', orgName: 'O' });
    unsub();
    expect(snapshot.recentRequests.length).toBeGreaterThan(0);
  });
});
