/**
 * Tests for the dual-write hook factory.
 *
 * Strategy: build a tiny `useThings` resource, render it inside a test
 * QueryClientProvider, and assert behavior under each mode.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { localStoreFromKey, makeResourceHooks } from './useDualResource.js';
import { clear as clearQueue, peek } from './writeQueue.js';
import { ApiError } from '../sdk/client.js';

interface Thing { id: string; name: string }

function wrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

function makeQC() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 0, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

beforeEach(() => {
  localStorage.clear();
  clearQueue();
});

describe('useDualResource - local mode', () => {
  it('reads from local store, never calls remote', async () => {
    const local = localStoreFromKey<Thing[]>('test.things', []);
    local.write([{ id: '1', name: 'A' }, { id: '2', name: 'B' }]);
    const fetchRemote = vi.fn(async () => [] as Thing[]);

    const hooks = makeResourceHooks<Thing[], Thing, { name: string }, { name: string }>({
      domain: 'events',
      queryKey: ['test', 'things'],
      local,
      fetchRemote,
    });

    const qc = makeQC();
    const { result } = renderHook(() => hooks.useList('local'), { wrapper: wrapper(qc) });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([{ id: '1', name: 'A' }, { id: '2', name: 'B' }]);
    expect(fetchRemote).not.toHaveBeenCalled();
  });
});

describe('useDualResource - server mode', () => {
  it('reads from remote, never touches local on success', async () => {
    const local = localStoreFromKey<Thing[]>('test.things', []);
    const fetchRemote = vi.fn(async () => [{ id: 'r1', name: 'Remote' }]);

    const hooks = makeResourceHooks<Thing[], Thing, { name: string }, { name: string }>({
      domain: 'events',
      queryKey: ['test', 'things'],
      local,
      fetchRemote,
    });

    const qc = makeQC();
    const { result } = renderHook(() => hooks.useList('server'), { wrapper: wrapper(qc) });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([{ id: 'r1', name: 'Remote' }]);
    expect(fetchRemote).toHaveBeenCalledTimes(1);
    expect(local.read()).toEqual([]);  // not updated in server mode
  });

  it('surfaces ApiError on offline (no fallback)', async () => {
    const local = localStoreFromKey<Thing[]>('test.things', []);
    local.write([{ id: 'cached', name: 'Cached' }]);
    const fetchRemote = vi.fn(async () => {
      throw new ApiError('offline', 0, 'network-error');
    });

    const hooks = makeResourceHooks<Thing[], Thing, { name: string }, { name: string }>({
      domain: 'events',
      queryKey: ['test', 'things'],
      local,
      fetchRemote,
    });

    const qc = makeQC();
    const { result } = renderHook(() => hooks.useList('server'), { wrapper: wrapper(qc) });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeInstanceOf(ApiError);
  });
});

describe('useDualResource - dual mode', () => {
  it('reads from remote, mirrors to local on success', async () => {
    const local = localStoreFromKey<Thing[]>('test.things', []);
    const fetchRemote = vi.fn(async () => [{ id: 'r1', name: 'Remote' }]);

    const hooks = makeResourceHooks<Thing[], Thing, { name: string }, { name: string }>({
      domain: 'events',
      queryKey: ['test', 'things'],
      local,
      fetchRemote,
    });

    const qc = makeQC();
    const { result } = renderHook(() => hooks.useList('dual'), { wrapper: wrapper(qc) });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([{ id: 'r1', name: 'Remote' }]);
    expect(local.read()).toEqual([{ id: 'r1', name: 'Remote' }]);  // mirrored
  });

  it('falls back to local cache on offline', async () => {
    const local = localStoreFromKey<Thing[]>('test.things', []);
    local.write([{ id: 'cached', name: 'Cached' }]);
    const fetchRemote = vi.fn(async () => {
      throw new ApiError('offline', 0, 'network-error');
    });

    const hooks = makeResourceHooks<Thing[], Thing, { name: string }, { name: string }>({
      domain: 'events',
      queryKey: ['test', 'things'],
      local,
      fetchRemote,
    });

    const qc = makeQC();
    const { result } = renderHook(() => hooks.useList('dual'), { wrapper: wrapper(qc) });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([{ id: 'cached', name: 'Cached' }]);
  });

  it('useCreate enqueues offline writes for later replay', async () => {
    const local = localStoreFromKey<Thing[]>('test.things', []);
    const createRemote = vi.fn(async () => {
      throw new ApiError('offline', 0, 'network-error');
    });

    const hooks = makeResourceHooks<Thing[], Thing, { name: string }, { name: string }>({
      domain: 'events',
      queryKey: ['test', 'things'],
      local,
      createRemote,
    });

    const qc = makeQC();
    const { result } = renderHook(() => hooks.useCreate('dual'), { wrapper: wrapper(qc) });

    await act(async () => {
      await result.current.mutateAsync({ name: 'New thing' });
    });

    expect(peek()).toHaveLength(1);
    expect(peek()[0].domain).toBe('events');
    expect(peek()[0].op).toBe('create');
  });

  it('useUpdate enqueues offline updates', async () => {
    const local = localStoreFromKey<Thing[]>('test.things', []);
    const updateRemote = vi.fn(async () => {
      throw new ApiError('offline', 0, 'network-error');
    });

    const hooks = makeResourceHooks<Thing[], Thing, { name: string }, { name: string }>({
      domain: 'events',
      queryKey: ['test', 'things'],
      local,
      updateRemote,
    });

    const qc = makeQC();
    const { result } = renderHook(() => hooks.useUpdate('dual'), { wrapper: wrapper(qc) });
    await act(async () => {
      await result.current.mutateAsync({ id: 'x', patch: { name: 'New' } });
    });
    expect(peek()).toHaveLength(1);
    expect(peek()[0].op).toBe('update');
  });

  it('useDelete enqueues offline deletes', async () => {
    const local = localStoreFromKey<Thing[]>('test.things', []);
    const deleteRemote = vi.fn(async () => {
      throw new ApiError('offline', 0, 'network-error');
    });

    const hooks = makeResourceHooks<Thing[], Thing, { name: string }, { name: string }>({
      domain: 'events',
      queryKey: ['test', 'things'],
      local,
      deleteRemote,
    });

    const qc = makeQC();
    const { result } = renderHook(() => hooks.useDelete('dual'), { wrapper: wrapper(qc) });
    await act(async () => {
      await result.current.mutateAsync('x');
    });
    expect(peek()).toHaveLength(1);
    expect(peek()[0].op).toBe('delete');
  });

  it('does NOT enqueue on non-offline errors (e.g. 403)', async () => {
    const local = localStoreFromKey<Thing[]>('test.things', []);
    const createRemote = vi.fn(async () => {
      throw new ApiError('forbidden', 403, 'forbidden');
    });

    const hooks = makeResourceHooks<Thing[], Thing, { name: string }, { name: string }>({
      domain: 'events',
      queryKey: ['test', 'things'],
      local,
      createRemote,
    });

    const qc = makeQC();
    const { result } = renderHook(() => hooks.useCreate('dual'), { wrapper: wrapper(qc) });
    await expect(
      act(async () => { await result.current.mutateAsync({ name: 'x' }); }),
    ).rejects.toThrow(/forbidden/);
    expect(peek()).toHaveLength(0);
  });
});

describe('useDualResource - merge defaults', () => {
  it('mergeCreate appends to an array list', async () => {
    const local = localStoreFromKey<Thing[]>('test.things', []);
    const createRemote = vi.fn(async (input: { name: string }) =>
      ({ id: 'x', name: input.name }));

    const hooks = makeResourceHooks<Thing[], Thing, { name: string }, { name: string }>({
      domain: 'events',
      queryKey: ['test', 'things'],
      local,
      createRemote,
    });

    const merged = hooks.merge.create([{ id: 'a', name: 'A' }], { id: 'b', name: 'B' });
    expect(merged).toEqual([{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }]);
  });

  it('mergeUpdate replaces by id', async () => {
    const local = localStoreFromKey<Thing[]>('test.things', []);
    const hooks = makeResourceHooks<Thing[], Thing, { name: string }, { name: string }>({
      domain: 'events',
      queryKey: ['test', 'things'],
      local,
    });
    const merged = hooks.merge.update(
      [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }],
      { id: 'b', name: 'B updated' },
    );
    expect(merged).toEqual([{ id: 'a', name: 'A' }, { id: 'b', name: 'B updated' }]);
  });

  it('mergeDelete removes by id', () => {
    const hooks = makeResourceHooks<Thing[], Thing, { name: string }, { name: string }>({
      domain: 'events',
      queryKey: ['test', 'things'],
      local: localStoreFromKey<Thing[]>('test.things', []),
    });
    const merged = hooks.merge.delete([{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }], 'a');
    expect(merged).toEqual([{ id: 'b', name: 'B' }]);
  });
});
