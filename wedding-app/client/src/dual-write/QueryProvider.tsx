/**
 * Sets up TanStack Query with sensible defaults for this app.
 *
 *   - retry: only on network errors; never retry on 4xx (the user can't
 *     fix permission errors by waiting)
 *   - refetchOnWindowFocus: true (catches RSVPs submitted in another tab)
 *   - staleTime: 30s default; per-query overrides for hot data
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useMemo, type ReactNode } from 'react';
import { ApiError } from '../sdk/client.js';

function makeClient(): QueryClient {
  return new QueryClient({
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
