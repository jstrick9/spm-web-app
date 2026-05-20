/**
 * Wedding venue POC — Fastify server entry.
 *
 * Single binary that serves:
 *   - /api/*  → JSON API
 *   - /*      → static front-end (the React bundle, built by client/)
 *
 * Run: npm run dev   (or `npm start` after `npm run build`)
 */
import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import fastifyStatic from '@fastify/static';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { authRoutes } from './routes/auth.js';
import { eventRoutes } from './routes/events.js';
import { guestRoutes } from './routes/guests.js';
import { db } from './db/database.js';

const PORT = Number(process.env.PORT ?? 3000);
const HOST = process.env.HOST ?? '0.0.0.0';
const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-secret-change-me-in-production';
const CLIENT_DIST = resolve(import.meta.dirname, '../../client/dist');

if (JWT_SECRET === 'dev-secret-change-me-in-production' && process.env.NODE_ENV === 'production') {
  console.error('[FATAL] JWT_SECRET must be set in production');
  process.exit(1);
}

// Ensure the schema exists (handy for first-run / docker).
db.exec(`
  CREATE TABLE IF NOT EXISTS schema_version (
    version INTEGER PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);
const schemaVersion = db
  .prepare('SELECT MAX(version) AS v FROM schema_version')
  .get() as { v: number | null };
if (!schemaVersion.v) {
  console.warn('[server] schema not initialized — run `npm run migrate` first');
}

// Simple JSON logger — works in dev and prod alike. (pino-pretty has a
// well-known module-resolution conflict with tsx watch mode, so we keep
// the logger config dependency-free.)
const app = Fastify({
  logger: { level: process.env.LOG_LEVEL ?? 'info' },
  trustProxy: true, // we sit behind Caddy
});

await app.register(cors, {
  origin: process.env.CORS_ORIGIN ?? true, // dev: allow all
  credentials: true,
});

await app.register(jwt, {
  secret: JWT_SECRET,
  sign: { expiresIn: '12h' },
});

// ─── Health check (uptime probes, monitoring) ────────────────
app.get('/api/health', async () => ({
  ok: true,
  ts: new Date().toISOString(),
  schemaVersion: schemaVersion.v,
}));

// ─── Mount routes ────────────────────────────────────────────
await app.register(authRoutes);
await app.register(eventRoutes);
await app.register(guestRoutes);

// ─── Serve front-end (production) ────────────────────────────
if (existsSync(CLIENT_DIST)) {
  await app.register(fastifyStatic, {
    root: CLIENT_DIST,
    prefix: '/',
  });

  // SPA fallback: any unmatched non-API GET serves index.html
  app.setNotFoundHandler((req, reply) => {
    if (req.url.startsWith('/api/')) {
      return reply.code(404).send({ error: 'not-found' });
    }
    return reply.sendFile('index.html');
  });
} else {
  app.log.warn(
    `Client dist not found at ${CLIENT_DIST}. ` +
      `Build the client first: cd client && npm run build`
  );
}

try {
  await app.listen({ port: PORT, host: HOST });
  app.log.info(`🎉 Wedding POC server listening on http://${HOST}:${PORT}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
