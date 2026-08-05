/**
 * Probe batch #6 — SSE + auth-token edge cases.
 * Asserts the server NEVER returns 5xx on adversarial input, and that the
 * SSE/auth boundaries reject with the right 4xx codes.
 */
import '../test/setup.js';
import { describe, it, expect, beforeAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../index.js';
import { db } from '../db/database.js';

let app: FastifyInstance;
let token = '';
let orgId = '';
let userId = '';

beforeAll(async () => {
  app = await buildApp();
  await app.ready();
  const reg = await app.inject({
    method: 'POST', url: '/api/auth/register',
    payload: { email: `probe6-${Math.random().toString(36).slice(2)}@x.com`, password: 'testpass123', fullName: 'Probe', orgName: 'Probe6 Org' },
    headers: { 'content-type': 'application/json' },
  });
  token = reg.json().token;
  orgId = reg.json().organizationId;
  userId = reg.json().user.id;
});

// NOTE: must be a function — module-level consts evaluate before beforeAll() sets `token`.
const AUTH = () => ({ authorization: `Bearer ${token}` });


/**
 * Open an SSE stream over a real socket (app.inject can't handle
 * never-ending connections). Resolves with status/headers/first chunk,
 * then destroys the socket.
 */
import { request as httpRequest } from 'node:http';

function openSseStream(path: string): Promise<{ status: number; contentType: string; firstChunk: string }> {
  return new Promise((resolve, reject) => {
    const server = (app as unknown as { server: import('node:http').Server }).server;
    const addr = server.address() as { port: number };
    const req = httpRequest(
      { host: '127.0.0.1', port: addr.port, path, method: 'GET' },
      (res) => {
        let chunk = '';
        res.on('data', (d: Buffer) => {
          chunk += d.toString();
          resolve({ status: res.statusCode ?? 0, contentType: String(res.headers['content-type'] ?? ''), firstChunk: chunk });
          req.destroy();
        });
        res.on('error', () => { /* socket teardown races */ });
      },
    );
    req.on('error', reject);
    req.end();
  });
}

beforeAll(async () => {
  // Ensure the underlying server is listening so openSseStream can connect.
  const server = (app as unknown as { server: import('node:http').Server }).server;
  if (!server.listening) {
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  }
});

describe('probe batch #6 — SSE stream + sse-token', () => {
  it('sse-token: auth required, org scoped, short-lived sseOnly token issued', async () => {
    const noAuth = await app.inject({ method: 'GET', url: `/api/orgs/${orgId}/sse-token` });
    expect(noAuth.statusCode).toBe(401);
    const otherOrg = await app.inject({ method: 'GET', url: '/api/orgs/not-my-org/sse-token', headers: AUTH() });
    expect(otherOrg.statusCode).toBe(403);
    const ok = await app.inject({ method: 'GET', url: `/api/orgs/${orgId}/sse-token`, headers: AUTH() });
    expect(ok.statusCode).toBe(200);
    const decoded = app.jwt.verify(ok.json().token) as any;
    expect(decoded.sseOnly).toBe(true);
    expect(decoded.sub).toBe(userId);
  });

  it('stream rejects: no token, main JWT, malformed token, garbage org', async () => {
    const noToken = await app.inject({ method: 'GET', url: `/api/orgs/${orgId}/events/stream` });
    expect(noToken.statusCode).toBe(401);
    const mainJwt = await app.inject({ method: 'GET', url: `/api/orgs/${orgId}/events/stream?token=${encodeURIComponent(token)}` });
    expect(mainJwt.statusCode).toBe(401);
    const garbage = await app.inject({ method: 'GET', url: `/api/orgs/${orgId}/events/stream?token=${encodeURIComponent('a'.repeat(400))}` });
    expect(garbage.statusCode).toBe(401);
    const badOrg = await app.inject({ method: 'GET', url: `/api/orgs/${'z'.repeat(64)}/events/stream?token=${encodeURIComponent('x')}` });
    expect(badOrg.statusCode).toBe(401);
  });

  it('stream with a valid token opens a real text/event-stream connection', async () => {
    const sseRes = await app.inject({ method: 'GET', url: `/api/orgs/${orgId}/sse-token`, headers: AUTH() });
    expect(sseRes.statusCode).toBe(200);
    const { status, contentType, firstChunk } = await openSseStream(`/api/orgs/${orgId}/events/stream?token=${encodeURIComponent(sseRes.json().token)}&lastId=0`);
    expect(status).toBe(200);
    expect(contentType).toContain('text/event-stream');
    // SSE framing: initial keep-alive comment or retry line.
    expect(firstChunk).toMatch(/^(:( |$)|retry:|data:|event:)/);
  });

  it('stream with adversarial lastId values — opens or cleanly rejects, never 5xx', async () => {
    const sseRes = await app.inject({ method: 'GET', url: `/api/orgs/${orgId}/sse-token`, headers: AUTH() });
    const sseToken = sseRes.json().token;
    const evil = ['abc', '-5', '0', '1e999', '99999999999999999999999', 'NaN', 'Infinity', '1.5', '', '  7  ', '%00'];
    for (const lastId of evil) {
      const { status } = await openSseStream(`/api/orgs/${orgId}/events/stream?token=${encodeURIComponent(sseToken)}&lastId=${encodeURIComponent(lastId)}`);
      // Stream endpoints either open 200 (hijacked SSE) or a clean 4xx; never 5xx.
      expect(status, `lastId=${lastId}`).toBeLessThan(500);
    }
  });
});

describe('probe batch #6 — auth token edge cases', () => {
  it('rejects tampered / expired / wrong-session JWTs', async () => {
    // Tampered signature
    const [head, payload, sig] = token.split('.');
    const tampered = `${head}.${payload}.${sig.replace(/./g, (c, i) => (i === 0 ? (c === 'a' ? 'b' : 'a') : c))}`;
    const tamperedRes = await app.inject({ method: 'GET', url: '/api/auth/me', headers: { authorization: `Bearer ${tampered}` } });
    expect(tamperedRes.statusCode).toBe(401);

    // Expired (signed in the past)
    const expired = app.jwt.sign({ sub: userId, email: 'x@x.com', sv: 1 }, { expiresIn: '-1s' });
    const expiredRes = await app.inject({ method: 'GET', url: '/api/auth/me', headers: { authorization: `Bearer ${expired}` } });
    expect(expiredRes.statusCode).toBe(401);

    // Wrong session version (as if the user changed password elsewhere)
    const stale = app.jwt.sign({ sub: userId, email: 'x@x.com', sv: 999 }, { expiresIn: '5m' });
    const staleRes = await app.inject({ method: 'GET', url: '/api/auth/me', headers: { authorization: `Bearer ${stale}` } });
    expect(staleRes.statusCode).toBe(401);
    expect(staleRes.json().error).toBe('session-invalidated');
  });

  it('rejects a token for a disabled user', async () => {
    const reg = await app.inject({
      method: 'POST', url: '/api/auth/register',
      payload: { email: `probe6d-${Math.random().toString(36).slice(2)}@x.com`, password: 'testpass123', fullName: 'D', orgName: 'D Org' },
      headers: { 'content-type': 'application/json' },
    });
    const uId = reg.json().user.id;
    const t = reg.json().token;
    db.prepare(`UPDATE users SET status = 'disabled' WHERE id = ?`).run(uId);
    const res = await app.inject({ method: 'GET', url: '/api/auth/me', headers: { authorization: `Bearer ${t}` } });
    expect(res.statusCode).toBe(401);
    expect(res.json().error).toBe('user-disabled');
  });

  it('password reset tokens: malformed/reused/expired all 4xx, never 5xx', async () => {
    const reg = await app.inject({
      method: 'POST', url: '/api/auth/register',
      payload: { email: `probe6p-${Math.random().toString(36).slice(2)}@x.com`, password: 'testpass123', fullName: 'P', orgName: 'P Org' },
      headers: { 'content-type': 'application/json' },
    });
    const email = reg.json().user.email;
    const reqReset = await app.inject({
      method: 'POST', url: '/api/auth/password-reset/request',
      payload: { email },
      headers: { 'content-type': 'application/json' },
    });
    expect(reqReset.statusCode).toBe(200);
    const resetToken = reqReset.json().resetToken as string;
    expect(resetToken).toBeTruthy(); // test env returns the token

    const complete = (t: string) => app.inject({
      method: 'POST', url: '/api/auth/password-reset/complete',
      payload: { token: t, newPassword: 'brandnewpass123' },
      headers: { 'content-type': 'application/json' },
    });

    const ok = await complete(resetToken);
    expect(ok.statusCode).toBe(200);
    // Reuse must fail
    const reuse = await complete(resetToken);
    expect(reuse.statusCode).toBe(400);
    const malformed = await complete('not-a-real-token');
    expect(malformed.statusCode).toBe(400);
    const garbage = await complete('a'.repeat(500));
    expect(garbage.statusCode).toBe(400);
    // Missing body fields
    const empty = await app.inject({ method: 'POST', url: '/api/auth/password-reset/complete', payload: {}, headers: { 'content-type': 'application/json' } });
    expect(empty.statusCode).toBe(400);
  });

  it('magic link flows: garbage tokens and payloads never 5xx', async () => {
    const r1 = await app.inject({ method: 'POST', url: '/api/auth/magic-link/verify', payload: { token: 12345 }, headers: { 'content-type': 'application/json' } });
    expect(r1.statusCode).toBeLessThan(500);
    const r2 = await app.inject({ method: 'POST', url: '/api/auth/magic-link/verify', payload: {} });
    expect(r2.statusCode).toBeLessThan(500);
    const r3 = await app.inject({ method: 'POST', url: '/api/auth/magic-link', payload: { email: 'x'.repeat(500) + '@x.com' } });
    expect(r3.statusCode).toBeLessThan(500);
  });
});

describe('probe batch #6 — session hardening follow-ups', () => {
  it('logout records an audit row (session invalidation is client-side by design)', async () => {
    const reg = await app.inject({
      method: 'POST', url: '/api/auth/register',
      payload: { email: `probe6l-${Math.random().toString(36).slice(2)}@x.com`, password: 'testpass123', fullName: 'L', orgName: 'L Org' },
      headers: { 'content-type': 'application/json' },
    });
    const t = reg.json().token;
    const uId = reg.json().user.id;
    const logout = await app.inject({ method: 'POST', url: '/api/auth/logout', headers: { authorization: `Bearer ${t}` } });
    expect(logout.statusCode).toBe(200);
    const audit = db.prepare(`SELECT COUNT(*) AS n FROM audit_logs WHERE action = 'user.logout' AND actor_user_id = ?`).get(uId) as { n: number };
    expect(audit.n).toBe(1);
    // Password change DOES invalidate all sessions (session_version bump).
    const change = await app.inject({
      method: 'POST', url: '/api/auth/change-password',
      payload: { currentPassword: 'testpass123', newPassword: 'brandnewpass456' },
      headers: { authorization: `Bearer ${t}`, 'content-type': 'application/json' },
    });
    expect(change.statusCode).toBe(200);
    const after = await app.inject({ method: 'GET', url: '/api/auth/me', headers: { authorization: `Bearer ${t}` } });
    expect(after.statusCode).toBe(401);
  });
});
