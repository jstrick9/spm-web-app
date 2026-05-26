import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clear, drain, enqueue, peek, registerExecutor, size, subscribeQueue,
} from './writeQueue.js';
import { ApiError } from '../sdk/client.js';

beforeEach(() => {
  clear();
});

describe('writeQueue basic ops', () => {
  it('enqueue adds to persistent storage', () => {
    expect(size()).toBe(0);
    enqueue({ domain: 'guests', op: 'create', payload: { x: 1 } });
    expect(size()).toBe(1);
    const head = peek()[0];
    expect(head.domain).toBe('guests');
    expect(head.op).toBe('create');
    expect(head.attempts).toBe(0);
    expect(head.clientId).toBeTruthy();
  });

  it('persists across reads', () => {
    enqueue({ domain: 'guests', op: 'create', payload: {} });
    enqueue({ domain: 'guests', op: 'update', payload: {} });
    expect(size()).toBe(2);
  });
});

describe('drain', () => {
  it('runs the registered executor for each queued write in order', async () => {
    const calls: string[] = [];
    registerExecutor('events', 'create', async () => { calls.push('create'); });
    registerExecutor('events', 'update', async () => { calls.push('update'); });
    enqueue({ domain: 'events', op: 'create', payload: {} });
    enqueue({ domain: 'events', op: 'update', payload: {} });
    await drain();
    expect(calls).toEqual(['create', 'update']);
    expect(size()).toBe(0);
  });

  it('on offline failure: leaves the write in the queue and stops', async () => {
    registerExecutor('events', 'create', async () => {
      throw new ApiError('offline', 0, 'network-error');
    });
    enqueue({ domain: 'events', op: 'create', payload: {} });
    enqueue({ domain: 'events', op: 'create', payload: {} });
    await drain();
    expect(size()).toBe(2);   // neither was removed
  });

  it('on conflict: drops the write and emits replay-conflict', async () => {
    const events: string[] = [];
    const unsub = subscribeQueue((e) => events.push(e.kind));
    registerExecutor('events', 'create', async () => {
      throw new ApiError('conflict', 409, 'revision-conflict');
    });
    enqueue({ domain: 'events', op: 'create', payload: {} });
    await drain();
    unsub();
    expect(size()).toBe(0);
    expect(events).toContain('replay-conflict');
  });

  it('on unauthorized: stops draining and keeps the write', async () => {
    registerExecutor('events', 'create', async () => {
      throw new ApiError('unauthorized', 401, 'unauthenticated');
    });
    enqueue({ domain: 'events', op: 'create', payload: {} });
    enqueue({ domain: 'events', op: 'create', payload: {} });
    await drain();
    expect(size()).toBe(2);
  });

  it('on server error: retries up to MAX_ATTEMPTS then drops', async () => {
    const calls: number[] = [];
    registerExecutor('events', 'create', async () => {
      calls.push(1);
      throw new ApiError('server', 500, 'internal-error');
    });
    enqueue({ domain: 'events', op: 'create', payload: {} });
    // Each drain only advances attempts by 1 (then it bails to wait/backoff).
    // Drain 5 times to exhaust attempts.
    for (let i = 0; i < 5; i++) await drain();
    expect(calls.length).toBe(5);
    expect(size()).toBe(0);   // dropped after MAX_ATTEMPTS
  });

  it('drops writes with no registered executor', async () => {
    enqueue({ domain: 'audit', op: 'nonexistent-op', payload: {} });
    await drain();
    expect(size()).toBe(0);
  });
});

describe('queue events', () => {
  it('emits queued / replay-start / replay-success', async () => {
    const evs: string[] = [];
    const unsub = subscribeQueue((e) => evs.push(e.kind));
    registerExecutor('events', 'create', async () => {});
    enqueue({ domain: 'events', op: 'create', payload: {} });
    await drain();
    unsub();
    expect(evs).toEqual(['queued', 'replay-start', 'replay-success', 'drained']);
  });
});
