import './../test/setup.js';
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { db } from '../db/database.js';
import { buildApp } from '../index.js';
import type { FastifyInstance } from 'fastify';
import { rolesRepo } from '../db/repos/index.js';

let app: FastifyInstance;
beforeAll(async () => { app = await buildApp(); await app.ready(); });

beforeEach(() => {
  for (const t of [
    'vendor_portal_tokens','vendor_ratings','invite_tracking','vendor_checkins','gallery_images','inventory_items','contracts',
    'budget_items','webhook_deliveries','webhooks','push_subscriptions','sse_events',
    'audit_logs','direct_messages','event_answers','event_questions','staff_shifts','staff_areas','staff_tasks','timeline_events',
    'vendor_payments','vendors','guest_portal_configs','rsvp_submissions','guest_sub_event_invitations','guests','layout_versions','layouts',
    'catalog_items','venues','sub_events','event_memberships','events','organization_memberships','organizations','users',
  ]) { try { db.prepare(`DELETE FROM ${t}`).run(); } catch {} }
  try { db.prepare(`DELETE FROM role_permissions WHERE role_id IN (SELECT id FROM roles WHERE is_system = 0)`).run(); db.prepare(`DELETE FROM roles WHERE is_system = 0`).run(); } catch {}
  rolesRepo.ensureSystemRoles();
});

async function setup() {
  const r = await app.inject({ method: 'POST', url: '/api/auth/register',
    payload: { email: `pa-${Math.random().toString(36).slice(2)}@x.com`, password: 'testpass123', fullName: 'Owner', orgName: 'Venue' },
    headers: { 'content-type': 'application/json' } });
  const token = r.json().token as string;
  const orgId = r.json().organizationId as string;
  const e = await app.inject({ method: 'POST', url: '/api/events',
    payload: { organizationId: orgId, title: 'Abuse Test Wedding', startDate: '2026-09-12' },
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' } });
  const eventId = e.json().event.id as string;
  return { token, orgId, eventId };
}

function auditActions() {
  return (db.prepare(`SELECT action, target_type, target_id, details FROM audit_logs ORDER BY created_at DESC`).all() as any[]).map(r => r.action);
}

describe('Public endpoint abuse controls', () => {
  it('rejects RSVP honeypot submissions and audits the block', async () => {
    const s = await setup();
    const res = await app.inject({ method: 'POST', url: `/api/portal/${s.eventId}/rsvp`,
      payload: { attending: true, website: 'https://spam.example' },
      headers: { 'content-type': 'application/json' } });

    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('spam-detected');
    expect(auditActions()).toContain('public.abuse.rsvp.blocked');
  });

  it('rejects public NPS honeypot submissions and audits the block', async () => {
    const s = await setup();
    const res = await app.inject({ method: 'POST', url: `/api/public/events/${s.eventId}/nps`,
      payload: { score: 10, comment: 'Great', company: 'bot-field' },
      headers: { 'content-type': 'application/json' } });

    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('spam-detected');
    expect(auditActions()).toContain('public.abuse.nps.blocked');
  });

  it('dedupes NPS by device session (score inflation guard)', async () => {
    const s = await setup();
    const first = await app.inject({ method: 'POST', url: `/api/public/events/${s.eventId}/nps`,
      payload: { score: 10, comment: 'Amazing' },
      headers: { 'content-type': 'application/json' } });
    expect(first.statusCode).toBe(200);
    const dup = await app.inject({ method: 'POST', url: `/api/public/events/${s.eventId}/nps`,
      payload: { score: 0, comment: 'Inflated' },
      headers: { 'content-type': 'application/json' } });
    expect(dup.statusCode).toBe(400);
    expect(dup.json().error).toBe('already-submitted');
  });

  it('serves polls to the PUBLIC guest portal (no auth) — regression: GET was auth-only, portal polls were always empty + 403 on every load', async () => {
    const s = await setup();
    db.prepare(`UPDATE events SET metadata = ? WHERE id = ?`).run(JSON.stringify({ polls: [{ id: 'poll-guest-1', question: 'Which appetizer?', status: 'active', options: [{ id: 'o1', text: 'Bruschetta', votes: 2 }, { id: 'o2', text: 'Sliders', votes: 1 }] }] }), s.eventId);

    // Anonymous (no auth, no token): the guest portal loads polls this way.
    const anon = await app.inject({ method: 'GET', url: `/api/events/${s.eventId}/polls` });
    expect(anon.statusCode).toBe(200);
    expect(anon.json().polls).toHaveLength(1);
    expect(anon.json().polls[0].question).toBe('Which appetizer?');

    // A random OTHER user (no membership) can also read poll content —
    // polls are guest-visible by design (the vote endpoint is public).
    const outsider = await app.inject({ method: 'POST', url: '/api/auth/register',
      payload: { email: `outsider-${Math.random().toString(36).slice(2)}@x.com`, password: 'testpass123', fullName: 'Outsider', orgName: 'Other' },
      headers: { 'content-type': 'application/json' } });
    const outsiderRes = await app.inject({ method: 'GET', url: `/api/events/${s.eventId}/polls`, headers: { authorization: `Bearer ${outsider.json().token}` } });
    expect(outsiderRes.statusCode).toBe(200);

    // Garbage event id still 404s (no information leak).
    const missing = await app.inject({ method: 'GET', url: `/api/events/does-not-exist/polls` });
    expect(missing.statusCode).toBe(404);
  });

  it('rejects public poll vote honeypot submissions and audits the block', async () => {
    const s = await setup();
    const poll = { id: 'poll-1', question: 'Song?', status: 'active', options: [{ id: 'opt-1', text: 'A', votes: 0 }] };
    db.prepare(`UPDATE events SET metadata = ? WHERE id = ?`).run(JSON.stringify({ polls: [poll] }), s.eventId);

    const res = await app.inject({ method: 'POST', url: `/api/events/${s.eventId}/polls/poll-1/vote`,
      payload: { optionId: 'opt-1', _gotcha: 'filled' },
      headers: { 'content-type': 'application/json' } });

    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('spam-detected');
    expect(auditActions()).toContain('public.abuse.poll.vote.blocked');
  });

  it('rejects vendor portal message honeypot submissions and audits the block', async () => {
    const s = await setup();
    const vendor = await app.inject({ method: 'POST', url: `/api/orgs/${s.orgId}/vendors`,
      payload: { name: 'DJ Bot Trap', eventId: s.eventId },
      headers: { authorization: `Bearer ${s.token}`, 'content-type': 'application/json' } });
    const vendorId = vendor.json().vendor.id as string;
    const tokenRes = await app.inject({ method: 'POST', url: `/api/vendors/${vendorId}/portal-token`,
      payload: { expiresInDays: 7 },
      headers: { authorization: `Bearer ${s.token}`, 'content-type': 'application/json' } });

    const res = await app.inject({ method: 'POST', url: `/api/portal/vendors/${vendorId}/messages`,
      payload: { body: 'hello', token: tokenRes.json().token, url: 'bot-field' },
      headers: { 'content-type': 'application/json' } });

    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('spam-detected');
    expect(auditActions()).toContain('public.abuse.vendor.message.blocked');
  });
});
