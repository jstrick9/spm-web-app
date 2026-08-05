/**
 * Couple-appointment double-booking guard regression tests.
 *
 * Covers the appointment-time-conflict protection added after the
 * MODULE-10 review: the venue can no longer hold two overlapping
 * meetings for the same couple, either at request time or when a
 * meeting is confirmed.
 */
import './../test/setup.js';
import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../index.js';
import { db } from '../db/database.js';

let app: FastifyInstance;

beforeAll(async () => { app = await buildApp(); await app.ready(); });
beforeEach(() => { db.exec('BEGIN'); });
afterEach(async () => { db.exec('ROLLBACK'); });

async function setup() {
  const email = `apt-${Math.random().toString(36).slice(2)}@x.com`;
  const reg = await app.inject({
    method: 'POST', url: '/api/auth/register',
    payload: { email, password: 'testpass123', fullName: 'Owner', orgName: 'Appt Venue' },
    headers: { 'content-type': 'application/json' },
  });
  expect(reg.statusCode).toBe(201);
  const token = reg.json().token as string;
  const orgId = reg.json().organizationId as string;

  const evt = await app.inject({
    method: 'POST', url: '/api/events',
    payload: { organizationId: orgId, title: 'Appt Wedding' },
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
  });
  expect(evt.statusCode).toBe(201);
  const eventId = evt.json().event.id as string;
  return { token, orgId, eventId };
}

const post = (token: string, url: string, payload: unknown) =>
  app.inject({
    method: 'POST', url,
    payload: payload as never,
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
  });
const patch = (token: string, url: string, payload: unknown) =>
  app.inject({
    method: 'PATCH', url,
    payload: payload as never,
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
  });

describe('couple appointment double-booking guard', () => {
  it('blocks a new appointment overlapping a live one (409 appointment-time-conflict)', async () => {
    const { token, eventId } = await setup();
    const first = await post(token, `/api/events/${eventId}/couple-appointments`, {
      appointmentType: 'tasting',
      title: 'Menu tasting',
      startsAt: '2026-09-01T10:00:00Z',
      endsAt: '2026-09-01T11:00:00Z',
    });
    expect(first.statusCode).toBe(201);

    const overlap = await post(token, `/api/events/${eventId}/couple-appointments`, {
      appointmentType: 'planning_meeting',
      title: 'Final details meeting',
      startsAt: '2026-09-01T10:30:00Z',
      endsAt: '2026-09-01T11:30:00Z',
    });
    expect(overlap.statusCode).toBe(409);
    expect(overlap.json().error).toBe('appointment-time-conflict');
    expect(overlap.json().details.conflicting.title).toBe('Menu tasting');
  });

  it('allows back-to-back and non-overlapping appointments', async () => {
    const { token, eventId } = await setup();
    const a = await post(token, `/api/events/${eventId}/couple-appointments`, {
      appointmentType: 'tasting', startsAt: '2026-09-01T10:00:00Z', endsAt: '2026-09-01T11:00:00Z',
    });
    expect(a.statusCode).toBe(201);
    const backToBack = await post(token, `/api/events/${eventId}/couple-appointments`, {
      appointmentType: 'planning_meeting', startsAt: '2026-09-01T11:00:00Z', endsAt: '2026-09-01T12:00:00Z',
    });
    expect(backToBack.statusCode).toBe(201);
    const nextDay = await post(token, `/api/events/${eventId}/couple-appointments`, {
      appointmentType: 'final_walkthrough', startsAt: '2026-09-02T10:00:00Z', endsAt: '2026-09-02T11:00:00Z',
    });
    expect(nextDay.statusCode).toBe(201);
  });

  it('ignores cancelled appointments when checking conflicts', async () => {
    const { token, eventId } = await setup();
    const a = await post(token, `/api/events/${eventId}/couple-appointments`, {
      appointmentType: 'tasting', startsAt: '2026-09-01T10:00:00Z', endsAt: '2026-09-01T11:00:00Z',
    });
    const appointmentId = a.json().appointment.id as string;
    const cancel = await patch(token, `/api/events/${eventId}/couple-appointments/${appointmentId}`, { status: 'cancelled' });
    expect(cancel.statusCode).toBe(200);

    const reuse = await post(token, `/api/events/${eventId}/couple-appointments`, {
      appointmentType: 'planning_meeting', startsAt: '2026-09-01T10:00:00Z', endsAt: '2026-09-01T11:00:00Z',
    });
    expect(reuse.statusCode).toBe(201);
  });

  it('allows availability-window-only requests (no fixed time, no conflict check)', async () => {
    const { token, eventId } = await setup();
    const a = await post(token, `/api/events/${eventId}/couple-appointments`, {
      appointmentType: 'tasting', availabilityWindow: 'Tuesdays 1-4 PM',
    });
    expect(a.statusCode).toBe(201);
    const b = await post(token, `/api/events/${eventId}/couple-appointments`, {
      appointmentType: 'planning_meeting', availabilityWindow: 'Tuesdays 1-4 PM',
    });
    expect(b.statusCode).toBe(201);
  });

  it('blocks confirming a meeting whose window overlaps another live meeting', async () => {
    const { token, eventId } = await setup();
    const a = await post(token, `/api/events/${eventId}/couple-appointments`, {
      appointmentType: 'tasting', startsAt: '2026-09-01T10:00:00Z', endsAt: '2026-09-01T11:00:00Z',
    });
    const b = await post(token, `/api/events/${eventId}/couple-appointments`, {
      appointmentType: 'planning_meeting', startsAt: '2026-09-01T14:00:00Z', endsAt: '2026-09-01T15:00:00Z',
    });
    const bId = b.json().appointment.id as string;

    // Time drift (e.g. a reschedule that predates the guard) moves B into A's window.
    db.prepare(`UPDATE couple_appointments SET starts_at = ?, ends_at = ?, updated_at = datetime('now') WHERE id = ?`)
      .run('2026-09-01T10:15:00Z', '2026-09-01T11:15:00Z', bId);

    const confirm = await patch(token, `/api/events/${eventId}/couple-appointments/${bId}`, { status: 'confirmed' });
    expect(confirm.statusCode).toBe(409);
    expect(confirm.json().error).toBe('appointment-time-conflict');

    // Once the overlapping meeting is cancelled, confirmation succeeds.
    const aId = a.json().appointment.id as string;
    await patch(token, `/api/events/${eventId}/couple-appointments/${aId}`, { status: 'cancelled' });
    const confirmNow = await patch(token, `/api/events/${eventId}/couple-appointments/${bId}`, { status: 'confirmed' });
    expect(confirmNow.statusCode).toBe(200);
    expect(confirmNow.json().appointment.status).toBe('confirmed');
  });

  it('does not conflict with itself on re-confirm', async () => {
    const { token, eventId } = await setup();
    const a = await post(token, `/api/events/${eventId}/couple-appointments`, {
      appointmentType: 'tasting', startsAt: '2026-09-01T10:00:00Z', endsAt: '2026-09-01T11:00:00Z',
    });
    const aId = a.json().appointment.id as string;
    const confirm = await patch(token, `/api/events/${eventId}/couple-appointments/${aId}`, { status: 'confirmed' });
    expect(confirm.statusCode).toBe(200);
    const reconfirm = await patch(token, `/api/events/${eventId}/couple-appointments/${aId}`, { status: 'confirmed' });
    expect(reconfirm.statusCode).toBe(200);
  });
});
