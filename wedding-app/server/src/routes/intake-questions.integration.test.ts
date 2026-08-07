/**
 * Couple intake questionnaire end-to-end (server): the venue creates
 * questions, the COUPLE member can answer their own event's forms (was
 * events.edit-only → couples were forbidden), and the venue can view
 * questions + answers. Regression for the dead-ended "Couple Intake Forms"
 * feature (studio created questions; no UI/API path for couples to answer).
 */
import './../test/setup.js';
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { db } from '../db/database.js';
import { buildApp } from '../index.js';
import type { FastifyInstance } from 'fastify';
import { rolesRepo, eventQuestionsRepo } from '../db/repos/index.js';

let app: FastifyInstance;
beforeAll(async () => { app = await buildApp(); await app.ready(); });

beforeEach(() => {
  for (const t of [
    'audit_logs','guest_portal_configs','rsvp_submissions','guest_sub_event_invitations',
    'event_answers','event_questions','guests','layout_versions','layouts','catalog_items',
    'venues','sub_events','event_memberships','events','organization_memberships',
    'organizations','users',
  ]) { try { db.prepare(`DELETE FROM ${t}`).run(); } catch {} }
  try { db.prepare(`DELETE FROM role_permissions WHERE role_id IN (SELECT id FROM roles WHERE is_system = 0)`).run(); db.prepare(`DELETE FROM roles WHERE is_system = 0`).run(); } catch {}
  rolesRepo.ensureSystemRoles();
});

async function setup() {
  const ownerReg = await app.inject({ method: 'POST', url: '/api/auth/register',
    payload: { email: `q-owner-${Math.random().toString(36).slice(2)}@x.com`, password: 'testpass123', fullName: 'Owner', orgName: 'Venue' },
    headers: { 'content-type': 'application/json' } });
  const ownerToken = ownerReg.json().token;
  const orgId = ownerReg.json().organizationId;
  const ev = await app.inject({ method: 'POST', url: '/api/events',
    payload: { organizationId: orgId, title: 'Intake Wedding', startDate: '2026-10-10', guestCount: 50 },
    headers: { authorization: `Bearer ${ownerToken}`, 'content-type': 'application/json' } });
  const eventId = ev.json().event.id;

  // venue creates intake questions
  const q1 = await app.inject({ method: 'POST', url: `/api/orgs/${orgId}/questions`,
    payload: { question: 'Ceremony style?', groupName: 'Ceremony', answerType: 'text', required: true },
    headers: { authorization: `Bearer ${ownerToken}`, 'content-type': 'application/json' } });
  expect(q1.statusCode).toBe(201);
  const questionId = q1.json().question.id;
  eventQuestionsRepo.create(orgId, { question: 'Guest count?', groupName: 'Guests', answerType: 'integer', required: false } as never);

  // couple account + membership
  const coupleEmail = `q-couple-${Math.random().toString(36).slice(2)}@x.com`;
  await app.inject({ method: 'POST', url: '/api/auth/register',
    payload: { email: coupleEmail, password: 'testpass123', fullName: 'Casey Couple', orgName: 'Tmp' },
    headers: { 'content-type': 'application/json' } });
  const invite = await app.inject({ method: 'POST', url: `/api/events/${eventId}/couple-invitations`,
    payload: { email: coupleEmail, roleKey: 'couple' },
    headers: { authorization: `Bearer ${ownerToken}`, 'content-type': 'application/json' } });
  expect(invite.statusCode).toBe(201);
  const coupleLogin = await app.inject({ method: 'POST', url: '/api/auth/login',
    payload: { email: coupleEmail, password: 'testpass123' }, headers: { 'content-type': 'application/json' } });
  const coupleToken = coupleLogin.json().token;

  return { ownerToken, coupleToken, orgId, eventId, questionId };
}

describe('Couple intake questionnaire', () => {
  it('couples can list their event questions', async () => {
    const s = await setup();
    const res = await app.inject({ method: 'GET', url: `/api/events/${s.eventId}/questions`,
      headers: { authorization: `Bearer ${s.coupleToken}` } });
    expect(res.statusCode).toBe(200);
    expect(res.json().questions.length).toBe(2);
  });

  it('couples can ANSWER their own event forms (was 403 — events.edit-only)', async () => {
    const s = await setup();
    const put = await app.inject({ method: 'PUT', url: `/api/events/${s.eventId}/answers/${s.questionId}`,
      payload: { answer: 'Garden ceremony with arbor' },
      headers: { authorization: `Bearer ${s.coupleToken}`, 'content-type': 'application/json' } });
    expect(put.statusCode).toBe(200);
    expect(put.json().answer.answer).toBe('Garden ceremony with arbor');
    expect(put.json().answer.question_id).toBe(s.questionId);

    const answers = await app.inject({ method: 'GET', url: `/api/events/${s.eventId}/answers`,
      headers: { authorization: `Bearer ${s.coupleToken}` } });
    expect(answers.json().answers).toHaveLength(1);
  });

  it('the venue can view the couple answers', async () => {
    const s = await setup();
    await app.inject({ method: 'PUT', url: `/api/events/${s.eventId}/answers/${s.questionId}`,
      payload: { answer: 'Outdoor lawn' },
      headers: { authorization: `Bearer ${s.coupleToken}`, 'content-type': 'application/json' } });
    const res = await app.inject({ method: 'GET', url: `/api/events/${s.eventId}/answers`,
      headers: { authorization: `Bearer ${s.ownerToken}` } });
    expect(res.statusCode).toBe(200);
    expect(res.json().answers[0].answer).toBe('Outdoor lawn');
  });

  it('strangers cannot read questions or answers', async () => {
    const s = await setup();
    const strangerReg = await app.inject({ method: 'POST', url: '/api/auth/register',
      payload: { email: `q-stranger-${Math.random().toString(36).slice(2)}@x.com`, password: 'testpass123', fullName: 'Stranger', orgName: 'Tmp' },
      headers: { 'content-type': 'application/json' } });
    const strangerToken = strangerReg.json().token;
    const q = await app.inject({ method: 'GET', url: `/api/events/${s.eventId}/questions`,
      headers: { authorization: `Bearer ${strangerToken}` } });
    expect([403, 404]).toContain(q.statusCode);
    const a = await app.inject({ method: 'GET', url: `/api/events/${s.eventId}/answers`,
      headers: { authorization: `Bearer ${strangerToken}` } });
    expect([403, 404]).toContain(a.statusCode);
    const put = await app.inject({ method: 'PUT', url: `/api/events/${s.eventId}/answers/${s.questionId}`,
      payload: { answer: 'hack' },
      headers: { authorization: `Bearer ${strangerToken}`, 'content-type': 'application/json' } });
    expect([403, 404]).toContain(put.statusCode);
  });
});
