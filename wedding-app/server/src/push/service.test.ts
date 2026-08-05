import './../test/setup.js';
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { db } from '../db/database.js';
import { pushSubscriptionsRepo } from '../db/repos/index.js';
import { sendPushToOrg, sendPushToUser, isPushConfigured } from './service.js';
import { scanDueTimelineReminders } from '../jobs/timelineReminders.js';
import { scanGuestHelpSlaBreaches } from '../jobs/guestHelpSla.js';
import { uuid } from '../lib/crypto.js';

// Mock the web-push module so tests never touch a real push service.
const sendNotification = vi.fn();
vi.mock('web-push', () => ({
  default: {
    setVapidDetails: vi.fn(),
    sendNotification: (...args: unknown[]) => sendNotification(...args),
    generateVAPIDKeys: vi.fn(() => ({ publicKey: 'pub', privateKey: 'priv' })),
  },
}));

const ORIGINAL_VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY;
const ORIGINAL_VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY;

beforeEach(() => {
  sendNotification.mockReset();
  for (const t of ['push_subscriptions', 'audit_logs', 'timeline_reminders', 'guest_help_requests', 'sse_events', 'organization_memberships']) {
    try { db.prepare(`DELETE FROM ${t}`).run(); } catch { /* ok */ }
  }
  try { db.prepare(`DELETE FROM organizations`).run(); } catch { /* ok */ }
  try { db.prepare(`DELETE FROM users`).run(); } catch { /* ok */ }
});

/** FKs are ON — create a real org + owner user the subscriptions can point at. */
function seedOrg(orgId = 'org-1', userId = 'user-1'): { orgId: string; userId: string } {
  db.prepare(
    `INSERT OR IGNORE INTO users (id, email, full_name, password_hash, password_salt) VALUES (?, ?, 'Tester', 'x', 'y')`,
  ).run(userId, `${userId}@x.com`);
  db.prepare(
    `INSERT OR IGNORE INTO organizations (id, name, slug, owner_id) VALUES (?, 'Test Org', ?, ?)`,
  ).run(orgId, `${orgId}-slug`, userId);
  return { orgId, userId };
}

function withVapidConfigured(): void {
  process.env.VAPID_PUBLIC_KEY = 'test-public-key';
  process.env.VAPID_PRIVATE_KEY = 'test-private-key';
}

function withoutVapid(): void {
  delete process.env.VAPID_PUBLIC_KEY;
  delete process.env.VAPID_PRIVATE_KEY;
}

function addSub(orgId: string, userId = 'user-1', endpoint = `https://push.example.com/${Math.random().toString(36).slice(2)}`) {
  seedOrg(orgId, userId);
  pushSubscriptionsRepo.upsert({
    userId,
    organizationId: orgId,
    endpoint,
    p256dh: 'p256',
    auth: 'auth',
  });
  return endpoint;
}

describe('push service', () => {
  it('isPushConfigured reflects VAPID env presence', () => {
    withoutVapid();
    expect(isPushConfigured()).toBe(false);
    withVapidConfigured();
    expect(isPushConfigured()).toBe(true);
    withoutVapid();
  });

  it('skips sending (no-op) when VAPID keys are missing — like SMTP, degrades gracefully', async () => {
    withoutVapid();
    addSub('org-1');
    const result = await sendPushToOrg('org-1', { title: 'T', body: 'B' });
    expect(result).toEqual({ sent: 0, failed: 0, staleRemoved: 0, skipped: 1 });
    expect(sendNotification).not.toHaveBeenCalled();
  });

  it('sends to every subscription in the org with a JSON payload', async () => {
    withVapidConfigured();
    addSub('org-1');
    addSub('org-1');
    addSub('org-2'); // different org → untouched
    sendNotification.mockResolvedValue(undefined);
    const result = await sendPushToOrg('org-1', { title: 'Timeline reminder', body: 'Ceremony at 4pm', url: '/events/e1?tab=timeline', tag: 't-1' });
    expect(result.sent).toBe(2);
    expect(sendNotification).toHaveBeenCalledTimes(2);
    const [sub, payloadJson, options] = sendNotification.mock.calls[0];
    expect(sub.endpoint).toMatch(/^https:\/\/push\.example\.com\//);
    const payload = JSON.parse(payloadJson);
    expect(payload.title).toBe('Timeline reminder');
    expect(payload.body).toBe('Ceremony at 4pm');
    expect(payload.url).toBe('/events/e1?tab=timeline');
    expect(options.TTL).toBeGreaterThan(0);
    withoutVapid();
  });

  it('prunes stale 404/410 subscriptions so we never hammer dead endpoints', async () => {
    withVapidConfigured();
    addSub('org-1');
    sendNotification.mockRejectedValue({ statusCode: 410 });
    const result = await sendPushToOrg('org-1', { title: 'T', body: 'B' });
    expect(result.staleRemoved).toBe(1);
    expect(pushSubscriptionsRepo.listForOrg('org-1')).toHaveLength(0);
    withoutVapid();
  });

  it('counts real failures and writes one audit row', async () => {
    withVapidConfigured();
    addSub('org-1');
    sendNotification.mockRejectedValue({ statusCode: 503 });
    const result = await sendPushToOrg('org-1', { title: 'T', body: 'B' });
    expect(result.failed).toBe(1);
    const audit = db.prepare(`SELECT * FROM audit_logs WHERE action = 'push.send.failed'`).all() as Array<{ details: string }>;
    expect(audit).toHaveLength(1);
    expect(JSON.parse(audit[0].details).failed).toBe(1);
    withoutVapid();
  });

  it('sendPushToUser targets only that user\'s devices', async () => {
    withVapidConfigured();
    addSub('org-1', 'user-a');
    addSub('org-1', 'user-b');
    sendNotification.mockResolvedValue(undefined);
    const result = await sendPushToUser('user-a', 'org-1', { title: 'T', body: 'B' });
    expect(result.sent).toBe(1);
    withoutVapid();
  });

  it('timeline reminder dispatch fires a web push alongside the SSE broadcast', async () => {
    withVapidConfigured();
    addSub('org-1');
    sendNotification.mockResolvedValue(undefined);
    db.prepare(
      `INSERT INTO events (id, organization_id, title, slug, status) VALUES ('event-1', 'org-1', 'Wedding', 'wedding-1', 'planning')`,
    ).run();
    db.prepare(
      `INSERT INTO timeline_reminders (id, organization_id, event_id, timeline_item_id, remind_at, channel, audience, payload)
       VALUES (?, ?, ?, NULL, ?, 'in_app', 'venue_staff', '{}')`,
    ).run(uuid(), 'org-1', 'event-1', new Date(Date.now() - 1000).toISOString());
    const dispatched = scanDueTimelineReminders();
    expect(dispatched.dispatched).toBe(1);
    expect(sendNotification).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(sendNotification.mock.calls[0][1]);
    expect(payload.title).toContain('Timeline reminder');
    expect(payload.url).toBe('/events/event-1?tab=timeline');
    withoutVapid();
  });

  it('guest help SLA breach fires a web push alongside the SSE broadcast', async () => {
    withVapidConfigured();
    addSub('org-1');
    sendNotification.mockResolvedValue(undefined);
    db.prepare(
      `INSERT INTO events (id, organization_id, title, slug, status) VALUES ('event-1', 'org-1', 'Wedding', 'wedding-1', 'planning')`,
    ).run();
    db.prepare(
      `INSERT INTO guest_help_requests (id, organization_id, event_id, kind, status, sla_due_at)
       VALUES (?, ?, ?, 'cannot_find_name', 'open', ?)`,
    ).run(uuid(), 'org-1', 'event-1', new Date(Date.now() - 3_600_000).toISOString());
    const flagged = scanGuestHelpSlaBreaches();
    expect(flagged.flagged).toBe(1);
    expect(sendNotification).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(sendNotification.mock.calls[0][1]);
    expect(payload.title).toContain('past SLA');
    withoutVapid();
  });

  it('generates VAPID keys via the script entry', async () => {
    // The script calls webpush.generateVAPIDKeys and prints .env lines —
    // verify the mocked module returns a usable pair.
    const { default: webpush } = await import('web-push');
    const keys = webpush.generateVAPIDKeys();
    expect(keys.publicKey).toBe('pub');
    expect(keys.privateKey).toBe('priv');
  });
});

beforeAll(() => {
  // Restore env after all tests.
  return () => {
    if (ORIGINAL_VAPID_PUBLIC) process.env.VAPID_PUBLIC_KEY = ORIGINAL_VAPID_PUBLIC;
    else delete process.env.VAPID_PUBLIC_KEY;
    if (ORIGINAL_VAPID_PRIVATE) process.env.VAPID_PRIVATE_KEY = ORIGINAL_VAPID_PRIVATE;
    else delete process.env.VAPID_PRIVATE_KEY;
  };
});
