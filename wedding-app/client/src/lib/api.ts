/**
 * Tiny typed fetch wrapper. Centralizes:
 *   - base URL handling (relative paths so Vite proxy + prod both work)
 *   - JWT injection (ONLY when `auth: true` — the default — to avoid
 *     leaking the venue-owner's token to the public portal endpoints)
 *   - JSON parsing + error normalization
 *
 * Replaces ALL of the front-end's previous direct `localStorage` reads/writes
 * with HTTP calls to our own server.
 */

const TOKEN_KEY = 'wedding-poc-jwt';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  constructor(public status: number, public code: string, public details?: unknown) {
    super(`${status} ${code}`);
  }
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  { auth = true }: { auth?: boolean } = {}
): Promise<T> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  // SECURITY: only attach the bearer token when the caller explicitly opts in
  // (auth: true is the default for app endpoints; the Guest Portal passes
  // auth: false so a logged-in venue owner viewing the public RSVP page in
  // the same browser does NOT silently authenticate to the public endpoint).
  if (auth) {
    const token = getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  if (!res.ok) {
    throw new ApiError(res.status, data?.error ?? 'unknown', data);
  }
  return data as T;
}

export const api = {
  get:    <T>(p: string, opts?: { auth?: boolean }) => request<T>('GET', p, undefined, opts),
  post:   <T>(p: string, body?: unknown, opts?: { auth?: boolean }) => request<T>('POST', p, body, opts),
  put:    <T>(p: string, body?: unknown, opts?: { auth?: boolean }) => request<T>('PUT', p, body, opts),
  delete: <T>(p: string, opts?: { auth?: boolean }) => request<T>('DELETE', p, undefined, opts),
};
