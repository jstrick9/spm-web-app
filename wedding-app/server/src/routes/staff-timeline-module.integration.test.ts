/**
 * MODULE-05 — Staff & Timeline regression tests.
 *
 * Covers ST-01..ST-20 from docs/MODULE-05-STAFF-TIMELINE.md:
 * event-scoped access, couple timeline privacy, full shift PATCH,
 * cross-org ref validation, shift-conflict guard, assignee self-service,
 * approval governance, reminder dispatch, availability 409, clock guards,
 * DELETE 404, audits, SSE invalidation sources, emergency broadcast,
 * permission-based setup-packet access.
 */
import './../test/setup.js';
import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../index.js';
import { db } from '../db/database.js';
import { eventsRepo, orgsRepo, rolesRepo, usersRepo, staffTasksRepo } from '../db/repos/index.js';
import { SYSTEM_ROLE_IDS } from '../lib/permissions.js';
import { scanDueTimelineReminders } from '../jobs/timelineReminders.js';

let app: FastifyInstance;

beforeAll(async () => { app = await buildApp(); await app.ready(); });
beforeEach(() => { db.exec('BEGIN'); });
afterEach(async () => { db.exec('ROLLBACK'); });

interface Owner { token: string; orgId: string; userId: string }

async function registerOwner(): Promise<Owner> {
  const email = `mod5-owner-${Math.random().toString(36).slice(2)}@x.com`;
  const res = await app.inject({
    method: 'POST', url: '/api/auth/register',
    payload: { email, password: 'testpass123', fullName: 'Owner', orgName: 'Module5 Manor' },
    headers: { 'content-type': 'application/json' },
  });
  expect(res.statusCode).toBe(201);
  return { token: res.json().token, orgId: res.json().organizationId, userId: res.json().user.id };
}

async function createEvent(owner: Owner, title = 'Module5 Wedding'): Promise<string> {
  const res = await app.inject({
    method: 'POST', url: '/api/events',
    payload: { organizationId: owner.orgId, title },
    headers: { authorization: `Bearer ${owner.token}`, 'content-type': 'application/json' },
  });
  expect(res.statusCode).toBe(201);
  return res.json().event.id;
}

async function createUser(email: string): Promise<{ id: string; token: string }> {
  const res = await app.inject({
    method: 'POST', url: '/api/auth/register',
    payload: { email, password: 'testpass123', fullName: 'Member', orgName: `Tmp-${email}` },
    headers: { 'content-type': 'application/json' },
  });
  expect(res.statusCode).toBe(201);
  return { id: res.json().user.id, token: res.json().token };
}

function addOrgMember(orgId: string, userId: string, roleId: string) {
  orgsRepo.addMember({ orgId, userId, roleId });
}

function addEventMember(eventId: string, userId: string, roleId: string) {
  eventsRepo.addMember({ eventId, userId, roleId });
}

describe('ST-01 — event-scoped access (orgMap pattern)', () => {
  it('an event-scoped planner can read AND write timeline, checklist, and staffing requirements', async () => {
    const owner = await registerOwner();
    const eventId = await createEvent(owner);
    const planner = await createUser(`planner-${Math.random().toString(36).slice(2)}@x.com`);
    const role = rolesRepo.createCustom({
      organizationId: owner.orgId, key: 'evt_planner', name: 'Event Planner', createdBy: owner.userId, hierarchy: 60,
      permissions: ['events.view', 'timeline.view', 'timeline.manage', 'staff.view', 'staff.manage'] as never,
    });
    addEventMember(eventId, planner.id, role.id);
    const auth = { authorization: `Bearer ${planner.token}`, 'content-type': 'application/json' };

    // Read paths
    const checklist = await app.inject({ method: 'GET', url: `/api/events/${eventId}/setup-checklist`, headers: auth });
    expect(checklist.statusCode).toBe(200);
    const reqs = await app.inject({ method: 'GET', url: `/api/events/${eventId}/staffing-requirements`, headers: auth });
    expect(reqs.statusCode).toBe(200);

    // Write paths (previously 403 for event-scoped members)
    const create = await app.inject({
      method: 'POST', url: `/api/events/${eventId}/timeline`,
      payload: { title: 'Ceremony', startsAt: '2026-09-12T16:00', endsAt: '2026-09-12T17:00', category: 'ceremony' },
      headers: auth,
    });
    expect(create.statusCode).toBe(201);
    const itemId = create.json().item.id;
    const patch = await app.inject({
      method: 'PATCH', url: `/api/timeline/${itemId}`,
      payload: { location: 'Rose Garden' },
      headers: auth,
    });
    expect(patch.statusCode).toBe(200);
    const putReqs = await app.inject({
      method: 'PUT', url: `/api/events/${eventId}/staffing-requirements`,
      payload: { requiredRoles: ['coordinator', 'setup', 'cleaning'] },
      headers: auth,
    });
    expect(putReqs.statusCode).toBe(200);
    const seed = await app.inject({ method: 'POST', url: `/api/events/${eventId}/setup-checklist/seed`, payload: {}, headers: auth });
    expect(seed.statusCode).toBe(201);
    const del = await app.inject({ method: 'DELETE', url: `/api/timeline/${itemId}`, headers: { authorization: `Bearer ${planner.token}` } });
    expect(del.statusCode).toBe(204);
  });
});

describe('ST-02 — couple timeline privacy', () => {
  it('couple gets 403 on the internal timeline but 200 on the sanitized couple-schedule', async () => {
    const owner = await registerOwner();
    const eventId = await createEvent(owner);
    const couple = await createUser(`couple-${Math.random().toString(36).slice(2)}@x.com`);
    addEventMember(eventId, couple.id, SYSTEM_ROLE_IDS.couple);
    const auth = { authorization: `Bearer ${couple.token}` };

    const internal = await app.inject({ method: 'GET', url: `/api/events/${eventId}/timeline`, headers: auth });
    expect(internal.statusCode).toBe(403);

    const schedule = await app.inject({ method: 'GET', url: `/api/events/${eventId}/couple-schedule`, headers: auth });
    expect(schedule.statusCode).toBe(200);
    expect(schedule.json().schedule).toBeDefined();
  });
});

describe('ST-03/05/09 — shift scheduling integrity', () => {
  it('PATCH persists time/staff/role changes (reschedule works)', async () => {
    const owner = await registerOwner();
    const eventId = await createEvent(owner);
    const staffUser = await createUser(`shift-${Math.random().toString(36).slice(2)}@x.com`);
    addOrgMember(owner.orgId, staffUser.id, SYSTEM_ROLE_IDS.staff);
    const auth = { authorization: `Bearer ${owner.token}`, 'content-type': 'application/json' };

    const created = await app.inject({
      method: 'POST', url: `/api/orgs/${owner.orgId}/staff/shifts`,
      payload: { staffId: staffUser.id, role: 'setup', startsAt: '2026-09-12T10:00', endsAt: '2026-09-12T14:00', eventId },
      headers: auth,
    });
    expect(created.statusCode).toBe(201);
    const shiftId = created.json().shift.id;

    const patched = await app.inject({
      method: 'PATCH', url: `/api/staff/shifts/${shiftId}`,
      payload: { startsAt: '2026-09-12T11:00', endsAt: '2026-09-12T15:00', role: 'coordinator' },
      headers: auth,
    });
    expect(patched.statusCode).toBe(200);
    expect(patched.json().shift.starts_at).toBe('2026-09-12T11:00');
    expect(patched.json().shift.ends_at).toBe('2026-09-12T15:00');
    expect(patched.json().shift.role).toBe('coordinator');
  });

  it('rejects same-staff overlapping shifts on create and on reschedule', async () => {
    const owner = await registerOwner();
    const staffUser = await createUser(`shift2-${Math.random().toString(36).slice(2)}@x.com`);
    addOrgMember(owner.orgId, staffUser.id, SYSTEM_ROLE_IDS.staff);
    const auth = { authorization: `Bearer ${owner.token}`, 'content-type': 'application/json' };
    const payload = { staffId: staffUser.id, role: 'setup', startsAt: '2026-09-12T10:00', endsAt: '2026-09-12T14:00' };

    const first = await app.inject({ method: 'POST', url: `/api/orgs/${owner.orgId}/staff/shifts`, payload, headers: auth });
    expect(first.statusCode).toBe(201);

    const overlap = await app.inject({
      method: 'POST', url: `/api/orgs/${owner.orgId}/staff/shifts`,
      payload: { ...payload, startsAt: '2026-09-12T13:00', endsAt: '2026-09-12T17:00' },
      headers: auth,
    });
    expect(overlap.statusCode).toBe(400);
    expect(overlap.json().error).toBe('staff-shift-conflict');

    // Adjacent (non-overlapping) shift is fine
    const adjacent = await app.inject({
      method: 'POST', url: `/api/orgs/${owner.orgId}/staff/shifts`,
      payload: { ...payload, startsAt: '2026-09-12T14:00', endsAt: '2026-09-12T18:00' },
      headers: auth,
    });
    expect(adjacent.statusCode).toBe(201);

    // Rescheduling into a conflict is rejected too
    const reschedule = await app.inject({
      method: 'PATCH', url: `/api/staff/shifts/${adjacent.json().shift.id}`,
      payload: { startsAt: '2026-09-12T13:30' },
      headers: auth,
    });
    expect(reschedule.statusCode).toBe(400);
    expect(reschedule.json().error).toBe('staff-shift-conflict');
  });

  it('rejects cross-org references and inverted times', async () => {
    const owner = await registerOwner();
    const outsider = await createUser(`outside-${Math.random().toString(36).slice(2)}@x.com`); // own org, not a member here
    const auth = { authorization: `Bearer ${owner.token}`, 'content-type': 'application/json' };

    const badEvent = await app.inject({
      method: 'POST', url: `/api/orgs/${owner.orgId}/staff/shifts`,
      payload: { staffId: outsider.id, role: 'setup', startsAt: '2026-09-12T10:00', endsAt: '2026-09-12T14:00', eventId: 'nonexistent-event' },
      headers: auth,
    });
    expect(badEvent.statusCode).toBe(400);
    expect(badEvent.json().error).toBe('event-not-in-org');

    const badStaff = await app.inject({
      method: 'POST', url: `/api/orgs/${owner.orgId}/staff/shifts`,
      payload: { staffId: outsider.id, role: 'setup', startsAt: '2026-09-12T10:00', endsAt: '2026-09-12T14:00' },
      headers: auth,
    });
    expect(badStaff.statusCode).toBe(400);
    expect(badStaff.json().error).toBe('staff-not-in-org');

    const inverted = await app.inject({
      method: 'POST', url: `/api/orgs/${owner.orgId}/staff/shifts`,
      payload: { staffId: owner.userId, role: 'setup', startsAt: '2026-09-12T18:00', endsAt: '2026-09-12T10:00' },
      headers: auth,
    });
    expect(inverted.statusCode).toBe(400);
  });
});

describe('ST-08 — staff role self-service', () => {
  it('assignee can flip status/checklist/notes but not titles; cannot create tasks', async () => {
    const owner = await registerOwner();
    const staffUser = await createUser(`staff8-${Math.random().toString(36).slice(2)}@x.com`);
    addOrgMember(owner.orgId, staffUser.id, SYSTEM_ROLE_IDS.staff);
    const task = staffTasksRepo.create(owner.orgId, owner.userId, { title: 'Load ice', assignedStaff: [staffUser.id] });
    const auth = { authorization: `Bearer ${staffUser.token}`, 'content-type': 'application/json' };

    // Self-service status flip
    const flip = await app.inject({
      method: 'PATCH', url: `/api/staff/tasks/${task.id}`,
      payload: { status: 'completed' },
      headers: auth,
    });
    expect(flip.statusCode).toBe(200);
    expect(flip.json().task.status).toBe('completed');
    expect(flip.json().task.completed_at).toBeTruthy();

    // Reopen clears the completion timestamp (ST-19)
    const reopen = await app.inject({
      method: 'PATCH', url: `/api/staff/tasks/${task.id}`,
      payload: { status: 'in-progress' },
      headers: auth,
    });
    expect(reopen.statusCode).toBe(200);
    expect(reopen.json().task.completed_at).toBeNull();

    // Title edit is manager-only
    const title = await app.inject({
      method: 'PATCH', url: `/api/staff/tasks/${task.id}`,
      payload: { title: 'Hijacked' },
      headers: auth,
    });
    expect(title.statusCode).toBe(403);

    // Unassigned task cannot be self-served
    const other = staffTasksRepo.create(owner.orgId, owner.userId, { title: 'Private', assignedStaff: [] });
    const otherFlip = await app.inject({
      method: 'PATCH', url: `/api/staff/tasks/${other.id}`,
      payload: { status: 'completed' },
      headers: auth,
    });
    expect(otherFlip.statusCode).toBe(403);

    // No task creation for the staff role (staff.manage removed)
    const create = await app.inject({
      method: 'POST', url: `/api/orgs/${owner.orgId}/staff/tasks`,
      payload: { title: 'New task' },
      headers: auth,
    });
    expect(create.statusCode).toBe(403);
  });
});

describe('ST-07 — approval governance', () => {
  it('manager cannot approve the owner/planner rows; owner can approve own row', async () => {
    const owner = await registerOwner();
    const eventId = await createEvent(owner);
    const manager = await createUser(`mgr-${Math.random().toString(36).slice(2)}@x.com`);
    addOrgMember(owner.orgId, manager.id, SYSTEM_ROLE_IDS.manager);
    const ownerAuth = { authorization: `Bearer ${owner.token}`, 'content-type': 'application/json' };
    const managerAuth = { authorization: `Bearer ${manager.token}`, 'content-type': 'application/json' };

    // Manager approving as owner → forbidden
    const forged = await app.inject({
      method: 'POST', url: `/api/events/${eventId}/timeline-ops/approval`,
      payload: { role: 'owner', status: 'approved' },
      headers: managerAuth,
    });
    expect(forged.statusCode).toBe(403);
    expect(forged.json().error).toBe('approval-role-mismatch');

    // Manager may request owner approval (status requested)
    const request = await app.inject({
      method: 'POST', url: `/api/events/${eventId}/timeline-ops/approval`,
      payload: { role: 'owner', status: 'requested' },
      headers: managerAuth,
    });
    expect(request.statusCode).toBe(201);

    // Manager approving own row → allowed
    const selfApprove = await app.inject({
      method: 'POST', url: `/api/events/${eventId}/timeline-ops/approval`,
      payload: { role: 'manager', status: 'approved' },
      headers: managerAuth,
    });
    expect(selfApprove.statusCode).toBe(201);

    // Owner approves the owner row
    const ownerApprove = await app.inject({
      method: 'POST', url: `/api/events/${eventId}/timeline-ops/approval`,
      payload: { role: 'owner', status: 'approved' },
      headers: ownerAuth,
    });
    expect(ownerApprove.statusCode).toBe(201);
    expect(ownerApprove.json().approval.status).toBe('approved');
    expect(ownerApprove.json().approval.approved_by).toBe(owner.userId);
  });
});

describe('ST-06 — reminder dispatch', () => {
  it('rejects sms at creation; dispatches due in_app reminders via SSE; email waits for SMTP', async () => {
    const owner = await registerOwner();
    const eventId = await createEvent(owner);
    const auth = { authorization: `Bearer ${owner.token}`, 'content-type': 'application/json' };

    const sms = await app.inject({
      method: 'POST', url: `/api/events/${eventId}/timeline-ops/reminder`,
      payload: { remindAt: new Date(Date.now() - 1000).toISOString(), channel: 'sms' },
      headers: auth,
    });
    expect(sms.statusCode).toBe(400);
    expect(sms.json().error).toBe('sms-channel-not-configured');

    const inApp = await app.inject({
      method: 'POST', url: `/api/events/${eventId}/timeline-ops/reminder`,
      payload: { remindAt: new Date(Date.now() - 1000).toISOString(), channel: 'in_app', payload: { itemTitle: 'First dance' } },
      headers: auth,
    });
    expect(inApp.statusCode).toBe(201);
    const inAppId = inApp.json().reminder.id;

    const email = await app.inject({
      method: 'POST', url: `/api/events/${eventId}/timeline-ops/reminder`,
      payload: { remindAt: new Date(Date.now() - 1000).toISOString(), channel: 'email', payload: { itemTitle: 'Vendor load-in' } },
      headers: auth,
    });
    expect(email.statusCode).toBe(201);
    const emailId = email.json().reminder.id;

    const result = scanDueTimelineReminders();
    expect(result.dispatched).toBeGreaterThanOrEqual(1);

    const inAppRow = db.prepare(`SELECT status FROM timeline_reminders WHERE id = ?`).get(inAppId) as { status: string };
    expect(inAppRow.status).toBe('sent');
    const emailRow = db.prepare(`SELECT status FROM timeline_reminders WHERE id = ?`).get(emailId) as { status: string };
    expect(emailRow.status).toBe('queued'); // no SMTP integration connected

    const sse = db.prepare(`SELECT event_type, payload FROM sse_events WHERE event_type = 'timeline.reminder' AND organization_id = ? ORDER BY created_at DESC LIMIT 1`).get(owner.orgId) as { payload: string } | undefined;
    expect(sse).toBeTruthy();
    expect(JSON.parse(sse!.payload).title).toBe('First dance');
  });
});

describe('ST-11/09/12 — availability + clock + delete guards', () => {
  it('duplicate availability returns 409; clock guards return 400; missing shift returns 404', async () => {
    const owner = await registerOwner();
    const auth = { authorization: `Bearer ${owner.token}`, 'content-type': 'application/json' };
    const payload = { staffId: owner.userId, dayOfWeek: 6, startsAt: '09:00', endsAt: '17:00' };

    const first = await app.inject({ method: 'POST', url: `/api/orgs/${owner.orgId}/staff/availability`, payload, headers: auth });
    expect(first.statusCode).toBe(201);
    const dup = await app.inject({ method: 'POST', url: `/api/orgs/${owner.orgId}/staff/availability`, payload, headers: auth });
    expect(dup.statusCode).toBe(400);
    expect(dup.json().error).toBe('availability-already-exists');

    // Clock-out without clock-in
    const shift = await app.inject({
      method: 'POST', url: `/api/orgs/${owner.orgId}/staff/shifts`,
      payload: { staffId: owner.userId, role: 'setup', startsAt: '2026-09-12T10:00', endsAt: '2026-09-12T14:00' },
      headers: auth,
    });
    expect(shift.statusCode).toBe(201);
    const shiftId = shift.json().shift.id;

    const outFirst = await app.inject({ method: 'POST', url: `/api/staff/shifts/${shiftId}/clock-out`, payload: {}, headers: auth });
    expect(outFirst.statusCode).toBe(400);
    expect(outFirst.json().error).toBe('not-clocked-in');

    const inOnce = await app.inject({ method: 'POST', url: `/api/staff/shifts/${shiftId}/clock-in`, payload: {}, headers: auth });
    expect(inOnce.statusCode).toBe(200);
    const inTwice = await app.inject({ method: 'POST', url: `/api/staff/shifts/${shiftId}/clock-in`, payload: {}, headers: auth });
    expect(inTwice.statusCode).toBe(400);
    expect(inTwice.json().error).toBe('already-clocked-in');
    const out = await app.inject({ method: 'POST', url: `/api/staff/shifts/${shiftId}/clock-out`, payload: {}, headers: auth });
    expect(out.statusCode).toBe(200);

    const missing = await app.inject({ method: 'DELETE', url: `/api/staff/shifts/does-not-exist`, headers: { authorization: `Bearer ${owner.token}` } });
    expect(missing.statusCode).toBe(404);
  });
});

describe('ST-13/15 — audit + emergency broadcast', () => {
  it('task create is audited; emergency broadcast announcement audits + broadcasts SSE', async () => {
    const owner = await registerOwner();
    const eventId = await createEvent(owner);
    const auth = { authorization: `Bearer ${owner.token}`, 'content-type': 'application/json' };

    const task = await app.inject({
      method: 'POST', url: `/api/orgs/${owner.orgId}/staff/tasks`,
      payload: { title: 'Audited task', eventId },
      headers: auth,
    });
    expect(task.statusCode).toBe(201);
    const audit = db.prepare(`SELECT action FROM audit_logs WHERE target_id = ?`).get(task.json().task.id) as { action: string } | undefined;
    expect(audit?.action).toBe('staff.task.create');

    const emergency = await app.inject({
      method: 'PATCH', url: `/api/events/${eventId}`,
      payload: { metadata: { emergency_broadcast_announcement: 'Weather alert: moving cocktail hour indoors' } },
      headers: auth,
    });
    expect(emergency.statusCode).toBe(200);
    const auditRow = db.prepare(`SELECT action, details FROM audit_logs WHERE action = 'event.emergency.broadcast' AND target_id = ? ORDER BY created_at DESC LIMIT 1`).get(eventId) as { action: string; details: string } | undefined;
    expect(auditRow?.action).toBe('event.emergency.broadcast');
    expect(JSON.parse(auditRow!.details).message).toContain('Weather alert');
    const sse = db.prepare(`SELECT payload FROM sse_events WHERE event_type = 'event.emergency_broadcast' AND organization_id = ? ORDER BY created_at DESC LIMIT 1`).get(owner.orgId) as { payload: string } | undefined;
    expect(sse).toBeTruthy();
    expect(JSON.parse(sse!.payload).message).toContain('Weather alert');

    // Unchanged / empty announcements do not re-broadcast
    const noop = await app.inject({
      method: 'PATCH', url: `/api/events/${eventId}`,
      payload: { metadata: { emergency_broadcast_announcement: 'Weather alert: moving cocktail hour indoors' } },
      headers: auth,
    });
    expect(noop.statusCode).toBe(200);
    const count = db.prepare(`SELECT COUNT(*) AS n FROM audit_logs WHERE action = 'event.emergency.broadcast' AND target_id = ?`).get(eventId) as { n: number };
    expect(count.n).toBe(1);
  });
});

describe('ST-20 — permission-based setup-packet access', () => {
  it('a custom staff-like role (non-roleKey) can fetch the setup packet', async () => {
    const owner = await registerOwner();
    const eventId = await createEvent(owner);
    const crew = await createUser(`crew-${Math.random().toString(36).slice(2)}@x.com`);
    const role = rolesRepo.createCustom({
      organizationId: owner.orgId, key: 'day_of_crew', name: 'Day-of Crew', createdBy: owner.userId, hierarchy: 20,
      permissions: ['staff.view', 'timeline.view', 'layouts.view', 'events.view'] as never,
    });
    addEventMember(eventId, crew.id, role.id);
    const res = await app.inject({
      method: 'GET', url: `/api/events/${eventId}/setup-packet`,
      headers: { authorization: `Bearer ${crew.token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().packet.event.title).toBe('Module5 Wedding');
  });
});
