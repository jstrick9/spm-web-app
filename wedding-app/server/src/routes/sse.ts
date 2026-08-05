import type { FastifyInstance } from 'fastify';
import { broadcastWebhook } from "../webhooks/dispatcher.js";
import { requireAuth } from '../middleware/auth.js';
import { can } from '../lib/rbac.js';
import { db } from '../db/database.js';
import { sseEventsRepo } from '../db/repos/index.js';
import { Forbidden } from '../lib/errors.js';

/**
 * Server-Sent Events endpoint for real-time updates.
 *
 * Usage:
 *   const es = new EventSource('/api/orgs/:orgId/events/stream?token=JWT&lastId=0');
 *   es.addEventListener('message', (e) => { ... });
 *
 * The server polls the sse_events table every 2 seconds and sends
 * any new events since `lastId`. This avoids WebSocket complexity
 * while giving near-real-time (2s latency) updates with automatic
 * reconnection built into the EventSource API.
 */

// In-memory subscriber registry for push-based delivery within a single process
type SSEClient = {
  orgId: string;
  userId: string;
  send: (data: string) => void;
  close: () => void;
};

const clients: Set<SSEClient> = new Set();
const MAX_SSE_CLIENTS = 1000;

/**
 * Broadcast an event to all connected SSE clients for a given org.
 * Called by route handlers after mutations (guest created, RSVP submitted, etc.)
 */
export function broadcastSSE(orgId: string, eventType: string, payload: Record<string, unknown> = {}, actorUserId?: string) {
  // Persist to DB for catch-up on reconnect
  const row = sseEventsRepo.publish({
    organizationId: orgId,
    eventType,
    payload,
    actorUserId,
  });

  // Push to connected clients
  const message = JSON.stringify({
    id: row.id,
    type: eventType,
    payload,
    actorUserId: actorUserId ?? null,
    timestamp: row.created_at,
  });

  for (const client of clients) {
    if (client.orgId === orgId && (!Array.isArray((payload as any).recipientUserIds) || (payload as any).recipientUserIds.includes(client.userId))) {
      try {
        client.send(`data: ${message}\n\n`);
      } catch {
        clients.delete(client);
      }
    }
  }

  // Also fire outbound webhooks asynchronously
  broadcastWebhook(orgId, eventType, payload);
}

export async function sseRoutes(app: FastifyInstance) {
  // ─── SSE stream for real-time org updates ──────────────
  // ─── Short-lived SSE token (5 min) to avoid exposing the main JWT in URLs ──
  app.get("/api/orgs/:orgId/sse-token", { preHandler: (await import("../middleware/auth.js")).requireAuth }, async (req) => {
    const { orgId } = req.params as { orgId: string };
    if (!can(req.auth!.memberships, { organizationId: orgId }, "org.view")) throw Forbidden();
    const token = app.jwt.sign(
      { sub: req.auth!.userId, email: req.auth!.email, memberships: req.auth!.memberships, sseOnly: true, sv: req.auth!.sessionVersion },
      { expiresIn: "5m" }
    );
    return { token, expiresIn: 300 };
  });

  app.get('/api/orgs/:orgId/events/stream', async (req, reply) => {
    const { orgId } = req.params as { orgId: string };
    const query = req.query as { token?: string; lastId?: string };

    // SSE can't send custom headers, so we accept the JWT as a query param
    if (!query.token) {
      return reply.code(401).send({ error: 'Token required' });
    }

    // Verify the JWT — SO-03: ONLY the short-lived sseOnly token (5 min,
    // issued by /sse-token) may be used in a URL; the main long-lived JWT
    // must not appear in query strings / access logs.
    let decoded: { sub: string; email?: string; memberships?: any[]; sseOnly?: boolean; sv?: number };
    try {
      decoded = app.jwt.verify(query.token) as any;
    } catch {
      return reply.code(401).send({ error: 'Invalid token' });
    }
    if (decoded.sseOnly !== true) {
      return reply.code(401).send({ error: 'Use a short-lived SSE token' });
    }

    // Re-validate the user row: a disabled/suspended user's token (issued up
    // to 5 min ago) must not keep streaming.
    const userRow = db.prepare(`SELECT id, session_version, status FROM users WHERE id = ?`)
      .get(decoded.sub) as { id: string; session_version: number; status: string } | undefined;
    if (!userRow || userRow.status !== 'active') {
      return reply.code(401).send({ error: 'user-disabled' });
    }
    if (userRow.session_version !== (decoded as any).sv) {
      return reply.code(401).send({ error: 'session-invalidated' });
    }

    // RBAC check
    if (!can(decoded.memberships ?? [], { organizationId: orgId }, 'org.view')) {
      return reply.code(403).send({ error: 'Forbidden' });
    }

    // Take over the underlying socket. In Fastify 5, a handler that writes
    // directly to `reply.raw` MUST call reply.hijack() so Fastify does not try
    // to send its own response (which would warn and could close the stream).
    reply.hijack();

    // Set SSE headers
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    });

    // Immediate keep-alive: EventSource clients (and intermediate proxies)
    // see the connection as open instantly instead of waiting up to the
    // 30s heartbeat for the first byte.
    reply.raw.write(': connected\n\n');

    // Send initial catch-up events
    const lastId = Number(query.lastId ?? 0);
    const catchUp = sseEventsRepo.listAfter(orgId, lastId);
    for (const evt of catchUp) {
      const msg = JSON.stringify({
        id: evt.id,
        type: evt.event_type,
        payload: typeof evt.payload === 'string' ? JSON.parse(evt.payload) : evt.payload,
        actorUserId: evt.actor_user_id,
        timestamp: evt.created_at,
      });
      reply.raw.write(`data: ${msg}\n\n`);
    }

    // Register this client for live updates
    const client: SSEClient = {
      orgId,
      userId: decoded.sub,
      send: (data: string) => {
        try { reply.raw.write(data); } catch { /* disconnected */ }
      },
      close: () => {
        clients.delete(client);
      },
    };
    // Evict oldest client if at capacity
    if (clients.size >= MAX_SSE_CLIENTS) {
      const oldest = clients.values().next().value;
      if (oldest) { try { oldest.close(); } catch {} clients.delete(oldest); }
    }
    clients.add(client);

    // Heartbeat every 30s to keep connection alive
    const heartbeat = setInterval(() => {
      try {
        reply.raw.write(': heartbeat\n\n');
      } catch {
        clearInterval(heartbeat);
        clients.delete(client);
      }
    }, 30_000);

    // Clean up on disconnect
    req.raw.on('close', () => {
      clearInterval(heartbeat);
      clients.delete(client);
    });

    // Don't close the reply — SSE connections stay open
  });

  // ─── Manual event publishing (admin/debug) ─────────────
  app.post('/api/orgs/:orgId/events/broadcast', { preHandler: requireAuth }, async (req) => {
    const { orgId } = req.params as { orgId: string };
    if (!can(req.auth!.memberships, { organizationId: orgId }, 'org.settings.manage')) {
      throw Forbidden();
    }
    const { eventType, payload } = req.body as { eventType: string; payload?: Record<string, unknown> };
    broadcastSSE(orgId, eventType, payload ?? {}, req.auth!.userId);
    return { ok: true };
  });
}
