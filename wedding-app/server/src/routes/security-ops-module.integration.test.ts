/**
 * MODULE-10 — Security & Ops regression tests.
 *
 * Covers SO-02..SO-04 from docs/MODULE-10-SECURITY-OPS.md: friendly
 * secrets-key error, SSE stream sseOnly-token policy + user re-validation,
 * and the configurable account-lockout window.
 */
import './../test/setup.js';
import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { get as httpGet } from 'node:http';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../index.js';
import { db } from '../db/database.js';
import { usersRepo, eventsRepo } from '../db/repos/index.js';

let app: FastifyInstance;

beforeAll(async () => { app = await buildApp(); await app.ready(); });
beforeEach(() => { db.exec('BEGIN'); });
afterEach(async () => { db.exec('ROLLBACK'); });

async function registerOwner(): Promise<{ token: string; orgId: string; userId: string; email: string }> {
  const email = `mod10-${Math.random().toString(36).slice(2)}@x.com`;
  const res = await app.inject({
    method: 'POST', url: '/api/auth/register',
    payload: { email, password: 'testpass123', fullName: 'Owner', orgName: 'Module10 Manor' },
    headers: { 'content-type': 'application/json' },
  });
  expect(res.statusCode).toBe(201);
  return { token: res.json().token, orgId: res.json().organizationId, userId: res.json().user.id, email };
}

describe('SO-03 — SSE stream token policy', () => {
  it('rejects the main JWT; accepts only the short-lived sseOnly token', async () => {
    const owner = await registerOwner();

    // Main JWT in the URL must be rejected.
    const main = await app.inject({ method: 'GET', url: `/api/orgs/${owner.orgId}/events/stream?token=${encodeURIComponent(owner.token)}` });
    expect(main.statusCode).toBe(401);

    // A token without the sseOnly claim (signed like a main token) is rejected too.
    const forged = app.jwt.sign({ sub: owner.userId, email: owner.email, memberships: [], sseOnly: false });
    const forgedRes = await app.inject({ method: 'GET', url: `/api/orgs/${owner.orgId}/events/stream?token=${encodeURIComponent(forged)}` });
    expect(forgedRes.statusCode).toBe(401);

    // The real sse-token works and streams — SSE responses never end, so
    // exercise it over a real socket: read the first chunk, then destroy.
    const sseTokenRes = await app.inject({ method: 'GET', url: `/api/orgs/${owner.orgId}/sse-token`, headers: { authorization: `Bearer ${owner.token}` } });
    expect(sseTokenRes.statusCode).toBe(200);
    const sseToken = sseTokenRes.json().token;
    // Publish an event so the catch-up stream has something to send on connect.
    const { broadcastSSE } = await import('./sse.js');
    broadcastSSE(owner.orgId, 'event.updated', { eventId: 'probe', title: 'probe' });
    await app.listen({ port: 0, host: '127.0.0.1' });
    const address = app.server.address() as { port: number };
    const streamStatus = await new Promise<{ status: number; contentType: string; firstChunk: string }>((resolve, reject) => {
      const req = httpGet({
        host: '127.0.0.1', port: address.port,
        path: `/api/orgs/${owner.orgId}/events/stream?token=${encodeURIComponent(sseToken)}`,
      }, (res) => {
        const settle = (chunk: Buffer) => {
          resolve({ status: res.statusCode ?? 0, contentType: String(res.headers['content-type'] ?? ''), firstChunk: chunk.toString('utf8') });
          res.destroy();
          req.destroy();
        };
        res.once('data', settle);
        // SSE headers arrive immediately; if the catch-up is empty the body
        // waits for the next broadcast — headers are enough to prove access.
        setTimeout(() => { if (!res.destroyed) settle(Buffer.from('')); }, 500).unref();
      });
      req.on('error', reject);
      setTimeout(() => { req.destroy(); reject(new Error('stream timeout')); }, 3000).unref();
    });
    expect(streamStatus.status).toBe(200);
    expect(streamStatus.contentType).toContain('text/event-stream');
    // The stream opens with the immediate keep-alive comment; real events
    // (data:) follow when the org has any.
    expect(streamStatus.firstChunk).toMatch(/^: connected/);
  });

  it('rejects a disabled user\'s sse-token', async () => {
    const owner = await registerOwner();
    const sseTokenRes = await app.inject({ method: 'GET', url: `/api/orgs/${owner.orgId}/sse-token`, headers: { authorization: `Bearer ${owner.token}` } });
    const sseToken = sseTokenRes.json().token;
    db.prepare(`UPDATE users SET status = 'disabled' WHERE id = ?`).run(owner.userId);
    const stream = await app.inject({ method: 'GET', url: `/api/orgs/${owner.orgId}/events/stream?token=${encodeURIComponent(sseToken)}` });
    expect(stream.statusCode).toBe(401);
  });

  it('rejects a stale sse-token after session invalidation', async () => {
    const owner = await registerOwner();
    const sseTokenRes = await app.inject({ method: 'GET', url: `/api/orgs/${owner.orgId}/sse-token`, headers: { authorization: `Bearer ${owner.token}` } });
    const sseToken = sseTokenRes.json().token;
    db.prepare(`UPDATE users SET session_version = session_version + 1 WHERE id = ?`).run(owner.userId);
    const stream = await app.inject({ method: 'GET', url: `/api/orgs/${owner.orgId}/events/stream?token=${encodeURIComponent(sseToken)}` });
    expect(stream.statusCode).toBe(401);
  });
});

describe('SO-04 — account lockout window', () => {
  it('locks the account after 5 failures and honors the configured window', async () => {
    const owner = await registerOwner();
    // Short window so the test can observe both states quickly.
    const lockMs = 1500;
    const original = process.env.LOGIN_LOCKOUT_MS;
    process.env.LOGIN_LOCKOUT_MS = String(lockMs);
    try {
      for (let i = 0; i < 5; i++) {
        const res = await app.inject({
          method: 'POST', url: '/api/auth/login',
          payload: { email: owner.email, password: 'wrong-password' },
          headers: { 'content-type': 'application/json' },
        });
        expect(res.statusCode).toBe(401);
      }
      // Sixth attempt — even with the CORRECT password — is locked.
      const locked = await app.inject({
        method: 'POST', url: '/api/auth/login',
        payload: { email: owner.email, password: 'testpass123' },
        headers: { 'content-type': 'application/json' },
      });
      expect(locked.statusCode).toBe(429);
      expect(locked.json().error).toBe('account-locked');

      // After the window, the correct password works and resets the counter.
      await new Promise((resolve) => setTimeout(resolve, lockMs + 300));
      const after = await app.inject({
        method: 'POST', url: '/api/auth/login',
        payload: { email: owner.email, password: 'testpass123' },
        headers: { 'content-type': 'application/json' },
      });
      expect(after.statusCode).toBe(200);
      const row = usersRepo.findByEmail(owner.email)!;
      expect(row.failed_login_count).toBe(0);
    } finally {
      if (original === undefined) delete process.env.LOGIN_LOCKOUT_MS;
      else process.env.LOGIN_LOCKOUT_MS = original;
    }
  });
});

describe('SO-02 — secrets-key guidance', () => {
  it('integration creation without WEDDING_SECRETS_KEY returns a friendly 400', async () => {
    const owner = await registerOwner();
    const originalKey = process.env.WEDDING_SECRETS_KEY;
    const originalNodeEnv = process.env.NODE_ENV;
    delete process.env.WEDDING_SECRETS_KEY;
    // The guard only fires outside test mode (tests auto-generate a key) —
    // simulate a production run to observe the friendly error.
    process.env.NODE_ENV = 'production';
    try {
      const res = await app.inject({
        method: 'POST', url: `/api/orgs/${owner.orgId}/integrations`,
        payload: {
          provider: 'email_smtp',
          config: { host: 'smtp.test', port: 587, fromAddress: 'v@test.com' },
          secrets: { username: 'u', password: 'p' },
        },
        headers: { authorization: `Bearer ${owner.token}`, 'content-type': 'application/json' },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json().error).toBe('secrets-key-not-configured');
    } finally {
      if (originalKey !== undefined) process.env.WEDDING_SECRETS_KEY = originalKey;
      if (originalNodeEnv !== undefined) process.env.NODE_ENV = originalNodeEnv;
    }
  });

  it('SO-05 — CSP allows the Google Fonts CDN for venue-custom fonts (no silent fallback)', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    const csp = res.headers['content-security-policy'] as string;
    expect(csp).toContain("style-src 'self' 'unsafe-inline' https://fonts.googleapis.com");
    expect(csp).toContain("font-src 'self' data: https://fonts.gstatic.com");
    // The rest of the policy stays tight.
    expect(csp).toContain("script-src 'self'");
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("object-src 'none'");
  });
});
