/**
 * Generic dual-write hook factory.
 *
 * A "resource" is a typed collection (e.g. guests in an event) with:
 *   - a stable cache key
 *   - a local store (read/write functions to localStorage)
 *   - a remote store (read/write functions to the SDK)
 *
 * Given those, this factory produces React Query hooks that respect the
 * current feature flag mode for this domain.
 *
 *   mode 'local'  → reads + writes localStorage; no network at all
 *   mode 'server' → reads + writes server; localStorage untouched
 *   mode 'dual'   → reads server, falls back to local on offline; writes
 *                   apply optimistically to local, then enqueue the
 *                   server-side write (queue replays on reconnect)
 *
 * This is intentionally minimal — per-domain hooks (useGuests, useEvents)
 * compose this with their own optimistic-update logic. Phase 3+ uses it.
 */
import { useQuery, useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query';
import type { Domain, DomainMode } from './featureFlags.js';
import { enqueue, registerExecutor } from './writeQueue.js';
import { ApiError } from '../sdk/client.js';

// ─── Local store contract ──────────────────────────
export interface LocalStore<T> {
  read():  T;
  write(value: T): void;
}

/** Helper to make a localStorage-backed LocalStore<T>. */
export function localStoreFromKey<T>(key: string, fallback: T): LocalStore<T> {
  return {
    read() {
      try {
        const raw = localStorage.getItem(key);
        return raw ? (JSON.parse(raw) as T) : fallback;
      } catch { return fallback; }
    },
    write(value) {
      try { localStorage.setItem(key, JSON.stringify(value)); }
      catch { /* */ }
    },
  };
}

// ─── Resource definition ───────────────────────────
export interface ResourceConfig<TList, TItem, TCreateInput, TUpdateInput> {
  domain: Domain;
  queryKey: QueryKey;
  local: LocalStore<TList>;

  // Server side - all optional; if undefined that op falls back to local-only.
  fetchRemote?:  () => Promise<TList>;
  createRemote?: (input: TCreateInput) => Promise<TItem>;
  updateRemote?: (id: string, patch: TUpdateInput) => Promise<TItem>;
  deleteRemote?: (id: string) => Promise<void>;

  // How to merge a created/updated item into the cached list.
  // Default: append for create, replace-by-id for update.
  mergeCreate?: (list: TList, item: TItem) => TList;
  mergeUpdate?: (list: TList, item: TItem) => TList;
  mergeDelete?: (list: TList, id: string) => TList;
}

// ─── The hook ──────────────────────────────────────
export function makeResourceHooks<TList, TItem extends { id: string }, TCreateInput, TUpdateInput>(
  config: ResourceConfig<TList, TItem, TCreateInput, TUpdateInput>,
) {
  const { domain, queryKey, local } = config;
  const merge = {
    create: config.mergeCreate ?? ((list: TList, item: TItem) => {
      if (Array.isArray(list)) return ([...list, item] as unknown as TList);
      return list;
    }),
    update: config.mergeUpdate ?? ((list: TList, item: TItem) => {
      if (Array.isArray(list)) {
        return (list as TItem[]).map(x => (x.id === item.id ? item : x)) as unknown as TList;
      }
      return list;
    }),
    delete: config.mergeDelete ?? ((list: TList, id: string) => {
      if (Array.isArray(list)) {
        return (list as TItem[]).filter(x => x.id !== id) as unknown as TList;
      }
      return list;
    }),
  };

  // Register replay executors so offline-queued writes can be drained later.
  if (config.createRemote) {
    registerExecutor(domain, 'create', async (w) => {
      await config.createRemote!((w.payload as { input: TCreateInput }).input);
    });
  }
  if (config.updateRemote) {
    registerExecutor(domain, 'update', async (w) => {
      const p = w.payload as { id: string; patch: TUpdateInput };
      await config.updateRemote!(p.id, p.patch);
    });
  }
  if (config.deleteRemote) {
    registerExecutor(domain, 'delete', async (w) => {
      await config.deleteRemote!((w.payload as { id: string }).id);
    });
  }

  /**
   * useList: returns the current list. Behavior depends on the mode.
   *
   * For React Query users: this returns a normal `UseQueryResult`. The
   * queryFn is what implements the mode-aware fetch.
   */
  function useList(mode: DomainMode) {
    return useQuery<TList>({
      queryKey: [...queryKey, mode],
      queryFn: async () => {
        if (mode === 'local' || !config.fetchRemote) {
          return local.read();
        }
        try {
          const remote = await config.fetchRemote();
          if (mode === 'dual') local.write(remote);   // keep local mirror fresh
          return remote;
        } catch (err) {
          if (mode === 'dual' && err instanceof ApiError && err.kind === 'offline') {
            return local.read();   // fallback to last-known-good
          }
          throw err;
        }
      },
      staleTime: 30_000,
    });
  }

  function useCreate(mode: DomainMode) {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: async (input: TCreateInput): Promise<TItem | { _optimistic: true; input: TCreateInput }> => {
        if (mode === 'local' || !config.createRemote) {
          const optimistic = { _optimistic: true, input } as { _optimistic: true; input: TCreateInput };
          // Local-only mode: callers are responsible for building the
          // item shape (we don't know it). They can pass {input} as the
          // payload and apply it themselves in onSuccess. Most callers
          // shouldn't use local-only mode in production though.
          return optimistic;
        }
        try {
          return await config.createRemote(input);
        } catch (err) {
          if (mode === 'dual' && err instanceof ApiError && err.kind === 'offline') {
            enqueue({ domain, op: 'create', payload: { input } });
            return { _optimistic: true, input };
          }
          throw err;
        }
      },
      onSuccess: () => {
        qc.invalidateQueries({ queryKey });
      },
    });
  }

  function useUpdate(mode: DomainMode) {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: async ({ id, patch }: { id: string; patch: TUpdateInput }) => {
        if (mode === 'local' || !config.updateRemote) {
          return { _optimistic: true, id, patch };
        }
        try {
          return await config.updateRemote(id, patch);
        } catch (err) {
          if (mode === 'dual' && err instanceof ApiError && err.kind === 'offline') {
            enqueue({ domain, op: 'update', payload: { id, patch } });
            return { _optimistic: true, id, patch };
          }
          throw err;
        }
      },
      onSuccess: () => qc.invalidateQueries({ queryKey }),
    });
  }

  function useDelete(mode: DomainMode) {
    const qc = useQueryClient();
    return useMutation({
      mutationFn: async (id: string) => {
        if (mode === 'local' || !config.deleteRemote) return;
        try {
          await config.deleteRemote(id);
        } catch (err) {
          if (mode === 'dual' && err instanceof ApiError && err.kind === 'offline') {
            enqueue({ domain, op: 'delete', payload: { id } });
            return;
          }
          throw err;
        }
      },
      onSuccess: () => qc.invalidateQueries({ queryKey }),
    });
  }

  return { useList, useCreate, useUpdate, useDelete, merge };
}
