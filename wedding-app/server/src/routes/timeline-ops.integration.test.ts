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
    'event_offline_packets','timeline_reminders','timeline_incidents','timeline_approvals','timeline_change_logs',
    'layout_versions','layouts','timeline_events','vendor_portal_tokens','vendor_payments','vendors','rsvp_submissions','guests',
    'event_memberships','events','organization_memberships','organizations','users','audit_logs',
  ]) { try { db.prepare(`DELETE FROM ${t}`).run(); } catch {} }
  try { db.prepare(`DELETE FROM role_permissions WHERE role_id IN (SELECT id FROM roles WHERE is_system = 0)`).run(); db.prepare(`DELETE FROM roles WHERE is_system = 0`).run(); } catch {}
  rolesRepo.ensureSystemRoles();
});

async function setup() {
  const r = await app.inject({ method: 'POST', url: '/api/auth/register',
    payload: { email: `timeline-ops-${Math.random().toString(36).slice(2)}@x.com`, password: 'testpass123', fullName: 'Owner', orgName: 'Venue' },
    headers: { 'content-type': 'application/json' } });
  const token = r.json().token as string;
  const orgId = r.json().organizationId as string;
  const e = await app.inject({ method: 'POST', url: '/api/events',
    payload: { organizationId: orgId, title: 'Timeline Ops Wedding', startDate: '2026-09-12' },
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' } });
  const eventId = e.json().event.id as string;
  const item = await app.inject({ method: 'POST', url: `/api/events/${eventId}/timeline`,
    payload: { title: 'Ceremony', category: 'ceremony', startsAt: '2026-09-12T16:00:00.000Z', durationMin: 30 },
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' } });
  return { token, orgId, eventId, itemId: item.json().item.id as string };
}

const req = (token: string, method: 'GET'|'POST', url: string, payload?: unknown) => app.inject({
  method, url,
  headers: payload !== undefined ? { authorization: `Bearer ${token}`, 'content-type': 'application/json' } : { authorization: `Bearer ${token}` },
  payload: payload as never,
});

describe('timeline manager operations routes', () => {
  it('persists approvals, change logs, incidents, reminders, and offline packets for cross-device timeline operations', async () => {
    const s = await setup();

    const approval = await req(s.token, 'POST', `/api/events/${s.eventId}/timeline-ops/approval`, { role: 'manager', status: 'approved' });
    expect(approval.statusCode).toBe(201);
    expect(approval.json().approval.status).toBe('approved');

    const snapshot = await req(s.token, 'POST', `/api/events/${s.eventId}/timeline-ops/change-log`, {
      changeType: 'snapshot',
      summary: 'Manager timeline snapshot saved',
      payload: { savedAt: '2026-09-11T12:00:00.000Z', items: [{ id: s.itemId, title: 'Ceremony' }] },
    });
    expect(snapshot.statusCode).toBe(201);

    const incident = await req(s.token, 'POST', `/api/events/${s.eventId}/timeline-ops/incident`, {
      timelineItemId: s.itemId,
      severity: 'delay',
      note: 'DJ soundcheck delayed 10 minutes',
    });
    expect(incident.statusCode).toBe(201);
    expect(incident.json().incident.timeline_item_id).toBe(s.itemId);

    const reminder = await req(s.token, 'POST', `/api/events/${s.eventId}/timeline-ops/reminder`, {
      timelineItemId: s.itemId,
      remindAt: '2026-09-12T15:30:00.000Z',
      audience: 'venue_staff',
      payload: { itemTitle: 'Ceremony' },
    });
    expect(reminder.statusCode).toBe(201);

    const packet = await req(s.token, 'POST', `/api/events/${s.eventId}/timeline-ops/offline-packet`, {
      audience: 'venue_staff',
      payload: { items: [{ id: s.itemId, title: 'Ceremony' }] },
    });
    expect(packet.statusCode).toBe(201);

    const list = await req(s.token, 'GET', `/api/events/${s.eventId}/timeline-ops`);
    expect(list.statusCode).toBe(200);
    expect(list.json().ops.approvals).toHaveLength(1);
    expect(list.json().ops.incidents).toHaveLength(1);
    expect(list.json().ops.reminders).toHaveLength(1);
    expect(list.json().ops.offlinePackets).toHaveLength(1);
    expect(list.json().ops.changeLogs.some((log: any) => log.change_type === 'snapshot')).toBe(true);
    expect(list.json().ops.changeLogs.some((log: any) => log.change_type === 'approval')).toBe(true);
    expect(list.json().ops.changeLogs.some((log: any) => log.change_type === 'incident')).toBe(true);
  });

  it('rejects incident records for timeline items on a different event', async () => {
    const s1 = await setup();
    const s2 = await setup();
    const res = await req(s1.token, 'POST', `/api/events/${s1.eventId}/timeline-ops/incident`, {
      timelineItemId: s2.itemId,
      severity: 'incident',
      note: 'Wrong event item',
    });
    expect(res.statusCode).toBe(400);
  });
});
