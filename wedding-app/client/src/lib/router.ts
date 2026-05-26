/**
 * Tiny hash-based router. We deliberately avoid react-router because:
 *   - hash routing means no dev-server config or SPA-fallback gymnastics
 *   - we have ~20 routes total and they're all flat
 *
 * Usage:
 *   const { path, params, query, navigate } = useRouter();
 *
 *   if (matchPath('/events/:eventId', path)) {
 *     const id = params.eventId;
 *     ...
 *   }
 *
 *   navigate('/events/abc-123');
 *   navigate('/events?status=booked');
 */
import { useCallback, useEffect, useMemo, useState } from 'react';

export interface RouterState {
  /** Path portion of the hash, e.g. '/events/abc-123' (always starts with /) */
  path: string;
  /** Parsed query params from the hash, e.g. '?status=booked' */
  query: URLSearchParams;
  /** Helper: change the route */
  navigate: (to: string, opts?: { replace?: boolean }) => void;
  /** The full hash, e.g. '#/events?status=booked' */
  hash: string;
}

function parseHash(hash: string): { path: string; query: URLSearchParams } {
  const noHash = hash.startsWith('#') ? hash.slice(1) : hash;
  const [rawPath, rawQuery] = noHash.split('?');
  const path = rawPath || '/';
  const query = new URLSearchParams(rawQuery ?? '');
  return { path: path.startsWith('/') ? path : '/' + path, query };
}

export function useRouter(): RouterState {
  const [hash, setHash] = useState(() => window.location.hash || '#/');

  useEffect(() => {
    const fn = () => setHash(window.location.hash || '#/');
    window.addEventListener('hashchange', fn);
    return () => window.removeEventListener('hashchange', fn);
  }, []);

  const navigate = useCallback((to: string, opts: { replace?: boolean } = {}) => {
    const normalized = to.startsWith('#') ? to : `#${to.startsWith('/') ? to : '/' + to}`;
    if (opts.replace) {
      const url = new URL(window.location.href);
      url.hash = normalized;
      window.history.replaceState(null, '', url.toString());
      // history.replaceState doesn't fire hashchange — emit manually
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    } else {
      window.location.hash = normalized;
    }
  }, []);

  const { path, query } = useMemo(() => parseHash(hash), [hash]);
  return { path, query, navigate, hash };
}

/**
 * Match a path pattern with `:param` segments against a real path.
 * Returns parsed params if matched, null otherwise.
 *
 *   matchPath('/events/:eventId', '/events/abc') → { eventId: 'abc' }
 *   matchPath('/events/:eventId/guests', '/events/abc/guests') → { eventId: 'abc' }
 *   matchPath('/events', '/events/abc') → null
 */
export function matchPath(pattern: string, actual: string): Record<string, string> | null {
  const patternSegs = pattern.split('/').filter(Boolean);
  const actualSegs  = actual.split('/').filter(Boolean);
  if (patternSegs.length !== actualSegs.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < patternSegs.length; i++) {
    const p = patternSegs[i];
    const a = actualSegs[i];
    if (p.startsWith(':')) {
      params[p.slice(1)] = decodeURIComponent(a);
    } else if (p !== a) {
      return null;
    }
  }
  return params;
}

/** Match a path PREFIX (good for "is this a sub-page of events?"). */
export function matchPrefix(prefix: string, actual: string): boolean {
  if (prefix === actual) return true;
  return actual.startsWith(prefix.endsWith('/') ? prefix : prefix + '/');
}
