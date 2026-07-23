/**
 * Wedding venue app — Fastify server entry.
 */
import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';

import { authRoutes }      from './routes/auth.js';
import { roleRoutes }      from './routes/roles.js';
import { eventRoutes }     from './routes/events.js';
import { venueRoutes }     from './routes/venues.js';
import { catalogRoutes }   from './routes/catalog.js';
import { layoutRoutes }    from './routes/layouts.js';
import { guestRoutes }     from './routes/guests.js';
import { decorRoutes }     from './routes/decor.js';
import { vendorRoutes }    from './routes/vendors.js';
import { timelineRoutes }  from './routes/timeline.js';
import { staffRoutes }     from './routes/staff.js';
import { questionRoutes }  from './routes/questions.js';
import { messageRoutes }   from './routes/messages.js';
import { auditRoutes }     from './routes/audit.js';
import { platformConfigRoutes } from './routes/platformConfig.js';
import { integrationRoutes }    from './routes/integrations.js';
import { startWorker }          from './jobs/worker.js';
import { pushRoutes }           from "./routes/push.js";
import { sseRoutes }            from "./routes/sse.js";
import { webhookRoutes }        from "./routes/webhooks.js";
import { budgetRoutes }         from "./routes/budget.js";
import { contractRoutes }       from "./routes/contracts.js";
import { inventoryRoutes }      from "./routes/inventory.js";
import { galleryRoutes }        from "./routes/gallery.js";
import { checkinRoutes }        from "./routes/checkins.js";
import { inviteTrackingRoutes } from "./routes/inviteTracking.js";
import { exportRoutes }          from "./routes/exports.js";
import { webhookReceiverRoutes } from "./routes/webhookReceiver.js";
import { intelligenceRoutes }   from "./routes/intelligence.js";
import { feedbackRoutes }       from "./routes/feedback.js";
import { lifecycleEmailRoutes } from "./routes/lifecycleEmails.js";
import { paymentRoutes }        from "./routes/payments.js";
import { coupleRoutes }         from "./routes/couple.js";

import { db } from './db/database.js';
import { rolesRepo } from './db/repos/index.js';
import { HttpError } from './lib/errors.js';

const PORT        = Number(process.env.PORT ?? 3000);
const HOST        = process.env.HOST ?? '0.0.0.0';
const JWT_SECRET  = process.env.JWT_SECRET ?? 'dev-secret-change-me-in-production';
const CLIENT_DIST = resolve(import.meta.dirname, '../../client/dist');

if (JWT_SECRET === 'dev-secret-change-me-in-production' && process.env.NODE_ENV === 'production') {
  console.error('[FATAL] JWT_SECRET must be set in production');
  process.exit(1);
}

// Ensure schema_version table exists (first-run friendliness).
db.exec(`CREATE TABLE IF NOT EXISTS schema_version (
  version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);`);

// Seed/refresh the system roles into the roles table on every boot.
// Idempotent: re-syncs permission grants if the code-side definitions
// changed (e.g. a deploy added a new permission to the 'admin' system role).
// Silently skipped if the roles table doesn't exist yet (fresh boot before
// migrate; test harness applies the schema in its own setup).
const rolesTableExists = (
  db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='roles'`)
    .get() as { name?: string } | undefined
)?.name === 'roles';
if (rolesTableExists) {
  rolesRepo.ensureSystemRoles();
}



export async function buildApp() {
  const app = Fastify({
    logger: { level: process.env.LOG_LEVEL ?? 'info' },
    trustProxy: true,
    disableRequestLogging: process.env.NODE_ENV === 'test',
    bodyLimit: 2 * 1024 * 1024, // 2MB default body limit
  });

  await app.register(cors, {
    origin: process.env.CORS_ORIGIN ?? false, // default restrictive; set CORS_ORIGIN env var in production
    credentials: true,
  });

  // Baseline security headers on every response (incl. static files + uploads).
  // Lightweight, dependency-free alternative to @fastify/helmet. CSP is
  // permissive enough for the Vite-built SPA (inline styles via Tailwind) but
  // blocks plugin/object embeds and frames. Tighten per deployment as needed.
  app.addHook('onSend', async (_req, reply, payload) => {
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('X-Frame-Options', 'DENY');
    reply.header('Referrer-Policy', 'strict-origin-when-cross-origin');
    reply.header('X-Permitted-Cross-Domain-Policies', 'none');
    reply.header(
      'Content-Security-Policy',
      [
        "default-src 'self'",
        "img-src 'self' data: blob:",
        "style-src 'self' 'unsafe-inline'",
        "script-src 'self'",
        "connect-src 'self'",
        "frame-ancestors 'none'",
        "object-src 'none'",
        "base-uri 'self'",
      ].join('; '),
    );
    if (process.env.NODE_ENV === 'production') {
      reply.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    return payload;
  });

  await app.register(jwt, {
    secret: JWT_SECRET,
    sign: { expiresIn: '12h' },
  });

  // Global rate limit (route-specific limits override). Public RSVP endpoint
  // gets its own stricter limit; everything else gets a generous baseline.
  await app.register(rateLimit, {
    max: 300,
    timeWindow: '1 minute',
    allowList: process.env.NODE_ENV === 'test' ? ['127.0.0.1', '::1'] : undefined,
  });

  // Global error handler. Recognizes:
  //   - HttpError instances (thrown via lib/errors.ts helpers)
  //   - Any Error decorated with { statusCode: number; code: string }
  //     (used by repo-level helpers like rolesRepo, rbac.assertCan)
  //   - Fastify/Zod validation errors
  // Anything else becomes 500.
  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof HttpError) {
      return reply.code(err.statusCode).send({
        error: err.code, message: err.message, details: err.details,
      });
    }
    const decorated = err as Error & { statusCode?: number; code?: string };
    if (typeof decorated.statusCode === 'number' && typeof decorated.code === 'string') {
      return reply.code(decorated.statusCode).send({
        error: decorated.code,
        message: decorated.message,
      });
    }
    if ((err as { validation?: unknown }).validation) {
      return reply.code(400).send({
        error: 'invalid-input',
        details: (err as { validation: unknown }).validation,
      });
    }
    app.log.error(err);
    return reply.code(500).send({ error: 'internal-error' });
  });

  // Health check
  app.get('/api/health', async () => ({
    ok: true,
    ts: new Date().toISOString(),
    schemaVersion: (db.prepare('SELECT MAX(version) AS v FROM schema_version').get() as { v: number }).v,
  }));

  // Mount domain routes
  await app.register(authRoutes);
  await app.register(roleRoutes);
  await app.register(eventRoutes);
  await app.register(venueRoutes);
  await app.register(catalogRoutes);
  await app.register(layoutRoutes);
  await app.register(guestRoutes);
  await app.register(decorRoutes);
  await app.register(vendorRoutes);
  await app.register(timelineRoutes);
  await app.register(staffRoutes);
  await app.register(questionRoutes);
  await app.register(messageRoutes);
  await app.register(auditRoutes);
  await app.register(platformConfigRoutes);
  await app.register(integrationRoutes);
  await app.register(pushRoutes);
  await app.register(sseRoutes);
  await app.register(webhookRoutes);
  await app.register(budgetRoutes);
  await app.register(contractRoutes);
  await app.register(inventoryRoutes);
  await app.register(galleryRoutes);
  await app.register(checkinRoutes);
  await app.register(inviteTrackingRoutes);
  await app.register(exportRoutes);
  await app.register(webhookReceiverRoutes);
  await app.register(intelligenceRoutes);
  await app.register(feedbackRoutes);
  await app.register(lifecycleEmailRoutes);
  await app.register(coupleRoutes);
  // Payment routes register their own raw-body parser for webhook signature
  // verification; encapsulated so it doesn't affect other routes' JSON parsing.
  await app.register(paymentRoutes);

  // Serve front-end if built
  if (existsSync(CLIENT_DIST)) {
    await app.register(fastifyStatic, { root: CLIENT_DIST, prefix: '/' });
    // Serve uploaded files (gallery images, etc.)
    const UPLOADS_DIR = process.env.WEDDING_UPLOADS_PATH
      ? resolve(process.env.WEDDING_UPLOADS_PATH)
      : resolve(import.meta.dirname, "../../uploads");
    if (existsSync(UPLOADS_DIR)) {
      await app.register(fastifyStatic, { root: UPLOADS_DIR, prefix: "/uploads/", decorateReply: false });
    }
    app.setNotFoundHandler((req, reply) => {
      if (req.url.startsWith('/api/')) return reply.code(404).send({ error: 'not-found' });
      return reply.sendFile('index.html');
    });
  }

  return app;
}

// Only listen when invoked directly (tests build the app without listening).
const invokedDirectly = process.argv[1]?.endsWith('index.ts')
                     || process.argv[1]?.endsWith('index.js');

if (invokedDirectly) {
  buildApp().then(async (app) => {
    try {
      await app.listen({ port: PORT, host: HOST });
      app.log.info(`Wedding app server listening on http://${HOST}:${PORT}`);
      // Start the in-process job worker for the integration framework.
      // (Test harness builds the app via buildApp() without listening, so
      // the worker isn't started in tests — they exercise jobs directly.)
      startWorker();
    } catch (err) {
      app.log.error(err);
      process.exit(1);
    }
  });
}
