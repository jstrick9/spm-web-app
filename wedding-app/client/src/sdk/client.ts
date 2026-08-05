/**
 * Low-level HTTP client. Every domain SDK module (auth, events, guests, ...)
 * goes through here so we have one place to:
 *   - inject the JWT
 *   - normalize errors into ApiError
 *   - detect "offline" vs "server error" vs "auth expired"
 *   - emit lifecycle events the dual-write layer subscribes to
 *
 * This file is intentionally framework-free (no React imports) so it can
 * also be used from web workers, service workers, and CLI scripts.
 */
import type { ApiErrorBody } from './types.js';

const TOKEN_KEY = 'wedding-jwt';

// ─── Token storage ─────────────────────────────────
export function getToken(): string | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;
  } catch {
    return null;
  }
}

export function setToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch { /* private mode etc. */ }
  notifyListeners({ kind: 'token-changed', hasToken: Boolean(token) });
}

// ─── Error type ────────────────────────────────────
/**
 * Every non-2xx response (and every network error) becomes an ApiError.
 * Callers branch on .kind to decide how to react.
 *
 *   - kind: 'offline'      → fetch failed before reaching the server
 *   - kind: 'unauthorized' → 401, JWT missing/expired/invalidated
 *   - kind: 'forbidden'    → 403, permission missing
 *   - kind: 'not-found'    → 404
 *   - kind: 'conflict'     → 409 (revision-conflict, role-in-use, etc.)
 *   - kind: 'validation'   → 400 with .details from zod
 *   - kind: 'rate-limited' → 429 (friendly 'try again in a moment')
 *   - kind: 'server'       → 5xx or any other unhandled status
 */
export class ApiError extends Error {
  constructor(
    public readonly kind:
      | 'offline' | 'unauthorized' | 'forbidden' | 'not-found'
      | 'conflict' | 'validation' | 'rate-limited' | 'server',
    public readonly status: number,
    public readonly code: string,
    public readonly body?: ApiErrorBody,
  ) {
    // Prefer the server's human-readable message when present (e.g. the
    // venue-space-conflict message listing the conflicting bookings), with a
    // stable `${status} ${code}` fallback for callers that branch on it.
    super(typeof body?.message === 'string' && body.message ? `${status} ${code}: ${body.message}` : `${status} ${code}`);
    this.name = 'ApiError';
  }
}

// ─── Lifecycle events ──────────────────────────────
// The dual-write layer + the admin control panel both want to know about
// network state changes ("server unreachable", "back online", "token expired",
// etc.). We expose a tiny pub/sub instead of forcing every consumer to
// listen to `window.online`/`window.offline`.

export type ClientEvent =
  | { kind: 'token-changed'; hasToken: boolean }
  | { kind: 'request-start';    method: string; path: string }
  | { kind: 'request-success';  method: string; path: string; status: number; ms: number }
  | { kind: 'request-error';    method: string; path: string; error: ApiError; ms: number }
  | { kind: 'server-reachable'; }
  | { kind: 'server-unreachable'; };

type Listener = (e: ClientEvent) => void;
const listeners = new Set<Listener>();

export function subscribe(fn: Listener): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

function notifyListeners(e: ClientEvent) {
  for (const l of listeners) {
    try { l(e); } catch { /* listener errors must not break the request */ }
  }
}

// ─── Reachability state ────────────────────────────
let serverReachable = true;
export function isServerReachable(): boolean { return serverReachable; }

function markReachable() {
  if (!serverReachable) {
    serverReachable = true;
    notifyListeners({ kind: 'server-reachable' });
  }
}
function markUnreachable() {
  if (serverReachable) {
    serverReachable = false;
    notifyListeners({ kind: 'server-unreachable' });
  }
}

// ─── Core request function ─────────────────────────
export interface RequestOptions {
  /** Default true. Set false for public endpoints (portal). */
  auth?: boolean;
  /** AbortSignal for cancellation. */
  signal?: AbortSignal;
  /** Override the base URL (for tests). Defaults to same-origin. */
  baseUrl?: string;
}

export async function request<T>(
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown,
  { auth = true, signal, baseUrl = '' }: RequestOptions = {},
): Promise<T> {
  const url = `${baseUrl}${path}`;
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (auth) {
    const token = getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }

  notifyListeners({ kind: 'request-start', method, path });
  const start = Date.now();

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
    });
  } catch (err) {
    // Network failure: server unreachable, dns failure, CORS preflight,
    // user is offline, etc.
    const apiErr = new ApiError('offline', 0, 'network-error');
    markUnreachable();
    notifyListeners({ kind: 'request-error', method, path, error: apiErr, ms: Date.now() - start });
    throw apiErr;
  }

  markReachable();

  // 204 No Content
  if (res.status === 204) {
    notifyListeners({ kind: 'request-success', method, path, status: 204, ms: Date.now() - start });
    return undefined as T;
  }

  const text = await res.text();
  const json: unknown = text ? safeJsonParse(text) : null;

  if (!res.ok) {
    const body = (json ?? {}) as ApiErrorBody;
    const apiErr = new ApiError(
      classifyStatus(res.status),
      res.status,
      body.error ?? 'unknown',
      body,
    );
    notifyListeners({ kind: 'request-error', method, path, error: apiErr, ms: Date.now() - start });
    throw apiErr;
  }

  notifyListeners({ kind: 'request-success', method, path, status: res.status, ms: Date.now() - start });
  return json as T;
}

function classifyStatus(s: number): ApiError['kind'] {
  if (s === 401) return 'unauthorized';
  if (s === 403) return 'forbidden';
  if (s === 404) return 'not-found';
  if (s === 409) return 'conflict';
  if (s === 400) return 'validation';
  if (s === 429) return 'rate-limited';
  return 'server';
}

function safeJsonParse(s: string): unknown {
  try { return JSON.parse(s); } catch { return null; }
}

// ─── Tiny method wrappers ──────────────────────────
export const api = {
  get:    <T>(p: string, opts?: RequestOptions)                  => request<T>('GET',    p, undefined, opts),
  post:   <T>(p: string, body?: unknown, opts?: RequestOptions)  => request<T>('POST',   p, body,      opts),
  put:    <T>(p: string, body?: unknown, opts?: RequestOptions)  => request<T>('PUT',    p, body,      opts),
  patch:  <T>(p: string, body?: unknown, opts?: RequestOptions)  => request<T>('PATCH',  p, body,      opts),
  delete: <T>(p: string, body?: unknown, opts?: RequestOptions) => request<T>('DELETE', p, body,      opts),
};

/**
 * Authenticated file download / open.
 *
 * Protected export endpoints (ICS, CSV, ZIP packets, PDFs) reject requests
 * without the JWT. A plain `<a href="/api/...">` navigation cannot carry the
 * Authorization header, so every download must go through fetch with the
 * token, then hand the resulting Blob to the browser via an object URL.
 *
 * @param path        API path (e.g. `/api/events/e1/export.ics`)
 * @param opts.open   When true, open the blob in a new tab (for viewing PDFs)
 *                    instead of downloading it.
 * @param opts.filename  Preferred filename; falls back to the server's
 *                    Content-Disposition, then the URL's last segment.
 */
export async function downloadFile(
  path: string,
  opts: { open?: boolean; filename?: string } = {},
): Promise<void> {
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(path, { method: 'GET', headers });
  } catch {
    markUnreachable();
    throw new ApiError('offline', 0, 'network-error');
  }
  markReachable();

  if (!res.ok) {
    let body: ApiErrorBody | null = null;
    try { body = (await res.json()) as ApiErrorBody; } catch { /* non-JSON error */ }
    throw new ApiError(classifyStatus(res.status), res.status, body?.error ?? 'unknown', body ?? undefined);
  }

  const blob = await res.blob();
  const disposition = res.headers.get('content-disposition') ?? '';
  const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition);
  const serverFilename = match ? match[1].trim() : '';
  const fallback = path.split('/').filter(Boolean).pop() ?? 'download';
  const filename = opts.filename || serverFilename || fallback;

  const url = URL.createObjectURL(blob);
  if (opts.open) {
    // 'noopener' keeps the new tab sandboxed; revoke after a delay so the
    // browser has time to load the blob before the URL dies.
    window.open(url, '_blank', 'noopener');
    setTimeout(() => { try { URL.revokeObjectURL(url); } catch { /* noop */ } }, 60_000);
    return;
  }
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => { try { URL.revokeObjectURL(url); } catch { /* noop */ } }, 60_000);
}
