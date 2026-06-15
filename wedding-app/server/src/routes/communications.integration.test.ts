import './../test/setup.js';
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { db } from '../db/database.js';
import { buildApp } from '../index.js';
import type { FastifyInstance } from 'fastify';
import { rolesRepo } from '../db/repos/index.js';

let app: FastifyInstance;
beforeAll(async () => { app = await buildApp(); await app.ready(); });

beforeEach(() => {
  for (const t of ['event_broadcast_recipients','event_communication_audit_logs','direct_messages','staff_tasks','vendors','events','organization_memberships','organizations','users','audit_logs']) { try { db.prepare(`DELETE FROM ${t}`).run(); } catch {} }
  try { db.prepare(`DELETE FROM role_permissions WHERE role_id IN (SELECT id FROM roles WHERE is_system = 0)`).run(); db.prepare(`DELETE FROM roles WHERE is_system = 0`).run(); } catch {}
  rolesRepo.ensureSystemRoles();
});

async function setup() {
  const r = await app.inject({ method: 'POST', url: '/api/auth/register', payload: { email: `comm-${Math.random().toString(36).slice(2)}@x.com`, password: 'testpass123', fullName: 'Owner', orgName: 'Venue' }, headers: { 'content-type': 'application/json' } });
  const token = r.json().token as string;
  const orgId = r.json().organizationId as string;
  const e = await app.inject({ method: 'POST', url: '/api/events', payload: { organizationId: orgId, title: 'Comms Wedding', startDate: '2026-09-12' }, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' } });
  const eventId = e.json().event.id as string;
  await app.inject({ method: 'POST', url: `/api/orgs/${orgId}/staff/tasks`, payload: { title: 'Setup', eventId, assigneeName: 'Setup Lead', assigneePhone: '555-1000' }, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' } });
  await app.inject({ method: 'POST', url: `/api/orgs/${orgId}/vendors`, payload: { name: 'DJ Co', eventId, phone: '555-2000' }, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' } });
  return { token, orgId, eventId };
}

const req = (token: string, method: 'GET'|'POST', url: string, payload?: unknown) => app.inject({ method, url, headers: payload !== undefined ? { authorization: `Bearer ${token}`, 'content-type': 'application/json' } : { authorization: `Bearer ${token}` }, payload: payload as never });

describe('event communications broadcast workflow', () => {
  it('creates communication audit, recipient visibility, and urgent thread message', async () => {
    const s = await setup();
    const res = await req(s.token, 'POST', `/api/events/${s.eventId}/communications/broadcast`, { title: 'Urgent weather update', body: 'Move ceremony indoors.', channel: 'sms', audience: 'all', severity: 'urgent', quietHoursOverride: true });
    expect(res.statusCode).toBe(201);
    expect(res.json().broadcast.severity).toBe('urgent');
    expect(res.json().recipients.length).toBeGreaterThanOrEqual(2);

    const list = await req(s.token, 'GET', `/api/events/${s.eventId}/communications`);
    expect(list.statusCode).toBe(200);
    expect(list.json().communications.broadcasts).toHaveLength(1);
    expect(list.json().communications.recipients.length).toBeGreaterThanOrEqual(2);

    const messages = await req(s.token, 'GET', `/api/messages/${encodeURIComponent(`${s.eventId}:urgent`)}`);
    expect(messages.statusCode).toBe(200);
    expect(messages.json().messages[0].body).toContain('Urgent weather update');
  });
});
