import './../test/setup.js';
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { db } from '../db/database.js';
import { buildApp } from '../index.js';
import type { FastifyInstance } from 'fastify';
import { rolesRepo } from '../db/repos/index.js';
import { createHmac } from 'node:crypto';

let app: FastifyInstance;
beforeAll(async () => { app = await buildApp(); await app.ready(); });

beforeEach(() => {
  for (const t of [
    'invite_tracking','vendor_checkins','gallery_images','inventory_items','contracts',
    'budget_items','webhook_deliveries','webhooks','push_subscriptions','sse_events',
    'audit_logs','direct_messages','event_answers','event_questions',
    'staff_shifts','staff_areas','staff_tasks','timeline_events',
    'vendor_payments','vendors','decor_packages','decor_arrangements',
    'decor_categories','decor_items','guest_portal_configs','rsvp_submissions',
    'guest_sub_event_invitations','guests','layout_versions','layouts',
    'catalog_items','venues','sub_events','event_memberships','events',
    'organization_memberships','organizations','users',
  ]) { try { db.prepare(`DELETE FROM ${t}`).run(); } catch {} }
  try { db.prepare(`DELETE FROM role_permissions WHERE role_id IN (SELECT id FROM roles WHERE is_system = 0)`).run(); db.prepare(`DELETE FROM roles WHERE is_system = 0`).run(); } catch {}
  rolesRepo.ensureSystemRoles();
});

async function setupWithWebhook(secret = '') {
  const r = await app.inject({ method: 'POST', url: '/api/auth/register',
    payload: { email: `wr-${Math.random().toString(36).slice(2)}@x.com`, password: 'testpass123', fullName: 'O', orgName: 'O' },
    headers: { 'content-type': 'application/json' } });
  const token = r.json().token, orgId = r.json().organizationId;

  const wr = await app.inject({ method: 'POST', url: `/api/orgs/${orgId}/webhooks`,
    payload: { url: 'https://example.com/hook', secret, description: 'Test inbound' },
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' } });
  return { token, orgId, webhookId: wr.json().webhook.id };
}

describe('Inbound webhook receiver', () => {
  it('accepts a payload and returns 200', async () => {
    const s = await setupWithWebhook();
    const res = await app.inject({
      method: 'POST', url: `/api/webhooks/inbound/${s.webhookId}`,
      payload: { type: 'booking.created', data: { name: 'Test Booking' } },
      headers: { 'content-type': 'application/json' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().received).toBe(true);
  });

  it('returns 404 for unknown webhook ID', async () => {
    const res = await app.inject({
      method: 'POST', url: '/api/webhooks/inbound/nonexistent',
      payload: { test: true },
      headers: { 'content-type': 'application/json' },
    });
    expect(res.statusCode).toBe(404);
  });

  it('verifies HMAC signature when secret is set', async () => {
    const secret = 'test-secret-key';
    const s = await setupWithWebhook(secret);
    const body = JSON.stringify({ type: 'test.event', data: {} });
    const signature = `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;

    // Valid signature
    const valid = await app.inject({
      method: 'POST', url: `/api/webhooks/inbound/${s.webhookId}`,
      payload: JSON.parse(body),
      headers: { 'content-type': 'application/json', 'x-webhook-signature': signature },
    });
    expect(valid.statusCode).toBe(200);

    // Invalid signature
    const invalid = await app.inject({
      method: 'POST', url: `/api/webhooks/inbound/${s.webhookId}`,
      payload: { type: 'test.event' },
      headers: { 'content-type': 'application/json', 'x-webhook-signature': 'sha256=wrong' },
    });
    expect(invalid.statusCode).toBe(401);
  });

  it('logs the inbound event to audit log', async () => {
    const s = await setupWithWebhook();
    await app.inject({
      method: 'POST', url: `/api/webhooks/inbound/${s.webhookId}`,
      payload: { type: 'calendly.event_created' },
      headers: { 'content-type': 'application/json' },
    });

    // Check audit log
    const audit = await app.inject({ method: 'GET', url: `/api/orgs/${s.orgId}/audit`,
      headers: { authorization: `Bearer ${s.token}` } });
    const actions = audit.json().logs.map((l: any) => l.action);
    expect(actions).toContain('webhook.inbound.calendly.event_created');
  });

  it('records delivery in webhook_deliveries', async () => {
    const s = await setupWithWebhook();
    await app.inject({
      method: 'POST', url: `/api/webhooks/inbound/${s.webhookId}`,
      payload: { type: 'stripe.payment' },
      headers: { 'content-type': 'application/json' },
    });

    const deliveries = await app.inject({ method: 'GET', url: `/api/webhooks/${s.webhookId}/deliveries`,
      headers: { authorization: `Bearer ${s.token}` } });
    expect(deliveries.json().deliveries.length).toBeGreaterThanOrEqual(1);
    expect(deliveries.json().deliveries[0].event_type).toContain('inbound');
  });
});
