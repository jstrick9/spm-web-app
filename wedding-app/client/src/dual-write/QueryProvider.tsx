/**
 * Sets up TanStack Query with sensible defaults for this app.
 *
 *   - retry: only on network errors; never retry on 4xx (the user can't
 *     fix permission errors by waiting)
 *   - refetchOnWindowFocus: true (catches RSVPs submitted in another tab)
 *   - staleTime: 30s default; per-query overrides for hot data
 */
import { QueryClient, QueryClientProvider, MutationCache } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useMemo, type ReactNode } from 'react';
import { ApiError } from '../sdk/client.js';
import { emitUnhandledError } from '../lib/unhandledErrorBus.js';

function makeClient(): QueryClient {
  return new QueryClient({
    mutationCache: new MutationCache({
      /**
       * Global safety net for mutations that don't handle their own errors
       * (UX-6): without this, a failed delete/save with no `onError` fails
       * silently and the user sees nothing. Callers that pass their own
       * `onError` are skipped (they own the UX), and offline/unauthorized
       * errors are skipped because the write queue and the auth flow own
       * those. ToastProvider subscribes and renders the destructive toast.
       */
      onError: (error, _variables, _context, mutation) => {
        if (typeof mutation.options.onError === 'function') return;
        // The auth flow owns session-expiry handling (redirect etc.).
        if (error instanceof ApiError && error.kind === 'unauthorized') return;
        // Offline errors used to be skipped on the theory that "the write
        // queue owns retry" — but only check-ins are queued, so every other
        // mutation failing offline was silently LOST. Surface it honestly.
        emitUnhandledError(error);
      },
    }),
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: true,
        retry: (failureCount, error) => {
          if (error instanceof ApiError && error.kind !== 'offline' && error.kind !== 'server') {
            return false;
          }
          return failureCount < 2;
        },
      },
      mutations: {
        retry: false,   // never auto-retry mutations; the queue handles offline retry
      },
    },
  });
}

interface Props {
  children: ReactNode;
  /** Optional pre-made client (for tests). */
  client?: QueryClient;
  /** Show the devtools panel in development. */
  showDevtools?: boolean;
}

export function QueryProvider({ children, client, showDevtools = false }: Props) {
  const qc = useMemo(() => client ?? makeClient(), [client]);
  return (
    <QueryClientProvider client={qc}>
      {children}
      {showDevtools && <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-right" />}
    </QueryClientProvider>
  );
}
