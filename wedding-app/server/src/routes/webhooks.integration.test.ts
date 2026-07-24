import './../test/setup.js';
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { db } from '../db/database.js';
import { buildApp } from '../index.js';
import type { FastifyInstance } from 'fastify';
import { rolesRepo, webhooksRepo } from '../db/repos/index.js';

let app: FastifyInstance;
beforeAll(async () => { app = await buildApp(); await app.ready(); });

beforeEach(() => {
  for (const t of [
    'webhook_deliveries', 'webhooks',
    'push_subscriptions', 'sse_events',
    'audit_logs','direct_messages','event_answers','event_questions',
    'staff_shifts','staff_areas','staff_tasks','timeline_events',
    'vendor_payments','vendors','decor_packages','decor_arrangements',
    'decor_categories','decor_items','guest_portal_configs','rsvp_submissions',
    'guest_sub_event_invitations','guests','layout_versions','layouts',
    'catalog_items','venues','sub_events','event_memberships','events',
    'organization_memberships','organizations','users',
  ]) {
    try { db.prepare(`DELETE FROM ${t}`).run(); } catch { /* ok */ }
  }
  try {
    db.prepare(`DELETE FROM role_permissions WHERE role_id IN (SELECT id FROM roles WHERE is_system = 0)`).run();
    db.prepare(`DELETE FROM roles WHERE is_system = 0`).run();
  } catch { /* ok */ }
  rolesRepo.ensureSystemRoles();
});

async function registerOwner() {
  const r = await app.inject({
    method: 'POST', url: '/api/auth/register',
    payload: { email: `wh-${Math.random().toString(36).slice(2)}@x.com`, password: 'testpass123', fullName: 'Owner', orgName: 'TestOrg' },
    headers: { 'content-type': 'application/json' },
  });
  return { token: r.json().token, orgId: r.json().organizationId };
}

const req = (token: string, method: 'GET'|'POST'|'PATCH'|'DELETE', url: string, payload?: unknown) =>
  app.inject({
    method, url,
    headers: payload !== undefined
      ? { authorization: `Bearer ${token}`, 'content-type': 'application/json' }
      : { authorization: `Bearer ${token}` },
    payload: payload as never,
  });

describe('Webhook CRUD', () => {
  it('POST creates a webhook', async () => {
    const o = await registerOwner();
    const res = await req(o.token, 'POST', `/api/orgs/${o.orgId}/webhooks`, {
      url: 'https://example.com/webhook',
      description: 'Test hook',
      eventTypes: ['event.created', 'rsvp.submitted'],
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().webhook).toHaveProperty('id');
    expect(res.json().webhook.url).toBe('https://example.com/webhook');
    expect(res.json().webhook.is_active).toBe(1);
  });

  it('GET lists webhooks for org', async () => {
    const o = await registerOwner();
    await req(o.token, 'POST', `/api/orgs/${o.orgId}/webhooks`, { url: 'https://a.com/1' });
    await req(o.token, 'POST', `/api/orgs/${o.orgId}/webhooks`, { url: 'https://b.com/2' });
    const res = await req(o.token, 'GET', `/api/orgs/${o.orgId}/webhooks`);
    expect(res.statusCode).toBe(200);
    expect(res.json().webhooks).toHaveLength(2);
  });

  it('GET webhook health returns organization-scoped retry telemetry', async () => {
    const o = await registerOwner();
    const created = await req(o.token, 'POST', `/api/orgs/${o.orgId}/webhooks`, { url: 'https://health.example/hook' });
    db.prepare(`INSERT INTO webhook_deliveries (id, webhook_id, event_type, payload, status, duration_ms, attempt_count, next_retry_at, terminal_at) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`)
      .run('health-delivery', created.json().webhook.id, 'event.created', '{}', 500, 120, 3);
    const health = await req(o.token, 'GET', `/api/orgs/${o.orgId}/webhooks/health`);
    expect(health.statusCode).toBe(200);
    expect(health.json().health).toMatchObject({ total: 1, terminal_failures: 1, avg_duration_ms: 120 });
  });

  it('PATCH updates webhook url and active state', async () => {
    const o = await registerOwner();
    const createRes = await req(o.token, 'POST', `/api/orgs/${o.orgId}/webhooks`, { url: 'https://old.com/hook' });
    const id = createRes.json().webhook.id;

    const patchRes = await req(o.token, 'PATCH', `/api/webhooks/${id}`, {
      url: 'https://new.com/hook',
      isActive: false,
    });
    expect(patchRes.statusCode).toBe(200);
    expect(patchRes.json().webhook.url).toBe('https://new.com/hook');
    expect(patchRes.json().webhook.is_active).toBe(0);
  });

  it('DELETE removes webhook', async () => {
    const o = await registerOwner();
    const createRes = await req(o.token, 'POST', `/api/orgs/${o.orgId}/webhooks`, { url: 'https://del.com/hook' });
    const id = createRes.json().webhook.id;

    const delRes = await req(o.token, 'DELETE', `/api/webhooks/${id}`);
    expect(delRes.statusCode).toBe(204);

    const listRes = await req(o.token, 'GET', `/api/orgs/${o.orgId}/webhooks`);
    expect(listRes.json().webhooks).toHaveLength(0);
  });

  it('rejects invalid or local webhook URLs', async () => {
    const o = await registerOwner();
    const invalid = await req(o.token, 'POST', `/api/orgs/${o.orgId}/webhooks`, { url: 'not-a-url' });
    expect(invalid.statusCode).toBe(400);
    const local = await req(o.token, 'POST', `/api/orgs/${o.orgId}/webhooks`, { url: 'http://127.0.0.1:3000/admin' });
    expect(local.statusCode).toBe(400);
  });

  it('requires integrations.manage permission', async () => {
    const res = await app.inject({
      method: 'GET', url: '/api/orgs/fake-org/webhooks',
    });
    expect(res.statusCode).toBe(401);
  });

  it('GET deliveries returns empty initially', async () => {
    const o = await registerOwner();
    const createRes = await req(o.token, 'POST', `/api/orgs/${o.orgId}/webhooks`, { url: 'https://test.com/hook' });
    const id = createRes.json().webhook.id;

    const delRes = await req(o.token, 'GET', `/api/webhooks/${id}/deliveries`);
    expect(delRes.statusCode).toBe(200);
    expect(delRes.json().deliveries).toHaveLength(0);
  });

  it('requeues terminal deliveries only for an authorized organization manager', async () => {
    const o = await registerOwner();
    const createRes = await req(o.token, 'POST', `/api/orgs/${o.orgId}/webhooks`, { url: 'https://example.com/hook' });
    const webhookId = createRes.json().webhook.id;
    const deliveryId = 'terminal-delivery-test';
    db.prepare(`INSERT INTO webhook_deliveries (id, webhook_id, event_type, payload, status, attempt_count, terminal_at) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`)
      .run(deliveryId, webhookId, 'event.created', '{}', 500, 3);

    const outsider = await registerOwner();
    const denied = await req(outsider.token, 'POST', `/api/webhooks/${webhookId}/deliveries/${deliveryId}/replay`);
    expect(denied.statusCode).toBe(403);

    const replay = await req(o.token, 'POST', `/api/webhooks/${webhookId}/deliveries/${deliveryId}/replay`);
    expect(replay.statusCode).toBe(202);
    expect(db.prepare(`SELECT next_retry_at, terminal_at FROM webhook_deliveries WHERE id = ?`).get(deliveryId)).toMatchObject({ next_retry_at: expect.any(String), terminal_at: null });
    const claimed = webhooksRepo.claimDueRetries();
    expect(claimed.map((delivery) => delivery.id)).toContain(deliveryId);
    expect(webhooksRepo.claimDueRetries().map((delivery) => delivery.id)).not.toContain(deliveryId);
  });

  it('POST test dispatches a test webhook', async () => {
    const o = await registerOwner();
    const createRes = await req(o.token, 'POST', `/api/orgs/${o.orgId}/webhooks`, { url: 'https://httpbin.org/post' });
    const id = createRes.json().webhook.id;

    const testRes = await req(o.token, 'POST', `/api/webhooks/${id}/test`);
    expect(testRes.statusCode).toBe(200);
    expect(testRes.json().ok).toBe(true);
  });
});
