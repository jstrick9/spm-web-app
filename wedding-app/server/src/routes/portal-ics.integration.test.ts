/**
 * Guest portal calendar export (ICS) regression tests — RFC 5545 TEXT
 * escaping on the per-sub-event .ics endpoint.
 */
import '../test/setup.js';
import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../index.js';
import { db } from '../db/database.js';
let app: FastifyInstance;

beforeAll(async () => { app = await buildApp(); await app.ready(); });
beforeEach(() => { db.exec('BEGIN'); });
afterEach(async () => { db.exec('ROLLBACK'); });

async function setup() {
  const reg = await app.inject({
    method: 'POST', url: '/api/auth/register',
    payload: { email: `ics-${Math.random().toString(36).slice(2)}@x.com`, password: 'testpass123', fullName: 'Owner', orgName: 'Ics Venue' },
    headers: { 'content-type': 'application/json' },
  });
  const token = reg.json().token as string;
  const orgId = reg.json().organizationId as string;
  const evt = await app.inject({
    method: 'POST', url: '/api/events',
    payload: { organizationId: orgId, title: 'Ics Wedding' },
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
  });
  const eventId = evt.json().event.id as string;
  const subId = (db.prepare(`INSERT INTO sub_events (id, event_id, title, starts_at, ends_at, metadata)
    VALUES ('sub-ics-1', ?, 'Rehearsal, Dinner; Planning \\ Backslash', '2026-09-11T17:00:00.000Z', '2026-09-11T19:00:00.000Z', ?)
    RETURNING id`).get(eventId, JSON.stringify({
    location: 'Garden; Terrace, Building A',
    parking: 'Lot 1, Behind the barn',
    dressCode: 'Semi-formal; garden attire',
  })) as { id: string }).id;
  return { token, eventId, subId };
}

describe('guest portal sub-event .ics export', () => {
  it('escapes RFC 5545 TEXT characters (backslash, semicolon, comma) in title/location/description', async () => {
    const { eventId, subId } = await setup();
    const res = await app.inject({ method: 'GET', url: `/api/portal/${eventId}/sub-events/${subId}.ics` });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/calendar');
    const body = res.body;
    // Title "Rehearsal, Dinner; Planning \ Backslash" must be escaped.
    expect(body).toContain('SUMMARY:Rehearsal\\, Dinner\\; Planning \\\\ Backslash');
    expect(body).toContain('LOCATION:Garden\\; Terrace\\, Building A');
    expect(body).toContain('Parking: Lot 1\\, Behind the barn');
    expect(body).toContain('Dress code: Semi-formal\\; garden attire');
    // Every line must be a well-formed ICS property — no injected lines.
    const lines = body.split('\r\n').filter(Boolean);
    expect(lines[0]).toBe('BEGIN:VCALENDAR');
    expect(lines[lines.length - 1]).toBe('END:VCALENDAR');
    for (const line of lines.slice(1, -1)) {
      expect(line).toMatch(/^(VERSION:|PRODID:|BEGIN:VEVENT|END:VEVENT|UID:|SUMMARY:|DTSTART:|DTEND:|LOCATION:|DESCRIPTION:)/);
    }
  });

  it('invite-only sub-events require a valid guest token', async () => {
    const { eventId } = await setup();
    db.prepare(`UPDATE sub_events SET invite_only = 1 WHERE id = 'sub-ics-1'`).run();
    const denied = await app.inject({ method: 'GET', url: `/api/portal/${eventId}/sub-events/sub-ics-1.ics` });
    expect(denied.statusCode).toBe(403);
    const granted = await app.inject({ method: 'GET', url: `/api/portal/${eventId}/sub-events/sub-ics-1.ics?guest=g-x&token=t` });
    expect(granted.statusCode).toBe(403); // unknown guest still denied
  });

  it('event export .ics escapes title and neutralizes CR/LF (no line injection)', async () => {
    const { token, eventId } = await setup();
    db.prepare(`UPDATE events SET title = 'Smith\r\nX-EVIL:1 Wedding; Final, v2', start_date = '2026-09-12' WHERE id = ?`).run(eventId);
    const res = await app.inject({
      method: 'GET', url: `/api/events/${eventId}/export.ics`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('SUMMARY:Smith X-EVIL:1 Wedding\\; Final\\, v2');
    // The CRLF inside the title was neutralized to a space: the injected
    // "X-EVIL:1" cannot appear as its own property line, and every line of
    // the payload is a well-formed ICS property.
    for (const line of res.body.split('\r\n').filter(Boolean)) {
      expect(line).toMatch(/^(BEGIN:|END:|VERSION:|PRODID:|CALSCALE:|UID:|DTSTAMP:|DTSTART|DTEND|SUMMARY:|DESCRIPTION:|STATUS:)/);
    }
    expect(res.body).not.toContain('X-EVIL:1\r\n');
  });
});
