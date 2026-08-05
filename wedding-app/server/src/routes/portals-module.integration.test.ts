/**
 * MODULE-07 — Guest & Couple Portals regression tests.
 *
 * Covers CP-01..CP-07 from docs/MODULE-07-GUEST-COUPLE-PORTALS.md:
 * couple-write authorization, pure GETs, SSE broadcasts, document
 * delete + version file cleanup, partner/planner invites for unregistered
 * emails, and the guest help-request SLA breach scan.
 */
import './../test/setup.js';
import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { existsSync } from 'node:fs';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../index.js';
import { db } from '../db/database.js';
import { eventsRepo, orgsRepo, guestsRepo, couplePlanningRepo } from '../db/repos/index.js';
import { SYSTEM_ROLE_IDS } from '../lib/permissions.js';
import { privateFilePath } from '../lib/fileStorage.js';
import { scanGuestHelpSlaBreaches } from '../jobs/guestHelpSla.js';

let app: FastifyInstance;

beforeAll(async () => { app = await buildApp(); await app.ready(); });
beforeEach(() => { db.exec('BEGIN'); });
afterEach(async () => { db.exec('ROLLBACK'); });

interface Owner { token: string; orgId: string; userId: string }

async function registerOwner(): Promise<Owner> {
  const email = `mod7-owner-${Math.random().toString(36).slice(2)}@x.com`;
  const res = await app.inject({
    method: 'POST', url: '/api/auth/register',
    payload: { email, password: 'testpass123', fullName: 'Owner', orgName: 'Module7 Manor' },
    headers: { 'content-type': 'application/json' },
  });
  expect(res.statusCode).toBe(201);
  return { token: res.json().token, orgId: res.json().organizationId, userId: res.json().user.id };
}

async function createEvent(owner: Owner, title = 'Module7 Wedding'): Promise<string> {
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

function sseCount(orgId: string, eventType: string): number {
  return (db.prepare(`SELECT COUNT(*) AS n FROM sse_events WHERE organization_id = ? AND event_type = ?`).get(orgId, eventType) as { n: number }).n;
}

describe('CP-01 — couple-write authorization', () => {
  it('staff (events.view only) is blocked; couple and planner can write', async () => {
    const owner = await registerOwner();
    const eventId = await createEvent(owner);
    const couple = await createUser(`cp7-couple-${Math.random().toString(36).slice(2)}@x.com`);
    addEventMember(eventId, couple.id, SYSTEM_ROLE_IDS.couple);
    const staff = await createUser(`cp7-staff-${Math.random().toString(36).slice(2)}@x.com`);
    addOrgMember(owner.orgId, staff.id, SYSTEM_ROLE_IDS.staff);
    const planner = await createUser(`cp7-planner-${Math.random().toString(36).slice(2)}@x.com`);
    addOrgMember(owner.orgId, planner.id, SYSTEM_ROLE_IDS.planner);
    const staffAuth = { authorization: `Bearer ${staff.token}`, 'content-type': 'application/json' };
    const coupleAuth = { authorization: `Bearer ${couple.token}`, 'content-type': 'application/json' };
    const plannerAuth = { authorization: `Bearer ${planner.token}`, 'content-type': 'application/json' };

    // Couple profile
    const staffProfile = await app.inject({ method: 'PATCH', url: `/api/events/${eventId}/couple-profile`, payload: { names: 'Hacked' }, headers: staffAuth });
    expect(staffProfile.statusCode).toBe(403);
    const coupleProfile = await app.inject({ method: 'PATCH', url: `/api/events/${eventId}/couple-profile`, payload: { names: 'Jane & Alex' }, headers: coupleAuth });
    expect(coupleProfile.statusCode).toBe(200);

    // Design preferences
    const staffDesign = await app.inject({ method: 'PATCH', url: `/api/events/${eventId}/couple-design`, payload: { colorScheme: 'x' }, headers: staffAuth });
    expect(staffDesign.statusCode).toBe(403);
    const plannerDesign = await app.inject({ method: 'PATCH', url: `/api/events/${eventId}/couple-design`, payload: { colorScheme: 'sage' }, headers: plannerAuth });
    expect(plannerDesign.statusCode).toBe(200);

    // Advanced planning
    const staffAdvanced = await app.inject({ method: 'PATCH', url: `/api/events/${eventId}/couple-advanced-planning`, payload: { ceremony: { location: 'x' } }, headers: staffAuth });
    expect(staffAdvanced.statusCode).toBe(403);
    const coupleAdvanced = await app.inject({ method: 'PATCH', url: `/api/events/${eventId}/couple-advanced-planning`, payload: { ceremony: { location: 'Rose Garden' } }, headers: coupleAuth });
    expect(coupleAdvanced.statusCode).toBe(200);

    // Planning task update
    const task = couplePlanningRepo.ensureDefaults({ organizationId: owner.orgId, eventId })[0];
    const staffTask = await app.inject({ method: 'PATCH', url: `/api/events/${eventId}/couple-planning/${task.id}`, payload: { status: 'completed' }, headers: staffAuth });
    expect(staffTask.statusCode).toBe(403);
    const coupleTask = await app.inject({ method: 'PATCH', url: `/api/events/${eventId}/couple-planning/${task.id}`, payload: { status: 'in_progress' }, headers: coupleAuth });
    expect(coupleTask.statusCode).toBe(200);

    // Notification preferences
    const staffPrefs = await app.inject({ method: 'PATCH', url: `/api/events/${eventId}/couple-notification-preferences`, payload: { emailEnabled: false }, headers: staffAuth });
    expect(staffPrefs.statusCode).toBe(403);
    const couplePrefs = await app.inject({ method: 'PATCH', url: `/api/events/${eventId}/couple-notification-preferences`, payload: { emailEnabled: true }, headers: coupleAuth });
    expect(couplePrefs.statusCode).toBe(200);

    // Couple requests creation
    const staffRequest = await app.inject({ method: 'POST', url: `/api/events/${eventId}/couple-requests`, payload: { requestType: 'venue_question', note: 'x' }, headers: staffAuth });
    expect(staffRequest.statusCode).toBe(403);
    const coupleRequest = await app.inject({ method: 'POST', url: `/api/events/${eventId}/couple-requests`, payload: { requestType: 'venue_question', note: 'Is the garden available?' }, headers: coupleAuth });
    expect(coupleRequest.statusCode).toBe(201);
    expect(sseCount(owner.orgId, 'couple.request_created')).toBe(1);

    // Guest seating
    const guest = guestsRepo.create(owner.orgId, eventId, { fullName: 'Aunt Mary', email: 'mary@example.com' } as never);
    const staffSeating = await app.inject({ method: 'PATCH', url: `/api/events/${eventId}/couple-guests/${guest.id}/seating`, payload: { tableAssignment: 'T1' }, headers: staffAuth });
    expect(staffSeating.statusCode).toBe(403);
    const coupleSeating = await app.inject({ method: 'PATCH', url: `/api/events/${eventId}/couple-guests/${guest.id}/seating`, payload: { tableAssignment: 'T1' }, headers: coupleAuth });
    expect(coupleSeating.statusCode).toBe(200);

    // Documents upload
    const staffDoc = await app.inject({
      method: 'POST', url: `/api/events/${eventId}/couple-documents`,
      payload: { filename: 'x.pdf', dataUri: 'data:application/pdf;base64,JVBERi0xLjQ=', mimeType: 'application/pdf', category: 'other' },
      headers: staffAuth,
    });
    expect(staffDoc.statusCode).toBe(403);

    // Visibility enforcement on read: the couple uploads a private doc and
    // a couple_venue doc; venue staff must NOT see/read the private one.
    const privateDoc = await app.inject({
      method: 'POST', url: `/api/events/${eventId}/couple-documents`,
      payload: { filename: 'private.pdf', dataUri: 'data:application/pdf;base64,JVBERi0xLjQ=', mimeType: 'application/pdf', category: 'insurance', visibility: 'couple' },
      headers: coupleAuth,
    });
    expect(privateDoc.statusCode).toBe(201);
    const sharedDoc = await app.inject({
      method: 'POST', url: `/api/events/${eventId}/couple-documents`,
      payload: { filename: 'shared.pdf', dataUri: 'data:application/pdf;base64,JVBERi0xLjQ=', mimeType: 'application/pdf', category: 'menu', visibility: 'couple_venue' },
      headers: coupleAuth,
    });
    expect(sharedDoc.statusCode).toBe(201);

    const staffList = await app.inject({ method: 'GET', url: `/api/events/${eventId}/couple-documents`, headers: { authorization: `Bearer ${staff.token}` } });
    expect(staffList.statusCode).toBe(200);
    const staffNames = staffList.json().documents.map((d: any) => d.filename);
    expect(staffNames).toContain('shared.pdf');
    expect(staffNames).not.toContain('private.pdf');

    const staffReadPrivate = await app.inject({ method: 'GET', url: `/api/events/${eventId}/couple-documents/${privateDoc.json().document.id}/content`, headers: { authorization: `Bearer ${staff.token}` } });
    expect(staffReadPrivate.statusCode).toBe(404);
    const staffReadShared = await app.inject({ method: 'GET', url: `/api/events/${eventId}/couple-documents/${sharedDoc.json().document.id}/content`, headers: { authorization: `Bearer ${staff.token}` } });
    expect(staffReadShared.statusCode).toBe(200);

    // The couple still sees both.
    const coupleList = await app.inject({ method: 'GET', url: `/api/events/${eventId}/couple-documents`, headers: coupleAuth });
    expect(coupleList.json().documents.map((d: any) => d.filename)).toEqual(expect.arrayContaining(['private.pdf', 'shared.pdf']));
  });
});

describe('CP-04 — pure notification-preferences GET', () => {
  it('GET does not create a row; PATCH creates it', async () => {
    const owner = await registerOwner();
    const eventId = await createEvent(owner);
    const couple = await createUser(`cp7b-${Math.random().toString(36).slice(2)}@x.com`);
    addEventMember(eventId, couple.id, SYSTEM_ROLE_IDS.couple);
    const auth = { authorization: `Bearer ${couple.token}` };

    const get1 = await app.inject({ method: 'GET', url: `/api/events/${eventId}/couple-notification-preferences`, headers: auth });
    expect(get1.statusCode).toBe(200);
    expect(get1.json().preferences.id).toBeNull();
    const countBefore = (db.prepare(`SELECT COUNT(*) AS n FROM couple_notification_preferences WHERE event_id = ?`).get(eventId) as { n: number }).n;
    expect(countBefore).toBe(0);

    const patch = await app.inject({
      method: 'PATCH', url: `/api/events/${eventId}/couple-notification-preferences`,
      payload: { emailEnabled: false },
      headers: { authorization: `Bearer ${couple.token}`, 'content-type': 'application/json' },
    });
    expect(patch.statusCode).toBe(200);
    const countAfter = (db.prepare(`SELECT COUNT(*) AS n FROM couple_notification_preferences WHERE event_id = ?`).get(eventId) as { n: number }).n;
    expect(countAfter).toBe(1);
  });
});

describe('CP-05 — document delete + version file cleanup', () => {
  it('upload → delete removes row, asset, and backing file', async () => {
    const owner = await registerOwner();
    const eventId = await createEvent(owner);
    const couple = await createUser(`cp7c-${Math.random().toString(36).slice(2)}@x.com`);
    addEventMember(eventId, couple.id, SYSTEM_ROLE_IDS.couple);
    const auth = { authorization: `Bearer ${couple.token}`, 'content-type': 'application/json' };

    const uploaded = await app.inject({
      method: 'POST', url: `/api/events/${eventId}/couple-documents`,
      payload: { filename: 'menu.pdf', dataUri: 'data:application/pdf;base64,JVBERi0xLjQK', mimeType: 'application/pdf', category: 'menu' },
      headers: auth,
    });
    expect(uploaded.statusCode).toBe(201);
    const docId = uploaded.json().document.id;
    const url = db.prepare(`SELECT url FROM couple_documents WHERE id = ?`).get(docId) as { url: string };
    const path = privateFilePath(url.url)!;
    expect(existsSync(path)).toBe(true);

    const del = await app.inject({ method: 'DELETE', url: `/api/events/${eventId}/couple-documents/${docId}`, headers: { authorization: `Bearer ${couple.token}` } });
    expect(del.statusCode).toBe(204);
    expect(db.prepare(`SELECT 1 FROM couple_documents WHERE id = ?`).get(docId)).toBeUndefined();
    expect(existsSync(path)).toBe(false);
    expect(sseCount(owner.orgId, 'couple.document_deleted')).toBe(1);

    // Staff cannot delete
    const staff = await createUser(`cp7d-${Math.random().toString(36).slice(2)}@x.com`);
    addOrgMember(owner.orgId, staff.id, SYSTEM_ROLE_IDS.staff);
    const uploaded2 = await app.inject({
      method: 'POST', url: `/api/events/${eventId}/couple-documents`,
      payload: { filename: 'b.pdf', dataUri: 'data:application/pdf;base64,JVBERi0xLjQK', mimeType: 'application/pdf', category: 'other' },
      headers: auth,
    });
    const staffDel = await app.inject({ method: 'DELETE', url: `/api/events/${eventId}/couple-documents/${uploaded2.json().document.id}`, headers: { authorization: `Bearer ${staff.token}` } });
    expect(staffDel.statusCode).toBe(403);
  });

  it('versioning deletes the superseded file', async () => {
    const owner = await registerOwner();
    const eventId = await createEvent(owner);
    const couple = await createUser(`cp7e-${Math.random().toString(36).slice(2)}@x.com`);
    addEventMember(eventId, couple.id, SYSTEM_ROLE_IDS.couple);
    const auth = { authorization: `Bearer ${couple.token}`, 'content-type': 'application/json' };

    const uploaded = await app.inject({
      method: 'POST', url: `/api/events/${eventId}/couple-documents`,
      payload: { filename: 'v1.pdf', dataUri: 'data:application/pdf;base64,JVBERi0xLjQK', mimeType: 'application/pdf', category: 'other' },
      headers: auth,
    });
    const docId = uploaded.json().document.id;
    const oldUrl = (db.prepare(`SELECT url FROM couple_documents WHERE id = ?`).get(docId) as { url: string }).url;
    const oldPath = privateFilePath(oldUrl)!;
    expect(existsSync(oldPath)).toBe(true);

    const versioned = await app.inject({
      method: 'POST', url: `/api/events/${eventId}/couple-documents/${docId}/version`,
      payload: { filename: 'v2.pdf', dataUri: 'data:application/pdf;base64,JVBERi0xLjUL', mimeType: 'application/pdf' },
      headers: auth,
    });
    expect(versioned.statusCode).toBe(201);
    expect(existsSync(oldPath)).toBe(false);
    expect((db.prepare(`SELECT version FROM couple_documents WHERE id = ?`).get(docId) as { version: number }).version).toBe(2);
  });
});

describe('CP-07 — partner/planner invitations', () => {
  it('approving a partner invite for an unregistered email creates an event invitation', async () => {
    const owner = await registerOwner();
    const eventId = await createEvent(owner);
    const couple = await createUser(`cp7f-${Math.random().toString(36).slice(2)}@x.com`);
    addEventMember(eventId, couple.id, SYSTEM_ROLE_IDS.couple);
    const partnerEmail = `partner-${Math.random().toString(36).slice(2)}@gmail.com`;

    const created = await app.inject({
      method: 'POST', url: `/api/events/${eventId}/couple-requests`,
      payload: { requestType: 'partner_invite', targetEmail: partnerEmail, targetName: 'Sam Partner', note: 'Invite my partner' },
      headers: { authorization: `Bearer ${couple.token}`, 'content-type': 'application/json' },
    });
    expect(created.statusCode).toBe(201);
    const requestId = created.json().request.id;

    const approved = await app.inject({
      method: 'PATCH', url: `/api/events/${eventId}/couple-requests/${requestId}`,
      payload: { status: 'approved' },
      headers: { authorization: `Bearer ${owner.token}`, 'content-type': 'application/json' },
    });
    expect(approved.statusCode).toBe(200);
    expect(approved.json().invitationToken).toBeTruthy();
    const invite = db.prepare(`SELECT * FROM team_invitations WHERE email = ? AND event_id = ? AND invitation_type = 'event' AND accepted_at IS NULL`).get(partnerEmail, eventId) as { role_id: string } | undefined;
    expect(invite).toBeTruthy();
    expect(invite!.role_id).toBe(SYSTEM_ROLE_IDS.couple);
    expect(sseCount(owner.orgId, 'couple.request_updated')).toBe(1);
  });

  it('approving a partner invite for a registered email adds the membership directly', async () => {
    const owner = await registerOwner();
    const eventId = await createEvent(owner);
    const couple = await createUser(`cp7g-${Math.random().toString(36).slice(2)}@x.com`);
    addEventMember(eventId, couple.id, SYSTEM_ROLE_IDS.couple);
    const partnerEmail = `existing-partner-${Math.random().toString(36).slice(2)}@x.com`;
    const partner = await createUser(partnerEmail);

    const created = await app.inject({
      method: 'POST', url: `/api/events/${eventId}/couple-requests`,
      payload: { requestType: 'partner_invite', targetEmail: partnerEmail, targetName: 'Existing Partner', note: 'Invite' },
      headers: { authorization: `Bearer ${couple.token}`, 'content-type': 'application/json' },
    });
    const approved = await app.inject({
      method: 'PATCH', url: `/api/events/${eventId}/couple-requests/${created.json().request.id}`,
      payload: { status: 'approved' },
      headers: { authorization: `Bearer ${owner.token}`, 'content-type': 'application/json' },
    });
    expect(approved.statusCode).toBe(200);
    expect(approved.json().invitationToken).toBeNull();
    const member = db.prepare(`SELECT role_id FROM event_memberships WHERE event_id = ? AND user_id = ? AND status = 'active'`).get(eventId, partner.id) as { role_id: string } | undefined;
    expect(member?.role_id).toBe(SYSTEM_ROLE_IDS.couple);
  });
});

describe('CP-02/CP-06 — audit hygiene + SLA scan', () => {
  it('couple GETs no longer write view audits; SLA scan flags overdue help requests once', async () => {
    const owner = await registerOwner();
    const eventId = await createEvent(owner);
    const couple = await createUser(`cp7h-${Math.random().toString(36).slice(2)}@x.com`);
    addEventMember(eventId, couple.id, SYSTEM_ROLE_IDS.couple);
    const auth = { authorization: `Bearer ${couple.token}` };

    const before = (db.prepare(`SELECT COUNT(*) AS n FROM audit_logs WHERE action = 'couple.advanced_planning.view'`).get() as { n: number }).n;
    await app.inject({ method: 'GET', url: `/api/events/${eventId}/couple-advanced-planning`, headers: auth });
    const after = (db.prepare(`SELECT COUNT(*) AS n FROM audit_logs WHERE action = 'couple.advanced_planning.view'`).get() as { n: number }).n;
    expect(after).toBe(before);

    // Overdue help request (SLA passed)
    db.prepare(`INSERT INTO guest_help_requests (id, organization_id, event_id, guest_id, kind, name, email, message, status, sla_due_at, created_ip, user_agent)
                VALUES ('sla-1', ?, ?, NULL, 'other', 'Guest', 'g@example.com', 'Need help', 'open', ?, '1.2.3.4', 'test')`)
      .run(owner.orgId, eventId, new Date(Date.now() - 24 * 3600 * 1000).toISOString());

    const first = scanGuestHelpSlaBreaches();
    expect(first.flagged).toBe(1);
    expect(sseCount(owner.orgId, 'guest_help.sla_breach')).toBe(1);
    const auditRow = db.prepare(`SELECT 1 FROM audit_logs WHERE action = 'guest_help.sla_breach' AND target_id = 'sla-1'`).get();
    expect(auditRow).toBeTruthy();

    // Second scan must not re-flag (dedupe)
    const second = scanGuestHelpSlaBreaches();
    expect(second.flagged).toBe(0);
    expect(sseCount(owner.orgId, 'guest_help.sla_breach')).toBe(1);
  });
});
