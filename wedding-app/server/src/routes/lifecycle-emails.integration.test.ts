import './../test/setup.js';
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { db } from '../db/database.js';
import { buildApp } from '../index.js';
import type { FastifyInstance } from 'fastify';
import {
  rolesRepo, integrationsRepo, guestsRepo, emailTemplatesRepo,
  scheduledEmailsRepo, jobsRepo,
} from '../db/repos/index.js';
import { sealSecret } from '../lib/secrets.js';

let app: FastifyInstance;
beforeAll(async () => { app = await buildApp(); await app.ready(); });

beforeEach(() => {
  for (const t of [
    'scheduled_emails', 'email_automations', 'email_templates',
    'job_queue', 'integrations', 'integration_events',
    'vendor_ratings', 'payment_links', 'budget_items',
    'webhook_deliveries', 'webhooks', 'push_subscriptions', 'sse_events',
    'audit_logs', 'direct_messages', 'event_answers', 'event_questions',
    'staff_shifts', 'staff_areas', 'staff_tasks', 'timeline_events',
    'vendor_payments', 'vendors', 'decor_packages', 'decor_arrangements',
    'decor_categories', 'decor_items', 'guest_portal_configs', 'rsvp_submissions',
    'guest_sub_event_invitations', 'guests', 'layout_versions', 'layouts',
    'catalog_items', 'venues', 'sub_events', 'event_memberships', 'events',
    'organization_memberships', 'organizations', 'users',
  ]) {
    try { db.prepare(`DELETE FROM ${t}`).run(); } catch { /* table may not exist */ }
  }
  try {
    db.prepare(`DELETE FROM role_permissions WHERE role_id IN (SELECT id FROM roles WHERE is_system = 0)`).run();
    db.prepare(`DELETE FROM roles WHERE is_system = 0`).run();
  } catch { /* ok */ }
  rolesRepo.ensureSystemRoles();
});

const req = (token: string, method: 'GET' | 'POST' | 'PUT' | 'DELETE', url: string, payload?: unknown) =>
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
    payload: { email: `lc-${Math.random().toString(36).slice(2)}@x.com`, password: 'testpass123', fullName: 'Owner', orgName: 'LifecycleOrg' },
    headers: { 'content-type': 'application/json' },
  });
  const token = reg.json().token as string;
  const orgId = reg.json().organizationId as string;
  const userId = reg.json().user.id as string;

  const evt = await req(token, 'POST', '/api/events', { organizationId: orgId, title: 'Lifecycle Wedding' });
  const eventId = evt.json().event.id as string;

  return { token, orgId, eventId, userId };
}

/** Seed a connected SMTP integration directly (skips real verify()). */
function connectSmtp(orgId: string) {
  return integrationsRepo.upsert({
    organizationId: orgId,
    provider: 'email_smtp',
    displayName: 'Test SMTP',
    config: { host: 'smtp.test', port: 587, secure: false, fromAddress: 'hello@venue.test', fromName: 'Venue' },
    secretPayload: sealSecret({ username: 'u', password: 'p' }),
    status: 'connected',
  });
}

describe('Lifecycle email automations (config API)', () => {
  it('upserts and lists an automation rule', async () => {
    const s = await setup();
    const tpl = emailTemplatesRepo.create(s.orgId, {
      name: 'Reminder', subject: 'RSVP soon, {{guest_name}}', bodyHtml: '<p>{{event_title}} on {{event_date}}</p>', createdBy: s.userId,
    });

    const put = await req(s.token, 'PUT', `/api/orgs/${s.orgId}/email-automations`, {
      templateId: tpl.id, triggerType: 'rsvp_reminder', offsetDays: 10, enabled: true,
    });
    expect(put.statusCode).toBe(200);
    expect(put.json().automation.trigger_type).toBe('rsvp_reminder');
    expect(put.json().automation.offset_days).toBe(10);

    const list = await req(s.token, 'GET', `/api/orgs/${s.orgId}/email-automations`);
    expect(list.json().automations).toHaveLength(1);
  });

  it('upsert is idempotent per trigger (one rule per trigger_type)', async () => {
    const s = await setup();
    const tpl = emailTemplatesRepo.create(s.orgId, { name: 'T', subject: 'S', bodyHtml: 'B', createdBy: s.userId });
    await req(s.token, 'PUT', `/api/orgs/${s.orgId}/email-automations`, { templateId: tpl.id, triggerType: 'thank_you' });
    await req(s.token, 'PUT', `/api/orgs/${s.orgId}/email-automations`, { templateId: tpl.id, triggerType: 'thank_you', enabled: false });
    const list = await req(s.token, 'GET', `/api/orgs/${s.orgId}/email-automations`);
    expect(list.json().automations).toHaveLength(1);
    expect(list.json().automations[0].enabled).toBe(0);
  });

  it('rejects a template from another org', async () => {
    const a = await setup();
    const b = await setup();
    const bTpl = emailTemplatesRepo.create(b.orgId, { name: 'T', subject: 'S', bodyHtml: 'B', createdBy: b.userId });
    const res = await req(a.token, 'PUT', `/api/orgs/${a.orgId}/email-automations`, { templateId: bTpl.id, triggerType: 'manual' });
    expect(res.statusCode).toBe(400);
  });

  it('requires auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/orgs/x/email-automations' });
    expect(res.statusCode).toBe(401);
  });
});

describe('Lifecycle email send engine', () => {
  it('schedules a thank-you email per attending guest and enqueues jobs', async () => {
    const s = await setup();
    connectSmtp(s.orgId);
    const tpl = emailTemplatesRepo.create(s.orgId, {
      name: 'Thanks', subject: 'Thank you {{guest_name}}!',
      bodyHtml: '<p>Thanks for celebrating {{event_title}} at {{venue_name}}.</p>',
      bodyText: 'Thanks {{guest_name}}', createdBy: s.userId,
    });
    await req(s.token, 'PUT', `/api/orgs/${s.orgId}/email-automations`, { templateId: tpl.id, triggerType: 'thank_you' });

    // 2 attending (with email), 1 attending (no email → skipped), 1 declined → skipped
    guestsRepo.create(s.orgId, s.eventId, { fullName: 'Amy', email: 'amy@x.com', rsvpStatus: 'attending' });
    guestsRepo.create(s.orgId, s.eventId, { fullName: 'Ben', email: 'ben@x.com', rsvpStatus: 'attending' });
    guestsRepo.create(s.orgId, s.eventId, { fullName: 'NoEmail', rsvpStatus: 'attending' });
    guestsRepo.create(s.orgId, s.eventId, { fullName: 'Dana', email: 'dana@x.com', rsvpStatus: 'declined' });

    const res = await req(s.token, 'POST', `/api/events/${s.eventId}/lifecycle-emails/send`, { triggerType: 'thank_you' });
    expect(res.statusCode).toBe(200);
    expect(res.json().result.scheduled).toBe(2);

    // A job per scheduled email was enqueued.
    const pending = jobsRepo.stats();
    expect(pending.pending).toBeGreaterThanOrEqual(2);

    // Log shows 2 sent rows with rendered subjects.
    const log = scheduledEmailsRepo.listForEvent(s.eventId).filter((e) => e.guest_id);
    expect(log).toHaveLength(2);
    expect(log.every((e) => e.status === 'sent')).toBe(true);
    expect(log.map((e) => e.subject).sort()).toEqual(['Thank you Amy!', 'Thank you Ben!']);
  });

  it('is idempotent — re-sending the same trigger schedules nothing new', async () => {
    const s = await setup();
    connectSmtp(s.orgId);
    const tpl = emailTemplatesRepo.create(s.orgId, { name: 'T', subject: 'Hi {{guest_name}}', bodyHtml: 'B', createdBy: s.userId });
    await req(s.token, 'PUT', `/api/orgs/${s.orgId}/email-automations`, { templateId: tpl.id, triggerType: 'thank_you' });
    guestsRepo.create(s.orgId, s.eventId, { fullName: 'Amy', email: 'amy@x.com', rsvpStatus: 'attending' });

    const first = await req(s.token, 'POST', `/api/events/${s.eventId}/lifecycle-emails/send`, { triggerType: 'thank_you' });
    expect(first.json().result.scheduled).toBe(1);
    const second = await req(s.token, 'POST', `/api/events/${s.eventId}/lifecycle-emails/send`, { triggerType: 'thank_you' });
    expect(second.json().result.scheduled).toBe(0);
    expect(second.json().result.skipped).toBe(1);

    expect(scheduledEmailsRepo.listForEvent(s.eventId).filter((e) => e.guest_id)).toHaveLength(1);
  });

  it('no-ops gracefully when no SMTP integration is connected', async () => {
    const s = await setup();
    const tpl = emailTemplatesRepo.create(s.orgId, { name: 'T', subject: 'S', bodyHtml: 'B', createdBy: s.userId });
    await req(s.token, 'PUT', `/api/orgs/${s.orgId}/email-automations`, { templateId: tpl.id, triggerType: 'thank_you' });
    guestsRepo.create(s.orgId, s.eventId, { fullName: 'Amy', email: 'amy@x.com', rsvpStatus: 'attending' });

    const res = await req(s.token, 'POST', `/api/events/${s.eventId}/lifecycle-emails/send`, { triggerType: 'thank_you' });
    expect(res.statusCode).toBe(200);
    expect(res.json().result.scheduled).toBe(0);
    expect(res.json().result.reason).toBe('no-smtp-integration');
  });

  it('fires thank-you automatically when event status flips to completed', async () => {
    const s = await setup();
    connectSmtp(s.orgId);
    const tpl = emailTemplatesRepo.create(s.orgId, { name: 'T', subject: 'Thanks {{guest_name}}', bodyHtml: 'B', createdBy: s.userId });
    await req(s.token, 'PUT', `/api/orgs/${s.orgId}/email-automations`, { templateId: tpl.id, triggerType: 'thank_you' });
    guestsRepo.create(s.orgId, s.eventId, { fullName: 'Amy', email: 'amy@x.com', rsvpStatus: 'attending' });

    const res = await app.inject({
      method: 'PATCH', url: `/api/events/${s.eventId}`,
      headers: { authorization: `Bearer ${s.token}`, 'content-type': 'application/json' },
      payload: { status: 'completed' } as never,
    });
    expect(res.statusCode).toBe(200);

    const log = scheduledEmailsRepo.listForEvent(s.eventId).filter((e) => e.guest_id);
    expect(log).toHaveLength(1);
    expect(log[0].trigger_type).toBe('thank_you');
  });

  it('exposes the send log + stats endpoint', async () => {
    const s = await setup();
    connectSmtp(s.orgId);
    const tpl = emailTemplatesRepo.create(s.orgId, { name: 'T', subject: 'S {{guest_name}}', bodyHtml: 'B', createdBy: s.userId });
    await req(s.token, 'PUT', `/api/orgs/${s.orgId}/email-automations`, { templateId: tpl.id, triggerType: 'save_the_date' });
    guestsRepo.create(s.orgId, s.eventId, { fullName: 'Amy', email: 'amy@x.com' });
    await req(s.token, 'POST', `/api/events/${s.eventId}/lifecycle-emails/send`, { triggerType: 'save_the_date' });

    const res = await req(s.token, 'GET', `/api/events/${s.eventId}/lifecycle-emails`);
    expect(res.statusCode).toBe(200);
    expect(res.json().emails).toHaveLength(1);
    expect(res.json().stats.sent).toBe(1);
  });
});
