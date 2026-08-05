import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createSSEStream } from './sse';
import { setToken } from './client';

/**
 * SSE token refresh regression: the stream token is short-lived (5 min);
 * before this fix EventSource reconnected forever with the SAME expired
 * token after the server dropped the stream, silently killing real-time
 * updates. The stream must reconnect with a FRESH token before expiry.
 */

class FakeEventSource {
  static instances: FakeEventSource[] = [];
  url: string;
  onmessage: ((e: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  closed = false;
  constructor(url: string) {
    this.url = url;
    FakeEventSource.instances.push(this);
  }
  close() { this.closed = true; }
}

let fetchCalls: Array<{ url: string; headers: Record<string, string> }> = [];

beforeEach(() => {
  FakeEventSource.instances = [];
  fetchCalls = [];
  setToken('main-jwt');
  (globalThis as any).EventSource = FakeEventSource;
  (globalThis as any).fetch = async (url: string, init?: { headers?: Record<string, string> }) => {
    fetchCalls.push({ url, headers: init?.headers ?? {} });
    if (url.includes('/sse-token')) {
      return { ok: true, json: async () => ({ token: `sse-token-${fetchCalls.length}` }) } as Response;
    }
    return { ok: true, json: async () => ({}) } as Response;
  };
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  delete (globalThis as any).EventSource;
  setToken(null);
});

describe('createSSEStream token refresh', () => {
  it('opens with a fresh token and reconnects with a NEW token before expiry', async () => {
    const stream = createSSEStream('org-1');
    stream.on('event.created', vi.fn());

    // Initial connect: fetch token + open EventSource.
    await Promise.resolve();
    await Promise.resolve();
    expect(fetchCalls.filter((c) => c.url.includes('/sse-token'))).toHaveLength(1);
    expect(FakeEventSource.instances).toHaveLength(1);
    expect(FakeEventSource.instances[0].url).toContain('sse-token-1');

    // Advance 4 minutes: the pre-expiry refresh fires, closing the old
    // stream and opening a NEW one with a fresh token.
    vi.advanceTimersByTime(4 * 60 * 1000 + 50);
    await Promise.resolve();
    await Promise.resolve();

    expect(FakeEventSource.instances[0].closed).toBe(true);
    expect(FakeEventSource.instances).toHaveLength(2);
    expect(fetchCalls.filter((c) => c.url.includes('/sse-token'))).toHaveLength(2);
    expect(FakeEventSource.instances[1].url).toContain('sse-token-2');

    stream.close();
  });

  it('continues delivering messages after refresh (lastId preserved)', async () => {
    const stream = createSSEStream('org-1');
    const handler = vi.fn();
    stream.on('guest.created', handler);

    await Promise.resolve();
    await Promise.resolve();
    // Deliver a message on the first connection; lastId must advance.
    FakeEventSource.instances[0].onmessage!({ data: JSON.stringify({ id: 7, type: 'guest.created', payload: {}, actorUserId: null, timestamp: new Date().toISOString() }) });
    expect(handler).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(4 * 60 * 1000 + 50);
    await Promise.resolve();
    await Promise.resolve();
    expect(FakeEventSource.instances[1].url).toContain('lastId=7');

    stream.close();
  });

  it('close() clears the refresh timer', async () => {
    const stream = createSSEStream('org-1');
    stream.on('event.created', vi.fn());
    await Promise.resolve();
    await Promise.resolve();
    stream.close();
    const before = FakeEventSource.instances.length;
    vi.advanceTimersByTime(5 * 60 * 1000);
    await Promise.resolve();
    // No new connection after close.
    expect(FakeEventSource.instances.length).toBe(before);
  });
});
