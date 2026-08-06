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

  it('offline failure schedules an automatic retry (no server-reachable event needed)', async () => {
    vi.useFakeTimers();
    try {
      const calls: string[] = [];
      registerExecutor('events', 'create', async () => {
        calls.push('attempt');
        if (calls.length === 1) throw new ApiError('offline', 0, 'network-error');
      });
      enqueue({ domain: 'events', op: 'create', payload: {} });
      await drain();
      expect(calls).toEqual(['attempt']);   // first attempt failed
      expect(size()).toBe(1);               // write kept

      // Backoff elapses → the retry timer drains automatically and succeeds.
      await vi.advanceTimersByTimeAsync(10_000);
      expect(calls).toEqual(['attempt', 'attempt']);
      expect(size()).toBe(0);               // replayed and removed
    } finally {
      vi.useRealTimers();
    }
  });

  it('offline retry backoff grows with attempts', async () => {
    vi.useFakeTimers();
    try {
      const calls: string[] = [];
      registerExecutor('events', 'create', async () => {
        calls.push('attempt');
        throw new ApiError('offline', 0, 'network-error');
      });
      enqueue({ domain: 'events', op: 'create', payload: {} });
      await drain();                        // attempt 1 at t=0
      await vi.advanceTimersByTimeAsync(2_000);  // retry 1 at ~t=2s
      expect(calls.length).toBe(2);
      await vi.advanceTimersByTimeAsync(3_999);  // retry 2 not yet (4s backoff)
      expect(calls.length).toBe(2);
      await vi.advanceTimersByTimeAsync(1);      // t=6s → retry 2
      expect(calls.length).toBe(3);
    } finally {
      vi.useRealTimers();
    }
  });

  it('transient 5xx schedules an automatic retry too', async () => {
    vi.useFakeTimers();
    try {
      const calls: string[] = [];
      registerExecutor('events', 'create', async () => {
        calls.push('attempt');
        if (calls.length === 1) throw new ApiError('server', 500, 'internal-error');
      });
      enqueue({ domain: 'events', op: 'create', payload: {} });
      await drain();
      expect(size()).toBe(1);
      await vi.advanceTimersByTimeAsync(10_000);
      expect(calls).toEqual(['attempt', 'attempt']);
      expect(size()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
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

  it('keeps writes with no registered executor (lazy chunk may still load)', async () => {
    enqueue({ domain: 'audit', op: 'nonexistent-op', payload: {} });
    await drain();
    expect(size()).toBe(1); // retained, not silently dropped
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

describe('drain permanent errors', () => {
  it('validation (400) drops the write immediately instead of burning retries', async () => {
    const calls: number[] = [];
    registerExecutor('events', 'create', async () => {
      calls.push(1);
      throw new ApiError('validation', 400, 'invalid-input');
    });
    enqueue({ domain: 'events', op: 'create', payload: {} });
    await drain();
    expect(calls.length).toBe(1);       // no retry loop
    expect(size()).toBe(0);             // dropped immediately
  });

  it('forbidden (403) drops the write immediately', async () => {
    const calls: number[] = [];
    registerExecutor('guests', 'update', async () => {
      calls.push(1);
      throw new ApiError('forbidden', 403, 'forbidden');
    });
    enqueue({ domain: 'guests', op: 'update', payload: {} });
    await drain();
    expect(calls.length).toBe(1);
    expect(size()).toBe(0);
  });
});

describe('re-auth drain after unauthorized pause', () => {
  it('drains the queue again when a fresh token arrives (token-changed)', async () => {
    const { startAutoReplay } = await import('./writeQueue.js');
    const { setToken } = await import('../sdk/client.js');

    let failOnce = true;
    registerExecutor('events', 'create', async () => {
      if (failOnce) { failOnce = false; throw new ApiError('unauthorized', 401, 'unauthenticated'); }
    });
    startAutoReplay();
    enqueue({ domain: 'events', op: 'create', payload: {} });

    // First drain: 401 pauses the queue with the write intact.
    await drain();
    expect(size()).toBe(1);

    // Re-auth fires 'token-changed' → auto-replay must resume draining.
    setToken('fresh-jwt');
    await new Promise((r) => setTimeout(r, 50));
    expect(size()).toBe(0);
    setToken(null);
  });
});

describe('no-executor retention (lazy chunk race)', () => {
  it('keeps a queued write when no executor is registered yet (no silent drop)', async () => {
    enqueue({ domain: 'vendors', op: 'checkin.update', payload: { eventId: 'e1', vendorId: 'v1', status: 'arrived' } });
    await drain();
    // The write must STILL be in the queue — never dropped.
    expect(size()).toBe(1);
  });

  it('drains automatically once the executor registers (lazy chunk arrives)', async () => {
    let replayed = 0;
    registerExecutor('vendors', 'checkin.update', async () => { replayed++; });
    enqueue({ domain: 'vendors', op: 'checkin.update', payload: { eventId: 'e1', vendorId: 'v1', status: 'arrived' } });

    // First drain: no executor for THIS op yet → write kept.
    // (registerExecutor above registered the executor BEFORE enqueue in this
    // test, so simulate the race by registering AFTER enqueue.)
    // Reset: clear the queue, enqueue, drain with no executor, THEN register.
    clear();
    enqueue({ domain: 'staff', op: 'task.update', payload: { id: 't1' } });
    await drain();
    expect(size()).toBe(1); // kept (no executor)

    // Now the lazy chunk loads and registers its executor → auto-drain.
    let replayed2 = 0;
    registerExecutor('staff', 'task.update', async () => { replayed2++; });
    await new Promise((r) => setTimeout(r, 50));
    expect(replayed2).toBe(1);
    expect(size()).toBe(0);
  });
});
