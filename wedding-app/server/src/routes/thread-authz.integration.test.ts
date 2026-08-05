/**
 * Couple-inbox thread authorization probe.
 *
 *   - vendor threads (`${eventId}:vendor-*`) are readable/writable by
 *     venue staff and shared with the vendor portal (same thread id)
 *   - couples are scoped to `couple-*` threads only — vendor/ops threads
 *     are off-limits (403), even though couples hold messages.view
 *   - the legacy staff `vendor:${eventId}:${vendorId}` shape resolves to
 *     the same event (no 404) and lands in the canonical thread
 *   - senderRole is server-derived: a client claiming 'manager' is labeled
 *     with the sender's actual role
 */
import '../test/setup.js';
import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../index.js';
import { db } from '../db/database.js';
import { eventsRepo } from '../db/repos/index.js';
import { SYSTEM_ROLE_IDS } from '../lib/permissions.js';

let app: FastifyInstance;
beforeAll(async () => { app = await buildApp(); await app.ready(); });
beforeEach(() => { db.exec('BEGIN'); });
afterEach(async () => { db.exec('ROLLBACK'); });

const req = (token: string, method: 'GET' | 'POST', url: string, payload?: unknown) =>
  app.inject({
    method, url,
    headers: payload !== undefined
      ? { authorization: `Bearer ${token}`, 'content-type': 'application/json' }
      : { authorization: `Bearer ${token}` },
    payload: payload as never,
  });

async function setup() {
  const reg = await app.inject({
    method: 'POST', url: '/api/auth/register',
    payload: { email: `th-${Math.random().toString(36).slice(2)}@x.com`, password: 'testpass123', fullName: 'Owner', orgName: 'Thread Venue' },
    headers: { 'content-type': 'application/json' },
  });
  const token = reg.json().token as string;
  const orgId = reg.json().organizationId as string;
  const ownerId = reg.json().user.id as string;

  const evt = await req(token, 'POST', '/api/events', { organizationId: orgId, title: 'Thread Wedding' });
  const eventId = evt.json().event.id as string;

  const vendor = await req(token, 'POST', `/api/orgs/${orgId}/vendors`, {
    name: 'Floral Co', category: 'Floral', eventId, email: 'floral@vendor.test', contactPreference: 'email',
  });
  const vendorId = vendor.json().vendor.id as string;

  // Couple member on the event.
  const cReg = await app.inject({
    method: 'POST', url: '/api/auth/register',
    payload: { email: `thc-${Math.random().toString(36).slice(2)}@x.com`, password: 'testpass123', fullName: 'Couple', orgName: 'Tmp' },
    headers: { 'content-type': 'application/json' },
  });
  const coupleId = cReg.json().user.id as string;
  const coupleToken = cReg.json().token as string;
  eventsRepo.addMember({ eventId, userId: coupleId, roleId: SYSTEM_ROLE_IDS.couple });

  return { token, orgId, ownerId, eventId, vendorId, coupleToken };
}

describe('couple-inbox thread authorization', () => {
  it('couple cannot read or write vendor/ops threads (403), only couple-* threads', async () => {
    const s = await setup();
    // Seed a vendor thread message from staff first.
    const canonical = `${s.eventId}:vendor-${s.vendorId}`;
    const staffMsg = await req(s.token, 'POST', `/api/messages/${encodeURIComponent(canonical)}`, { body: 'Load-in 10:00 at dock B', senderRole: 'manager' });
    expect(staffMsg.statusCode).toBe(201);

    // Couple read of the vendor thread → 403 (couple-thread-scope).
    const coupleRead = await req(s.coupleToken, 'GET', `/api/messages/${encodeURIComponent(canonical)}`);
    expect(coupleRead.statusCode).toBe(403);
    expect(coupleRead.json().error).toBe('couple-thread-scope');

    // Couple write to the vendor thread → 403.
    const coupleWrite = await req(s.coupleToken, 'POST', `/api/messages/${encodeURIComponent(canonical)}`, { body: 'Can you share pricing?', senderRole: 'manager' });
    expect(coupleWrite.statusCode).toBe(403);

    // Couple read/write of their own couple thread → allowed.
    const coupleThread = `${s.eventId}:couple-venue`;
    const coupleReadOwn = await req(s.coupleToken, 'GET', `/api/messages/${encodeURIComponent(coupleThread)}`);
    expect(coupleReadOwn.statusCode).toBe(200);
    const coupleWriteOwn = await req(s.coupleToken, 'POST', `/api/messages/${encodeURIComponent(coupleThread)}`, { body: 'Hi venue!', senderRole: 'couple' });
    expect(coupleWriteOwn.statusCode).toBe(201);
  });

  it('staff vendor chat uses the canonical thread shared with the vendor portal', async () => {
    const s = await setup();
    const canonical = `${s.eventId}:vendor-${s.vendorId}`;

    // Legacy staff shape resolves to the same event (no 404).
    const legacy = `vendor:${s.eventId}:${s.vendorId}`;
    const legacyGet = await req(s.token, 'GET', `/api/messages/${encodeURIComponent(legacy)}`);
    expect(legacyGet.statusCode).toBe(200);

    // Staff posts via the canonical shape; vendor portal sees the message.
    const staffPost = await req(s.token, 'POST', `/api/messages/${encodeURIComponent(canonical)}`, { body: 'Please send final invoice', senderRole: 'manager' });
    expect(staffPost.statusCode).toBe(201);

    const tok = await req(s.token, 'POST', `/api/vendors/${s.vendorId}/portal-token`, { expiresInDays: 30 });
    const vToken = tok.json().token as string;
    const portalFeed = await app.inject({ method: 'GET', url: `/api/portal/vendors/${s.vendorId}/messages?token=${encodeURIComponent(vToken)}` });
    expect(portalFeed.statusCode).toBe(200);
    expect(portalFeed.json().messages.some((m: any) => m.body === 'Please send final invoice')).toBe(true);

    // Vendor replies; staff sees it in the same thread.
    await app.inject({
      method: 'POST', url: `/api/portal/vendors/${s.vendorId}/messages`,
      payload: { token: vToken, body: 'Invoice attached' },
      headers: { 'content-type': 'application/json' },
    });
    const staffFeed = await req(s.token, 'GET', `/api/messages/${encodeURIComponent(canonical)}`);
    expect(staffFeed.json().messages.some((m: any) => m.body === 'Invoice attached')).toBe(true);
    expect(staffFeed.json().messages.find((m: any) => m.body === 'Invoice attached').sender_role).toBe('vendor');
  });

  it('senderRole is server-derived — a client cannot impersonate manager/venue', async () => {
    const s = await setup();
    const canonical = `${s.eventId}:vendor-${s.vendorId}`;
    const post = await req(s.token, 'POST', `/api/messages/${encodeURIComponent(canonical)}`, { body: 'Claiming manager', senderRole: 'owner' });
    expect(post.statusCode).toBe(201);
    // The owner's actual role is 'owner', NOT the spoofed 'owner'... verify
    // the stored role matches the real membership (owner here — the spoof
    // value happens to be the same, so use a distinct spoof).
    const feed = await req(s.token, 'GET', `/api/messages/${encodeURIComponent(canonical)}`);
    const msg = feed.json().messages.find((m: any) => m.body === 'Claiming manager');
    expect(msg.sender_role).toBe('owner');

    // Spoof attempt with a role the user does NOT hold is ignored.
    const post2 = await req(s.token, 'POST', `/api/messages/${encodeURIComponent(canonical)}`, { body: 'I am the vendor', senderRole: 'vendor' });
    expect(post2.statusCode).toBe(201);
    const feed2 = await req(s.token, 'GET', `/api/messages/${encodeURIComponent(canonical)}`);
    const msg2 = feed2.json().messages.find((m: any) => m.body === 'I am the vendor');
    expect(msg2.sender_role).toBe('owner'); // derived, not 'vendor'
  });
});
