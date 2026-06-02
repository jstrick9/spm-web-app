/**
 * Outbound webhook dispatcher.
 *
 * Called by route handlers (via broadcastWebhook) after mutations.
 * Finds matching active webhooks for the org, and fires HTTP POSTs
 * with HMAC-SHA256 signatures asynchronously (non-blocking).
 *
 * Delivery attempts are logged in webhook_deliveries for the admin UI.
 * Failures are tolerated — the app never waits on webhook delivery.
 */
import { createHmac } from 'node:crypto';
import { webhooksRepo } from '../db/repos/webhooks.js';

/**
 * Record a delivery attempt, swallowing any error. Webhook delivery runs
 * fire-and-forget via setImmediate, so it can complete AFTER the request that
 * triggered it — e.g. during graceful shutdown or (in tests) after the SQLite
 * connection is closed. A throw here would surface as an unhandled promise
 * rejection and, under Node's default policy, can crash the process. Logging a
 * delivery must never be able to take the server down.
 */
function safeRecordDelivery(args: Parameters<typeof webhooksRepo.recordDelivery>[0]): void {
  try {
    webhooksRepo.recordDelivery(args);
  } catch {
    /* DB unavailable (shutdown / closed connection) — drop the delivery log. */
  }
}

// Concurrency limiter — max 5 simultaneous webhook deliveries
const MAX_CONCURRENT = 5;
let activeDeliveries = 0;
const pendingQueue: Array<() => Promise<void>> = [];

function runNext() {
  if (pendingQueue.length === 0 || activeDeliveries >= MAX_CONCURRENT) return;
  activeDeliveries++;
  const task = pendingQueue.shift()!;
  task().finally(() => { activeDeliveries--; runNext(); });
}

function enqueueDelivery(fn: () => Promise<void>) {
  pendingQueue.push(fn);
  runNext();
}

interface WebhookPayload {
  eventType: string;
  timestamp: string;
  data: Record<string, unknown>;
}

/**
 * Fire webhooks for an event type. Call-and-forget — errors are logged
 * but never propagated to the caller.
 */
export function broadcastWebhook(
  orgId: string,
  eventType: string,
  data: Record<string, unknown> = {}
): void {
  // Run asynchronously so we never block the HTTP response
  setImmediate(async () => {
    try {
      const hooks = webhooksRepo.matchingHooks(orgId, eventType);
      if (hooks.length === 0) return;

      const payload: WebhookPayload = {
        eventType,
        timestamp: new Date().toISOString(),
        data,
      };
      const body = JSON.stringify(payload);

      for (const hook of hooks) {
        enqueueDelivery(() => deliverWebhook(hook.id, hook.url, hook.secret, eventType, body, data));
      }
    } catch {
      // Never crash the server for a webhook failure
    }
  });
}

async function deliverWebhook(
  webhookId: string,
  url: string,
  secret: string,
  eventType: string,
  body: string,
  data: Record<string, unknown>,
): Promise<void> {
  const startMs = Date.now();
  const signature = secret
    ? createHmac('sha256', secret).update(body).digest('hex')
    : '';

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000); // 10s timeout

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': signature ? `sha256=${signature}` : '',
        'X-Webhook-Event': eventType,
        'User-Agent': 'WeddingVenueIntelligence/1.0',
      },
      body,
      signal: controller.signal,
    });

    clearTimeout(timeout);
    const durationMs = Date.now() - startMs;
    const responseText = await res.text().catch(() => '');

    safeRecordDelivery({
      webhookId,
      eventType,
      payload: data,
      status: res.status,
      response: responseText,
      durationMs,
    });
  } catch (err) {
    const durationMs = Date.now() - startMs;
    safeRecordDelivery({
      webhookId,
      eventType,
      payload: data,
      status: null,
      error: (err as Error).message,
      durationMs,
    });
  }
}
