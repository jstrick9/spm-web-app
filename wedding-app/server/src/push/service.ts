/**
 * Push notification delivery — web-push (RFC 8030) via the browser's
 * Push API + service worker.
 *
 * The client registers a subscription per device (routes/push.ts) and the
 * service worker renders `push` events. This module is the send-side:
 *
 *   - no-op (skipped) when VAPID keys are not configured, so deployments
 *     without `.env` VAPID_* values simply don't send — like SMTP, the
 *     rest of the platform keeps working.
 *   - prunes subscriptions that the push service reports gone
 *     (404 NotRegistered / 410 Gone) so we never hammer dead endpoints.
 *   - audits a `push.send.failed` row when deliveries fail (so ops can
 *     spot misconfigured VAPID keys), but does NOT audit every successful
 *     push (that would flood the audit log).
 *
 * Generate keys with:  npm run push:keys   (prints VAPID_PUBLIC_KEY /
 * VAPID_PRIVATE_KEY / VAPID_SUBJECT lines for .env)
 */
import webpush from 'web-push';
import { auditRepo, pushSubscriptionsRepo, type PushSubscriptionRow } from '../db/repos/index.js';

export interface PushPayload {
  title: string;
  body: string;
  /** Client-side deep link the service worker opens on click. */
  url?: string;
  /** Groups notifications so repeated reminders replace each other. */
  tag?: string;
}

export interface PushSendResult {
  sent: number;
  failed: number;
  /** Subscriptions the push service reported gone (404/410) — removed. */
  staleRemoved: number;
  /** 1 when VAPID is not configured and nothing was attempted. */
  skipped: number;
}

export function isPushConfigured(): boolean {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

function vapidDetails(): { subject: string; publicKey: string; privateKey: string } {
  return {
    subject: process.env.VAPID_SUBJECT ?? 'mailto:ops@weddingplatform.com',
    publicKey: process.env.VAPID_PUBLIC_KEY!,
    privateKey: process.env.VAPID_PRIVATE_KEY!,
  };
}

async function deliver(
  sub: PushSubscriptionRow,
  payload: PushPayload,
): Promise<'sent' | 'stale' | 'failed'> {
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      JSON.stringify(payload),
      { TTL: 60 * 60 * 24 }, // 24h TTL: offline devices still get it when they return
    );
    return 'sent';
  } catch (err) {
    const status = (err as { statusCode?: number })?.statusCode;
    if (status === 404 || status === 410) {
      // Endpoint is gone (browser unsubscribed or push service dropped it).
      pushSubscriptionsRepo.deleteById(sub.id);
      return 'stale';
    }
    return 'failed';
  }
}

async function dispatch(
  subs: PushSubscriptionRow[],
  orgId: string,
  payload: PushPayload,
  actorUserId: string | null,
): Promise<PushSendResult> {
  if (!isPushConfigured()) return { sent: 0, failed: 0, staleRemoved: 0, skipped: 1 };
  webpush.setVapidDetails(vapidDetails().subject, vapidDetails().publicKey, vapidDetails().privateKey);

  let sent = 0, failed = 0, staleRemoved = 0;
  for (const sub of subs) {
    const outcome = await deliver(sub, payload);
    if (outcome === 'sent') sent += 1;
    else if (outcome === 'stale') staleRemoved += 1;
    else failed += 1;
  }

  if (failed > 0) {
    try {
      auditRepo.log({
        organizationId: orgId,
        actorUserId: actorUserId ?? undefined,
        actorLabel: actorUserId ? undefined : 'system',
        action: 'push.send.failed',
        targetType: 'push',
        targetId: orgId,
        ip: undefined,
        details: { sent, failed, title: payload.title },
      });
    } catch { /* audit must never break delivery */ }
  }
  return { sent, failed, staleRemoved, skipped: 0 };
}

/** Send to every device subscribed in the org (used by jobs & broadcasts). */
export function sendPushToOrg(orgId: string, payload: PushPayload, opts: { actorUserId?: string | null } = {}): Promise<PushSendResult> {
  return dispatch(pushSubscriptionsRepo.listForOrg(orgId), orgId, payload, opts.actorUserId ?? null);
}

/** Send to every device of one user (used for personal notifications). */
export function sendPushToUser(userId: string, orgId: string, payload: PushPayload): Promise<PushSendResult> {
  return dispatch(pushSubscriptionsRepo.listForUser(userId), orgId, payload, userId);
}
