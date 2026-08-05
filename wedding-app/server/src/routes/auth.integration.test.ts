import './../test/setup.js';
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { db } from '../db/database.js';
import { buildApp } from '../index.js';
import type { FastifyInstance } from 'fastify';
import { integrationsRepo, layoutsRepo, rolesRepo, teamInvitationsRepo, timelineRepo, subEventsRepo } from '../db/repos/index.js';
import { sealSecret } from '../lib/secrets.js';

let app: FastifyInstance;
beforeAll(async () => { app = await buildApp(); await app.ready(); });

beforeEach(() => {
  for (const t of [
    'invite_tracking','vendor_checkins','gallery_images','inventory_items','contracts',
    'budget_items','job_queue','integration_events','integrations','webhook_deliveries','webhooks','push_subscriptions','sse_events',
    'audit_logs','password_reset_tokens','direct_messages','event_answers','event_questions',
    'staff_shifts','staff_areas','staff_tasks','timeline_events',
    'vendor_payments','vendors','decor_packages','decor_arrangements',
    'decor_categories','decor_items','guest_portal_configs','rsvp_submissions',
    'guest_sub_event_invitations','guests','layout_versions','layouts',
    'catalog_items','venues','sub_events','event_memberships','events',
    'team_invitations','organization_memberships','organizations','users',
  ]) { try { db.prepare(`DELETE FROM ${t}`).run(); } catch {} }
  try { db.prepare(`DELETE FROM role_permissions WHERE role_id IN (SELECT id FROM roles WHERE is_system = 0)`).run(); db.prepare(`DELETE FROM roles WHERE is_system = 0`).run(); } catch {}
  rolesRepo.ensureSystemRoles();
});

async function register(email?: string) {
  const e = email ?? `auth-${Math.random().toString(36).slice(2)}@x.com`;
  const r = await app.inject({ method: 'POST', url: '/api/auth/register',
    payload: { email: e, password: 'testpass123', fullName: 'Tester', orgName: 'Org' },
    headers: { 'content-type': 'application/json' } });
  return { token: r.json().token, email: e };
}

describe('Auth: password change', () => {
  it('changes password with correct current password', async () => {
    const u = await register();
    const res = await app.inject({ method: 'POST', url: '/api/auth/change-password',
      payload: { currentPassword: 'testpass123', newPassword: 'newpass456789' },
      headers: { authorization: `Bearer ${u.token}`, 'content-type': 'application/json' } });
    expect(res.statusCode).toBe(200);
    expect(res.json().ok).toBe(true);

    // Old token should be invalidated (session version bumped)
    const meRes = await app.inject({ method: 'GET', url: '/api/auth/me',
      headers: { authorization: `Bearer ${u.token}` } });
    expect(meRes.statusCode).toBe(401); // session invalidated

    // Login with new password works
    const loginRes = await app.inject({ method: 'POST', url: '/api/auth/login',
      payload: { email: u.email, password: 'newpass456789' },
      headers: { 'content-type': 'application/json' } });
    expect(loginRes.statusCode).toBe(200);
  });

  it('rejects wrong current password', async () => {
    const u = await register();
    const res = await app.inject({ method: 'POST', url: '/api/auth/change-password',
      payload: { currentPassword: 'wrongpassword', newPassword: 'newpass456789' },
      headers: { authorization: `Bearer ${u.token}`, 'content-type': 'application/json' } });
    expect(res.statusCode).toBe(200);
    expect(res.json().error).toBe('invalid-current-password');
  });

  it('rejects new password too short', async () => {
    const u = await register();
    const res = await app.inject({ method: 'POST', url: '/api/auth/change-password',
      payload: { currentPassword: 'testpass123', newPassword: 'short' },
      headers: { authorization: `Bearer ${u.token}`, 'content-type': 'application/json' } });
    expect(res.statusCode).toBe(400);
  });
});

describe('Auth: password reset', () => {
  it('does not leak whether an email exists', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/password-reset/request',
      payload: { email: 'missing@example.com' },
      headers: { 'content-type': 'application/json' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().ok).toBe(true);
    expect(res.json().resetToken).toBeUndefined();
  });

  it('queues password reset email through connected SMTP integration', async () => {
    const u = await register();
    const orgId = db.prepare('SELECT id FROM organizations LIMIT 1').get() as { id: string };
    const integration = integrationsRepo.upsert({
      organizationId: orgId.id,
      provider: 'email_smtp',
      displayName: 'Test SMTP',
      config: { host: 'smtp.example.com', port: 587, secure: false, fromAddress: 'hello@example.com' },
      secretPayload: sealSecret({ username: 'u', password: 'p' }),
      status: 'connected',
    });

    const requestRes = await app.inject({
      method: 'POST',
      url: '/api/auth/password-reset/request',
      payload: { email: u.email },
      headers: { 'content-type': 'application/json' },
    });
    expect(requestRes.statusCode).toBe(200);

    const job = db.prepare(`SELECT * FROM job_queue WHERE kind = 'email.send'`).get() as any;
    expect(job).toBeTruthy();
    const payload = JSON.parse(job.payload);
    expect(payload.integrationId).toBe(integration.id);
    expect(payload.to).toBe(u.email);
    expect(payload.subject).toContain('Reset');
    expect(payload.text).toContain('/#/reset-password?token=');
    expect(payload.text).not.toContain('undefined');
  });

  it('issues one-time reset token and accepts new password', async () => {
    const u = await register();
    const requestRes = await app.inject({
      method: 'POST',
      url: '/api/auth/password-reset/request',
      payload: { email: u.email },
      headers: { 'content-type': 'application/json' },
    });
    expect(requestRes.statusCode).toBe(200);
    const resetToken = requestRes.json().resetToken;
    expect(typeof resetToken).toBe('string');

    const completeRes = await app.inject({
      method: 'POST',
      url: '/api/auth/password-reset/complete',
      payload: { token: resetToken, newPassword: 'resetpass456' },
      headers: { 'content-type': 'application/json' },
    });
    expect(completeRes.statusCode).toBe(200);
    expect(completeRes.json().ok).toBe(true);

    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: u.email, password: 'resetpass456' },
      headers: { 'content-type': 'application/json' },
    });
    expect(loginRes.statusCode).toBe(200);

    const reuseRes = await app.inject({
      method: 'POST',
      url: '/api/auth/password-reset/complete',
      payload: { token: resetToken, newPassword: 'anotherpass456' },
      headers: { 'content-type': 'application/json' },
    });
    expect(reuseRes.statusCode).toBe(400);
    expect(reuseRes.json().error).toBe('invalid-reset-token');
  });
});

describe('Auth: profile update', () => {
  it('updates full name', async () => {
    const u = await register();
    const res = await app.inject({ method: 'PATCH', url: '/api/auth/profile',
      payload: { fullName: 'New Name' },
      headers: { authorization: `Bearer ${u.token}`, 'content-type': 'application/json' } });
    expect(res.statusCode).toBe(200);
    expect(res.json().user.fullName).toBe('New Name');
  });

  it('updates phone', async () => {
    const u = await register();
    const res = await app.inject({ method: 'PATCH', url: '/api/auth/profile',
      payload: { phone: '555-1234' },
      headers: { authorization: `Bearer ${u.token}`, 'content-type': 'application/json' } });
    expect(res.statusCode).toBe(200);
    expect(res.json().user.phone).toBe('555-1234');
  });

  it('requires auth', async () => {
    const res = await app.inject({ method: 'PATCH', url: '/api/auth/profile',
      payload: { fullName: 'Hacker' },
      headers: { 'content-type': 'application/json' } });
    expect(res.statusCode).toBe(401);
  });
});

describe('Auth: logout', () => {
  it('logout endpoint returns ok', async () => {
    const u = await register();
    const res = await app.inject({ method: 'POST', url: '/api/auth/logout',
      headers: { authorization: `Bearer ${u.token}` } });
    expect(res.statusCode).toBe(200);
    expect(res.json().ok).toBe(true);
  });

  it('exposes safe invite acceptance summary with assigned organization and role', async () => {
    const owner = await register('owner-invite@example.com');
    const org = db.prepare('SELECT id FROM organizations LIMIT 1').get() as { id: string };
    const managerRole = rolesRepo.findByKey(null, 'manager')!;
    const ownerRow = db.prepare('SELECT id FROM users WHERE email = ?').get('owner-invite@example.com') as { id: string };
    const invite = teamInvitationsRepo.create({ organizationId: org.id, email: 'manager@example.com', roleId: managerRole.id, invitedBy: ownerRow.id });

    const res = await app.inject({ method: 'GET', url: `/api/auth/invitations/${invite.token}` });
    expect(res.statusCode).toBe(200);
    expect(res.json().invitation.organizationName).toBe('Org');
    expect(res.json().invitation.roleKey).toBe('manager');
    expect(res.json().invitation.roleName).toBe('Venue Manager');
    expect(res.json().invitation.email).toBe('manager@example.com');
    expect(owner.token).toBeTruthy();
  });

  it('rejects self-selected couple registration without a venue invitation', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/auth/register',
      payload: { email: 'couple-self@example.com', password: 'testpass123', fullName: 'Couple Client', accountRole: 'couple' },
      headers: { 'content-type': 'application/json' } });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('couple-invite-required');
    const orgCount = db.prepare('SELECT COUNT(*) AS n FROM organizations').get() as { n: number };
    expect(orgCount.n).toBe(0);
  });

  it('accepts event-scoped couple invitation into event_memberships only', async () => {
    const owner = await register('owner-couple-invite@example.com');
    const org = db.prepare('SELECT id FROM organizations LIMIT 1').get() as { id: string };
    const ownerRow = db.prepare('SELECT id FROM users WHERE email = ?').get('owner-couple-invite@example.com') as { id: string };
    const eventRes = await app.inject({ method: 'POST', url: '/api/events',
      payload: { organizationId: org.id, title: 'Taylor & Morgan Wedding', status: 'booked', startDate: '2026-09-12' },
      headers: { authorization: `Bearer ${owner.token}`, 'content-type': 'application/json' } });
    const eventId = eventRes.json().event.id;
    timelineRepo.create(org.id, eventId, { title: 'Vendor load-in', category: 'vendor_arrival', startsAt: '2026-09-12T12:00:00', notes: 'Internal only' });
    const ceremony = timelineRepo.create(org.id, eventId, { title: 'Ceremony', category: 'ceremony', startsAt: '2026-09-12T16:30:00', endsAt: '2026-09-12T17:00:00', location: 'Garden Lawn' });
    timelineRepo.create(org.id, eventId, { title: 'Dinner', category: 'reception', startsAt: '2026-09-12T18:30:00', location: 'Ballroom' });
    subEventsRepo.create({ eventId, title: 'Ceremony Rehearsal', startsAt: '2026-09-11T17:00:00', endsAt: '2026-09-11T18:00:00', inviteOnly: true });
    db.prepare(`INSERT INTO contracts (id, organization_id, event_id, title, status, recipient_name, recipient_email, amount_cents, content, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run('contract-couple-1', org.id, eventId, 'Venue Agreement', 'sent', 'Taylor Client', 'couple@example.com', 1000000, 'Payment deposit cancellation refund overtime bar package', ownerRow.id);
    db.prepare(`INSERT INTO payment_links (id, organization_id, event_id, contract_id, provider, amount_cents, status, payment_url, metadata) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run('payment-couple-1', org.id, eventId, 'contract-couple-1', 'manual', 250000, 'pending', 'https://pay.example.test/1', JSON.stringify({ label: 'Deposit', dueDate: '2026-08-01' }));
    const vendor = db.prepare(`INSERT INTO vendors (id, organization_id, event_id, name, category, contact_name, email, phone, is_preferred, metadata) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run('vendor-safe-1', org.id, eventId, 'DJ Co', 'music', 'DJ Sam', 'dj@example.com', '555-2222', 1, JSON.stringify({ coupleBookedStatus: 'booked', coupleConfirmedStatus: 'confirmed', shareArrivalWithCouple: false, coupleVisibleDocuments: [{ title: 'Ceremony music notes', type: 'ceremony_music' }], notesForCouple: 'Music confirmed.' }));
    db.prepare(`INSERT INTO venues (id, organization_id, name, category, environment, capacity, width, height, shape, style, master_layout, metadata, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, '{}', '{}', '{}', '{}', ?)`).run('venue-space-1', org.id, 'Garden Lawn', 'ceremony', 'outdoor', 180, 100, 80, ownerRow.id);
    db.prepare(`INSERT INTO inventory_items (id, organization_id, sku, name, category, total_count, available_count, condition, owner_type, notes, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run('inv-linen-1', org.id, 'LIN-IVORY', 'Ivory Linen', 'linen', 100, 80, 'good', 'venue', 'Couple-visible linen option', ownerRow.id);
    db.prepare(`INSERT INTO catalog_items (id, organization_id, kind, name, spec, visible, sort_order) VALUES (?, ?, 'template', ?, ?, 1, 1)`).run('addon-snack-1', org.id, 'Late-night snack package', JSON.stringify({ estimatedCents: 50000, description: 'Client-visible add-on estimate' }));
    expect(vendor.changes).toBe(1);
    layoutsRepo.create({ organizationId: org.id, eventId, name: 'Reception Layout', approvalStatus: 'pending', createdBy: ownerRow.id, payload: { items: [
      { id: 't1', type: 'round_table', label: 'Table 1', x: 100, y: 100, radius: 40 },
      { id: 's1', type: 'chair', label: 'Seat 1', x: 120, y: 120, radius: 10, guestId: 'missing' },
      { id: 'dance', type: 'dance_floor', label: 'Dance Floor', x: 300, y: 300, width: 120, height: 80 },
      { id: 'ada', type: 'ada_path', label: 'ADA Route', x: 200, y: 200, width: 180, height: 20 },
      { id: 'bar', type: 'bar', label: 'Bar', x: 430, y: 300, width: 80, height: 30 },
    ] } });
    const inviteRes = await app.inject({ method: 'POST', url: `/api/events/${eventId}/couple-invitations`,
      payload: { email: 'couple@example.com' },
      headers: { authorization: `Bearer ${owner.token}`, 'content-type': 'application/json' } });
    expect(inviteRes.statusCode).toBe(201);
    const token = inviteRes.json().token;

    const summary = await app.inject({ method: 'GET', url: `/api/auth/invitations/${token}` });
    expect(summary.statusCode).toBe(200);
    expect(summary.json().invitation.type).toBe('event');
    expect(summary.json().invitation.roleKey).toBe('couple');
    expect(summary.json().invitation.eventTitle).toBe('Taylor & Morgan Wedding');
    expect(summary.json().invitation.eventDate).toBe('2026-09-12');
    expect(summary.json().invitation.accessSummary.cannot).toContain('Access venue administration');

    const reg = await app.inject({ method: 'POST', url: '/api/auth/register',
      payload: { email: 'couple@example.com', password: 'testpass123', fullName: 'Taylor Client', accountRole: 'couple', inviteToken: token },
      headers: { 'content-type': 'application/json' } });
    expect(reg.statusCode).toBe(201);
    expect(reg.json().eventId).toBe(eventId);
    expect(reg.json().redirectTo).toBe(`/couple/events/${eventId}`);
    const coupleGuest = await app.inject({ method: 'POST', url: `/api/events/${eventId}/guests`, payload: { fullName: 'Couple Added Guest', rsvpStatus: 'pending' }, headers: { authorization: `Bearer ${reg.json().token}`, 'content-type': 'application/json' } });
    expect(coupleGuest.statusCode).toBe(201);

    const me = await app.inject({ method: 'GET', url: '/api/auth/me', headers: { authorization: `Bearer ${reg.json().token}` } });
    expect(me.statusCode).toBe(200);
    expect(me.json().memberships).toHaveLength(1);
    expect(me.json().memberships[0].roleKey).toBe('couple');
    expect(me.json().memberships[0].eventId).toBe(eventId);
    expect(me.json().memberships[0].eventOrganizationId).toBe(org.id);
    const orgMembership = db.prepare(`SELECT COUNT(*) AS n FROM organization_memberships WHERE user_id = ?`).get(reg.json().user.id) as { n: number };
    expect(orgMembership.n).toBe(0);
    const eventGet = await app.inject({ method: 'GET', url: `/api/events/${eventId}`, headers: { authorization: `Bearer ${reg.json().token}` } });
    expect(eventGet.statusCode).toBe(200);
    expect(eventGet.json().event.title).toBe('Taylor & Morgan Wedding');

    const magicReq = await app.inject({ method: 'POST', url: '/api/auth/magic-link/request', payload: { email: 'couple@example.com' }, headers: { 'content-type': 'application/json' } });
    expect(magicReq.statusCode).toBe(200);
    expect(magicReq.json().magicToken).toBeTruthy();
    const magicComplete = await app.inject({ method: 'POST', url: '/api/auth/magic-link/complete', payload: { token: magicReq.json().magicToken }, headers: { 'content-type': 'application/json' } });
    expect(magicComplete.statusCode).toBe(200);
    expect(magicComplete.json().redirectTo).toBe(`/couple/events/${eventId}`);

    const identityReq = await app.inject({ method: 'POST', url: `/api/events/${eventId}/couple-requests`,
      payload: { requestType: 'identity_verification', note: 'Unlock contract/payment details' },
      headers: { authorization: `Bearer ${reg.json().token}`, 'content-type': 'application/json' } });
    expect(identityReq.statusCode).toBe(201);
    expect(identityReq.json().request.status).toBe('pending');
    const approveIdentity = await app.inject({ method: 'PATCH', url: `/api/events/${eventId}/couple-requests/${identityReq.json().request.id}`,
      payload: { status: 'approved', note: 'Verified by venue coordinator' },
      headers: { authorization: `Bearer ${owner.token}`, 'content-type': 'application/json' } });
    expect(approveIdentity.statusCode).toBe(200);
    expect(approveIdentity.json().request.status).toBe('approved');

    const profile = await app.inject({ method: 'PATCH', url: `/api/events/${eventId}/couple-profile`,
      payload: { coupleNames: 'Taylor and Morgan', pronouns: 'she/her and they/them', primaryPhone: '555-0100', mailingAddress: '1 Main St', plannerName: 'Pat Planner', vipFamilyContacts: 'Parents and siblings' },
      headers: { authorization: `Bearer ${reg.json().token}`, 'content-type': 'application/json' } });
    expect(profile.statusCode).toBe(200);
    expect(profile.json().profile.coupleNames).toBe('Taylor and Morgan');
    expect(profile.json().lastUpdatedBy).toBe('couple@example.com');
    const profileGet = await app.inject({ method: 'GET', url: `/api/events/${eventId}/couple-profile`, headers: { authorization: `Bearer ${reg.json().token}` } });
    expect(profileGet.json().profile.plannerName).toBe('Pat Planner');

    const changeReq = await app.inject({ method: 'POST', url: `/api/events/${eventId}/couple-requests`,
      payload: { requestType: 'event_change_request', note: 'Guest count changed after family update', metadata: { field: 'Estimated guest count', currentValue: '100', requestedValue: '112' } },
      headers: { authorization: `Bearer ${reg.json().token}`, 'content-type': 'application/json' } });
    expect(changeReq.statusCode).toBe(201);
    expect(changeReq.json().request.requestType).toBe('event_change_request');
    expect(changeReq.json().request.status).toBe('pending');

    const documentUpload = await app.inject({ method: 'POST', url: `/api/events/${eventId}/couple-documents`,
      payload: { filename: 'menu.pdf', dataUri: 'data:application/pdf;base64,JVBERi0xLjQKJcTl8uXrp/Og0MTGCg==', mimeType: 'application/pdf', category: 'menu', visibility: 'couple_venue', notes: 'Tasting menu and allergy notes' },
      headers: { authorization: `Bearer ${reg.json().token}`, 'content-type': 'application/json' } });
    expect(documentUpload.statusCode).toBe(201);
    expect(documentUpload.json().document.url).toBe(`/api/events/${eventId}/couple-documents/${documentUpload.json().document.id}/content`);
    const anonymousDocument = await app.inject({ method: 'GET', url: documentUpload.json().document.url });
    expect(anonymousDocument.statusCode).toBe(401);
    const protectedDocument = await app.inject({ method: 'GET', url: documentUpload.json().document.url, headers: { authorization: `Bearer ${reg.json().token}` } });
    expect(protectedDocument.statusCode).toBe(200);
    expect(documentUpload.json().document.extractedSummary).toContain('menu');
    const documents = await app.inject({ method: 'GET', url: `/api/events/${eventId}/couple-documents`, headers: { authorization: `Bearer ${reg.json().token}` } });
    expect(documents.statusCode).toBe(200);
    expect(documents.json().documents[0].filename).toBe('menu.pdf');
    const updatedDoc = await app.inject({ method: 'PATCH', url: `/api/events/${eventId}/couple-documents/${documentUpload.json().document.id}`, payload: { approvalStatus: 'approved', visibility: 'guest_visible' }, headers: { authorization: `Bearer ${reg.json().token}`, 'content-type': 'application/json' } });
    expect(updatedDoc.statusCode).toBe(200);
    expect(updatedDoc.json().document.approvalStatus).toBe('approved');
    const packetDocs = await app.inject({ method: 'GET', url: `/api/events/${eventId}/couple-documents/final-packet.txt`, headers: { authorization: `Bearer ${reg.json().token}` } });
    expect(packetDocs.statusCode).toBe(200);
    expect(packetDocs.body).toContain('menu.pdf');

    const inbox = await app.inject({ method: 'GET', url: `/api/events/${eventId}/couple-inbox`, headers: { authorization: `Bearer ${reg.json().token}` } });
    expect(inbox.statusCode).toBe(200);
    expect(inbox.json().threads.some((t: any) => t.type === 'venue')).toBe(true);
    expect(inbox.json().templates.some((t: any) => t.id === 'payment')).toBe(true);
    const inboxMsg = await app.inject({ method: 'POST', url: `/api/events/${eventId}/couple-inbox/messages`, payload: { threadType: 'urgent', body: 'Urgent guest accessibility question', urgency: 'urgent' }, headers: { authorization: `Bearer ${reg.json().token}`, 'content-type': 'application/json' } });
    expect(inboxMsg.statusCode).toBe(201);
    const decision = await app.inject({ method: 'POST', url: `/api/events/${eventId}/couple-inbox/decisions`, payload: { title: 'Choose rain plan', detail: 'Need venue decision', dueDate: '2026-09-01' }, headers: { authorization: `Bearer ${reg.json().token}`, 'content-type': 'application/json' } });
    expect(decision.statusCode).toBe(201);
    expect(decision.json().decision.requestType).toBe('decision_needed');
    const prefs = await app.inject({ method: 'PATCH', url: `/api/events/${eventId}/couple-notification-preferences`, payload: { digestFrequency: 'instant', messageAlerts: true }, headers: { authorization: `Bearer ${reg.json().token}`, 'content-type': 'application/json' } });
    expect(prefs.statusCode).toBe(200);
    expect(prefs.json().preferences.digest_frequency).toBe('instant');
    const reminders = await app.inject({ method: 'GET', url: `/api/events/${eventId}/couple-reminders`, headers: { authorization: `Bearer ${reg.json().token}` } });
    expect(reminders.statusCode).toBe(200);
    expect(reminders.json().avoidsInternalLanguage).toBe(true);
    expect(reminders.json().reminders.some((r: any) => r.title.includes('RSVP') || r.title.includes('Payment') || r.title.includes('Document'))).toBe(true);
    const digest = await app.inject({ method: 'POST', url: `/api/events/${eventId}/couple-reminders/digest`, headers: { authorization: `Bearer ${reg.json().token}` } });
    expect(digest.statusCode).toBe(201);
    expect(digest.json().digest).toContain('Wedding planning digest');
    // Honest delivery: no SMTP connected in tests → recorded, not 'sent'.
    expect(digest.json().delivered).toBe(false);
    expect(digest.json().deliveryNote).toBe('recorded_in_history');
    expect(digest.json().sent).toBe(false);

    const appointment = await app.inject({ method: 'POST', url: `/api/events/${eventId}/couple-appointments`, payload: { appointmentType: 'tasting', title: 'Menu Tasting', startsAt: '2026-08-01T14:00:00', endsAt: '2026-08-01T15:00:00', note: 'Prefer Thursday afternoon' }, headers: { authorization: `Bearer ${reg.json().token}`, 'content-type': 'application/json' } });
    expect(appointment.statusCode).toBe(201);
    expect(appointment.json().appointment.appointment_type).toBe('tasting');
    const calendar = await app.inject({ method: 'GET', url: `/api/events/${eventId}/couple-calendar`, headers: { authorization: `Bearer ${reg.json().token}` } });
    expect(calendar.statusCode).toBe(200);
    expect(calendar.json().appointments.length).toBeGreaterThan(0);
    expect(calendar.json().availabilityWindows.tasting).toBeTruthy();
    const reschedule = await app.inject({ method: 'PATCH', url: `/api/events/${eventId}/couple-appointments/${appointment.json().appointment.id}`, payload: { status: 'reschedule_requested', note: 'Need a different day' }, headers: { authorization: `Bearer ${reg.json().token}`, 'content-type': 'application/json' } });
    expect(reschedule.statusCode).toBe(200);
    expect(reschedule.json().appointment.status).toBe('reschedule_requested');
    const signoff = await app.inject({ method: 'POST', url: `/api/events/${eventId}/couple-appointments/${appointment.json().appointment.id}/signoff`, payload: { note: 'Walkthrough complete' }, headers: { authorization: `Bearer ${reg.json().token}`, 'content-type': 'application/json' } });
    expect(signoff.statusCode).toBe(200);
    expect(signoff.json().appointment.status).toBe('completed');
    const calExport = await app.inject({ method: 'GET', url: `/api/events/${eventId}/couple-calendar.ics`, headers: { authorization: `Bearer ${reg.json().token}` } });
    expect(calExport.statusCode).toBe(200);
    expect(calExport.body).toContain('Menu Tasting');

    const designSave = await app.inject({ method: 'PATCH', url: `/api/events/${eventId}/couple-design`,
      payload: { ceremonyStyle: 'Outdoor garden ceremony', rainPlanPreference: 'Indoor chapel backup', colors: 'Ivory and sage', tastingMenuSelections: 'Chicken and vegetarian', allergySummary: 'Nut allergy', photoShotList: 'Family portraits', moodBoardLinks: 'https://example.com/board' },
      headers: { authorization: `Bearer ${reg.json().token}`, 'content-type': 'application/json' } });
    expect(designSave.statusCode).toBe(200);
    expect(designSave.json().preferences.ceremonyStyle).toContain('garden');
    const design = await app.inject({ method: 'GET', url: `/api/events/${eventId}/couple-design`, headers: { authorization: `Bearer ${reg.json().token}` } });
    expect(design.statusCode).toBe(200);
    expect(design.json().progress.percent).toBeGreaterThan(0);
    expect(design.json().aiSummary).toContain('Couple design board summary');
    const designReview = await app.inject({ method: 'POST', url: `/api/events/${eventId}/couple-design/submit-review`, payload: { note: 'Ready for review' }, headers: { authorization: `Bearer ${reg.json().token}`, 'content-type': 'application/json' } });
    expect(designReview.statusCode).toBe(201);
    expect(designReview.json().request.requestType).toBe('design_preferences_review');

    const finance = await app.inject({ method: 'GET', url: `/api/events/${eventId}/couple-finance`, headers: { authorization: `Bearer ${reg.json().token}` } });
    expect(finance.statusCode).toBe(200);
    expect(finance.json().contracts[0].title).toBe('Venue Agreement');
    expect(finance.json().contracts[0].clauseExplainers.length).toBeGreaterThan(0);
    expect(finance.json().payments[0].label).toBe('Deposit');
    expect(finance.json().hiddenFields).toContain('Vendor margins');
    const financeQuestion = await app.inject({ method: 'POST', url: `/api/events/${eventId}/couple-finance/question`, payload: { question: 'Can you explain the deposit?' }, headers: { authorization: `Bearer ${reg.json().token}`, 'content-type': 'application/json' } });
    expect(financeQuestion.statusCode).toBe(201);
    expect(financeQuestion.json().request.requestType).toBe('finance_question');
    const changeOrder = await app.inject({ method: 'POST', url: `/api/events/${eventId}/couple-finance/change-order`, payload: { changeType: 'extra_hour', label: 'Add one extra hour', estimatedAmountCents: 50000 }, headers: { authorization: `Bearer ${reg.json().token}`, 'content-type': 'application/json' } });
    expect(changeOrder.statusCode).toBe(201);
    expect(changeOrder.json().request.requestType).toBe('change_order_request');
    const signed = await app.inject({ method: 'POST', url: `/api/events/${eventId}/couple-finance/contracts/contract-couple-1/sign`, payload: { signature: 'Taylor Client' }, headers: { authorization: `Bearer ${reg.json().token}`, 'content-type': 'application/json' } });
    expect(signed.statusCode).toBe(200);
    expect(signed.json().contract.status).toBe('signed');
    const packet = await app.inject({ method: 'GET', url: `/api/events/${eventId}/couple-finance/packet.txt`, headers: { authorization: `Bearer ${reg.json().token}` } });
    expect(packet.statusCode).toBe(200);
    expect(packet.body).toContain('Venue Agreement');

    const postEventStart = await app.inject({ method: 'GET', url: `/api/events/${eventId}/couple-post-event`, headers: { authorization: `Bearer ${reg.json().token}` } });
    expect(postEventStart.statusCode).toBe(200);
    expect(postEventStart.json().closeoutItems.some((i: any) => i.key === 'feedback')).toBe(true);
    expect(postEventStart.json().hiddenInternalFields).toContain('Incident reports');
    const lostItem = await app.inject({ method: 'POST', url: `/api/events/${eventId}/couple-post-event/lost-item`,
      payload: { itemDescription: 'Gold bracelet', lastSeenLocation: 'bridal suite', contactPreference: 'email', contactValue: 'couple@example.com' },
      headers: { authorization: `Bearer ${reg.json().token}`, 'content-type': 'application/json' } });
    expect(lostItem.statusCode).toBe(201);
    expect(lostItem.json().request.requestType).toBe('post_event_lost_item');
    const survey = await app.inject({ method: 'PATCH', url: `/api/events/${eventId}/couple-post-event/survey`,
      payload: { npsScore: 10, overallRating: 5, whatWentWell: 'The team was wonderful', whatCouldImprove: 'More post-event signage', publicTestimonial: 'Beautiful venue', mayUseTestimonial: true, photoGalleryUrl: 'https://example.com/gallery', memoryShareUrl: 'https://example.com/memories', anniversaryOptIn: true },
      headers: { authorization: `Bearer ${reg.json().token}`, 'content-type': 'application/json' } });
    expect(survey.statusCode).toBe(200);
    expect(survey.json().summary.nps.label).toBe('promoter');
    expect(survey.json().request.requestType).toBe('post_event_feedback');
    const review = await app.inject({ method: 'POST', url: `/api/events/${eventId}/couple-post-event/review`,
      payload: { platform: 'google', rating: 5, testimonial: 'We loved our day', permissionToPublish: true, reviewerName: 'Taylor and Morgan' },
      headers: { authorization: `Bearer ${reg.json().token}`, 'content-type': 'application/json' } });
    expect(review.statusCode).toBe(201);
    expect(review.json().request.requestType).toBe('review_testimonial_request');
    const postEventPacket = await app.inject({ method: 'GET', url: `/api/events/${eventId}/couple-post-event/final-packet.txt`, headers: { authorization: `Bearer ${reg.json().token}` } });
    expect(postEventPacket.statusCode).toBe(200);
    expect(postEventPacket.body).toContain('Post-event final packet');
    expect(postEventPacket.body).toContain('Privacy note');

    const queueForbidden = await app.inject({ method: 'GET', url: `/api/events/${eventId}/couple-post-event/review-queue`, headers: { authorization: `Bearer ${reg.json().token}` } });
    expect(queueForbidden.statusCode).toBe(403);
    const reviewLinks = await app.inject({ method: 'PATCH', url: `/api/events/${eventId}/couple-post-event/review-links`,
      payload: { google: 'https://reviews.example.com/google', theKnot: 'https://reviews.example.com/the-knot', weddingwire: '', zola: '', other: '' },
      headers: { authorization: `Bearer ${owner.token}`, 'content-type': 'application/json' } });
    expect(reviewLinks.statusCode).toBe(200);
    expect(reviewLinks.json().reviewLinks.google).toContain('google');
    const reviewQueue = await app.inject({ method: 'GET', url: `/api/events/${eventId}/couple-post-event/review-queue`, headers: { authorization: `Bearer ${owner.token}` } });
    expect(reviewQueue.statusCode).toBe(200);
    expect(reviewQueue.json().configuredReviewLinks).toBe(2);
    expect(reviewQueue.json().requests.some((r: any) => r.requestType === 'post_event_lost_item')).toBe(true);
    expect(reviewQueue.json().privacyBoundaries[0]).toContain('incident reports');

    const bulkQueue = await app.inject({ method: 'PATCH', url: `/api/events/${eventId}/couple-post-event/review-queue/bulk`,
      payload: { requestIds: [lostItem.json().request.id], assignedTo: 'closer@example.com', slaDays: 3, status: 'approved', note: 'Assign to post-event closer' },
      headers: { authorization: `Bearer ${owner.token}`, 'content-type': 'application/json' } });
    expect(bulkQueue.statusCode).toBe(200);
    expect(bulkQueue.json().updated[0].assignment.assignedTo).toBe('closer@example.com');
    expect(bulkQueue.json().updated[0].sla.status).toBe('on_track');
    db.prepare(`INSERT INTO integrations (id, organization_id, provider, status, display_name, config) VALUES (?, ?, 'email_smtp', 'connected', 'Test SMTP', '{}')`).run('smtp-post-event-test', org.id);
    const followUp = await app.inject({ method: 'POST', url: `/api/events/${eventId}/couple-post-event/review-queue/follow-up`,
      payload: { requestIds: [lostItem.json().request.id], channel: 'email', message: 'We are checking on your lost item request.' },
      headers: { authorization: `Bearer ${owner.token}`, 'content-type': 'application/json' } });
    expect(followUp.statusCode).toBe(201);
    expect(followUp.json().count).toBe(1);
    expect(followUp.json().dispatchedJobs).toBe(1);
    expect(followUp.json().queued[0].dispatchStatus).toBe('email_job_queued');

    const smsLostItem = await app.inject({ method: 'POST', url: `/api/events/${eventId}/couple-post-event/lost-item`,
      payload: { itemDescription: 'Phone charger', lastSeenLocation: 'suite', contactPreference: 'phone', contactValue: '5551234567' },
      headers: { authorization: `Bearer ${reg.json().token}`, 'content-type': 'application/json' } });
    expect(smsLostItem.statusCode).toBe(201);
    db.prepare(`INSERT INTO integrations (id, organization_id, provider, status, display_name, config) VALUES (?, ?, 'sms_twilio', 'connected', 'Test Twilio', ?)`)
      .run('sms-post-event-test', org.id, JSON.stringify({ accountSid: 'AC123', fromNumber: '+15550000000' }));
    const smsFollowUp = await app.inject({ method: 'POST', url: `/api/events/${eventId}/couple-post-event/review-queue/follow-up`,
      payload: { requestIds: [smsLostItem.json().request.id], channel: 'sms', message: 'We are checking on your lost charger.' },
      headers: { authorization: `Bearer ${owner.token}`, 'content-type': 'application/json' } });
    expect(smsFollowUp.statusCode).toBe(201);
    expect(smsFollowUp.json().dispatchedJobs).toBe(1);
    expect(smsFollowUp.json().queued[0].dispatchStatus).toBe('sms_job_queued');

    const advancedStart = await app.inject({ method: 'GET', url: `/api/events/${eventId}/couple-advanced-planning`, headers: { authorization: `Bearer ${reg.json().token}` } });
    expect(advancedStart.statusCode).toBe(200);
    expect(advancedStart.json().modules.some((m: any) => m.key === 'visionBoard')).toBe(true);
    expect(advancedStart.json().venueLinks.spaces[0].name).toBe('Garden Lawn');
    expect(advancedStart.json().venueLinks.visibleAddOns[0].name).toContain('Late-night');
    const advancedSave = await app.inject({ method: 'PATCH', url: `/api/events/${eventId}/couple-advanced-planning`,
      payload: { ceremony: { processional: ['parents', 'wedding party'], music: 'String quartet' }, rainPlan: { preference: 'Indoor chapel backup', communicationDraft: 'Rain plan will be announced by venue.' }, travelMicrosite: { enabled: true, welcome: 'Welcome guests', travelTips: 'Arrive early' }, music: { doNotPlay: ['Line dances'], mustPlay: ['First dance'] } },
      headers: { authorization: `Bearer ${reg.json().token}`, 'content-type': 'application/json' } });
    expect(advancedSave.statusCode).toBe(200);
    expect(advancedSave.json().progress.percent).toBeGreaterThan(0);
    const ceremonyRow = db.prepare(`SELECT payload FROM couple_ceremony_plans WHERE event_id = ?`).get(eventId) as { payload: string };
    expect(JSON.parse(ceremonyRow.payload).music).toBe('String quartet');
    const transportRows = db.prepare(`SELECT COUNT(*) AS n FROM couple_transportation_plans WHERE event_id = ?`).get(eventId) as { n: number };
    expect(transportRows.n).toBe(0);
    const advancedEscalation = await app.inject({ method: 'POST', url: `/api/events/${eventId}/couple-advanced-planning/concierge/escalate`,
      payload: { moduleKey: 'rainPlan', question: 'Can the venue approve the rain-plan communication?', urgency: 'time_sensitive' },
      headers: { authorization: `Bearer ${reg.json().token}`, 'content-type': 'application/json' } });
    expect(advancedEscalation.statusCode).toBe(201);
    expect(advancedEscalation.json().request.metadata.source).toBe('couple_advanced_planning');
    const travelPacket = await app.inject({ method: 'GET', url: `/api/events/${eventId}/couple-advanced-planning/travel-microsite.txt`, headers: { authorization: `Bearer ${reg.json().token}` } });
    expect(travelPacket.statusCode).toBe(200);
    expect(travelPacket.body).toContain('Personalized guest travel microsite packet');
    expect(travelPacket.body).toContain('Welcome guests');

    const planning = await app.inject({ method: 'GET', url: `/api/events/${eventId}/couple-planning`, headers: { authorization: `Bearer ${reg.json().token}` } });
    expect(planning.statusCode).toBe(200);
    expect(planning.json().tasks.length).toBeGreaterThan(5);
    expect(planning.json().tasks[0].owner).toBeTruthy();
    expect(planning.json().template.source).toBe('venue-controlled-default-deadline-template');
    const guestTask = planning.json().tasks.find((t: any) => t.templateKey === 'guest-list-started');
    const updateTask = await app.inject({ method: 'PATCH', url: `/api/events/${eventId}/couple-planning/${guestTask.id}`,
      payload: { status: 'completed', note: 'Guest list uploaded by couple' },
      headers: { authorization: `Bearer ${reg.json().token}`, 'content-type': 'application/json' } });
    expect(updateTask.statusCode).toBe(200);
    expect(updateTask.json().task.status).toBe('completed');
    const taskQuestion = await app.inject({ method: 'POST', url: `/api/events/${eventId}/couple-planning/${guestTask.id}/question`,
      payload: { question: 'Should we include kids in final count?' },
      headers: { authorization: `Bearer ${reg.json().token}`, 'content-type': 'application/json' } });
    expect(taskQuestion.statusCode).toBe(201);
    expect(taskQuestion.json().request.metadata.taskId).toBe(guestTask.id);

    const coupleGuestCreate = await app.inject({ method: 'POST', url: `/api/events/${eventId}/couple-guests`,
      payload: { fullName: 'VIP Guest', email: 'vip@example.com', householdName: 'VIP Family', mailingAddress: '2 Main St', rsvpStatus: 'pending', mealChoice: 'Vegetarian', tags: ['vip', 'family'], notes: 'Seat near parents' },
      headers: { authorization: `Bearer ${reg.json().token}`, 'content-type': 'application/json' } });
    expect(coupleGuestCreate.statusCode).toBe(201);
    expect(coupleGuestCreate.json().guest.tags).toContain('vip');
    const coupleGuests = await app.inject({ method: 'GET', url: `/api/events/${eventId}/couple-guests`, headers: { authorization: `Bearer ${reg.json().token}` } });
    expect(coupleGuests.statusCode).toBe(200);
    expect(coupleGuests.json().households.some((h: any) => h.name === 'VIP Family')).toBe(true);
    expect(coupleGuests.json().privacy.dietaryRestrictions).toContain('planning team');
    const privacy = await app.inject({ method: 'GET', url: `/api/events/${eventId}/couple-privacy`, headers: { authorization: `Bearer ${reg.json().token}` } });
    expect(privacy.statusCode).toBe(200);
    expect(privacy.json().policyPack.blocked).toContain('Org-wide guest/vendor/event lists');
    expect(privacy.json().fieldFiltering.finance[0]).toContain('No internal budget');
    const orgGuestsForbidden = await app.inject({ method: 'GET', url: `/api/orgs/${org.id}/guests`, headers: { authorization: `Bearer ${reg.json().token}` } });
    expect(orgGuestsForbidden.statusCode).toBe(403);
    const orgVendorsForbidden = await app.inject({ method: 'GET', url: `/api/orgs/${org.id}/vendors`, headers: { authorization: `Bearer ${reg.json().token}` } });
    expect(orgVendorsForbidden.statusCode).toBe(403);
    const preview = await app.inject({ method: 'POST', url: `/api/events/${eventId}/couple-guests/import-preview`,
      payload: { csv: 'fullName,email,householdName,mailingAddress\nVIP Guest,vip@example.com,VIP Family,2 Main St' },
      headers: { authorization: `Bearer ${reg.json().token}`, 'content-type': 'application/json' } });
    expect(preview.statusCode).toBe(200);
    expect(preview.json().willSave).toBe(false);
    expect(preview.json().duplicateSignals).toContain('vip@example.com');

    const portalSummary = await app.inject({ method: 'GET', url: `/api/events/${eventId}/couple-guest-portal`, headers: { authorization: `Bearer ${reg.json().token}` } });
    expect(portalSummary.statusCode).toBe(200);
    expect(portalSummary.json().guestsWillNotSee).toContain('Payment details');
    expect(portalSummary.json().portal.couplePlanningPortalUrl).toContain(`/couple/events/${eventId}`);
    const portalUpdate = await app.inject({ method: 'POST', url: `/api/events/${eventId}/couple-guest-portal/request-update`,
      payload: { config: { welcomeMessage: 'Welcome family and friends', dressCode: 'Black tie optional' }, note: 'Please approve copy before launch' },
      headers: { authorization: `Bearer ${reg.json().token}`, 'content-type': 'application/json' } });
    expect(portalUpdate.statusCode).toBe(201);
    expect(portalUpdate.json().request.requestType).toBe('guest_portal_update');
    const reminderReq = await app.inject({ method: 'POST', url: `/api/events/${eventId}/couple-guest-portal/reminder-request`,
      payload: { audience: 'not_responded', messagePreview: 'Please RSVP by August 1.' },
      headers: { authorization: `Bearer ${reg.json().token}`, 'content-type': 'application/json' } });
    expect(reminderReq.statusCode).toBe(201);
    expect(reminderReq.json().request.requestType).toBe('rsvp_reminder_request');
    const link = await app.inject({ method: 'POST', url: `/api/events/${eventId}/couple-guests/${coupleGuestCreate.json().guest.id}/portal-link`, headers: { authorization: `Bearer ${reg.json().token}` } });
    expect(link.statusCode).toBe(200);
    expect(link.json().url).toContain('token=');
    expect(link.json().qrPayload).toContain('WVI-GUEST');

    const coupleTimeline = await app.inject({ method: 'GET', url: `/api/events/${eventId}/couple-timeline`, headers: { authorization: `Bearer ${reg.json().token}` } });
    expect(coupleTimeline.statusCode).toBe(200);
    expect(coupleTimeline.json().items.some((i: any) => i.title === 'Ceremony')).toBe(true);
    expect(coupleTimeline.json().items.some((i: any) => i.title === 'Vendor load-in')).toBe(false);
    expect(coupleTimeline.json().hiddenInternalCount).toBeGreaterThan(0);
    expect(coupleTimeline.json().subEvents[0].title).toBe('Ceremony Rehearsal');
    const timelineChange = await app.inject({ method: 'POST', url: `/api/events/${eventId}/couple-timeline/request-change`,
      payload: { timelineItemId: ceremony.id, requestedChange: 'Move ceremony 15 minutes earlier', reason: 'Sunset photos' },
      headers: { authorization: `Bearer ${reg.json().token}`, 'content-type': 'application/json' } });
    expect(timelineChange.statusCode).toBe(201);
    expect(timelineChange.json().request.metadata.source).toBe('couple_timeline');
    const timelineApproval = await app.inject({ method: 'POST', url: `/api/events/${eventId}/couple-timeline/approval`,
      payload: { status: 'approved', note: 'Looks good' },
      headers: { authorization: `Bearer ${reg.json().token}`, 'content-type': 'application/json' } });
    expect(timelineApproval.statusCode).toBe(200);
    expect(timelineApproval.json().approval.status).toBe('approved');
    const ics = await app.inject({ method: 'GET', url: `/api/events/${eventId}/couple-timeline/export.ics`, headers: { authorization: `Bearer ${reg.json().token}` } });
    expect(ics.statusCode).toBe(200);
    expect(ics.body).toContain('Ceremony');
    expect(ics.body).not.toContain('Vendor load-in');

    const coupleLayout = await app.inject({ method: 'GET', url: `/api/events/${eventId}/couple-layout`, headers: { authorization: `Bearer ${reg.json().token}` } });
    expect(coupleLayout.statusCode).toBe(200);
    expect(coupleLayout.json().summary.tables).toBe(1);
    expect(coupleLayout.json().visibleItems.danceFloor).toHaveLength(1);
    expect(coupleLayout.json().visibleItems.adaRoutes).toHaveLength(1);
    const layoutComment = await app.inject({ method: 'POST', url: `/api/events/${eventId}/couple-layout/comment`,
      payload: { areaLabel: 'Dance floor', x: 300, y: 300, note: 'Can we move this closer to the band?' },
      headers: { authorization: `Bearer ${reg.json().token}`, 'content-type': 'application/json' } });
    expect(layoutComment.statusCode).toBe(201);
    expect(layoutComment.json().request.metadata.source).toBe('couple_layout_comment');
    const layoutApproval = await app.inject({ method: 'POST', url: `/api/events/${eventId}/couple-layout/approval`,
      payload: { status: 'changes_requested', note: 'Please review dance floor comment' },
      headers: { authorization: `Bearer ${reg.json().token}`, 'content-type': 'application/json' } });
    expect(layoutApproval.statusCode).toBe(200);
    expect(layoutApproval.json().approval.status).toBe('changes_requested');
    const seatingCsv = await app.inject({ method: 'GET', url: `/api/events/${eventId}/couple-layout/seating.csv`, headers: { authorization: `Bearer ${reg.json().token}` } });
    expect(seatingCsv.statusCode).toBe(200);
    expect(seatingCsv.body).toContain('VIP Guest');
    const placeCards = await app.inject({ method: 'GET', url: `/api/events/${eventId}/couple-layout/place-cards.txt`, headers: { authorization: `Bearer ${reg.json().token}` } });
    expect(placeCards.statusCode).toBe(200);
    expect(placeCards.body).toContain('VIP Guest');

    const vendorBoard = await app.inject({ method: 'GET', url: `/api/events/${eventId}/couple-vendors`, headers: { authorization: `Bearer ${reg.json().token}` } });
    expect(vendorBoard.statusCode).toBe(200);
    expect(vendorBoard.json().vendors[0].name).toBe('DJ Co');
    expect(vendorBoard.json().vendors[0].publicEmail).toBeNull();
    expect(vendorBoard.json().vendors[0].visibleDocuments[0].type).toBe('ceremony_music');
    expect(vendorBoard.json().hiddenFields).toContain('vendor no-show risk');
    const vendorRequest = await app.inject({ method: 'POST', url: `/api/events/${eventId}/couple-vendors/request`, payload: { category: 'florist', note: 'Need floral recommendations' }, headers: { authorization: `Bearer ${reg.json().token}`, 'content-type': 'application/json' } });
    expect(vendorRequest.statusCode).toBe(201);
    expect(vendorRequest.json().request.requestType).toBe('vendor_request');
    const vendorQuestion = await app.inject({ method: 'POST', url: `/api/events/${eventId}/couple-vendors/question`, payload: { vendorId: 'vendor-safe-1', question: 'Can DJ handle ceremony audio?' }, headers: { authorization: `Bearer ${reg.json().token}`, 'content-type': 'application/json' } });
    expect(vendorQuestion.statusCode).toBe(201);
    expect(vendorQuestion.json().request.requestType).toBe('vendor_question');
    const plannerCollab = await app.inject({ method: 'POST', url: `/api/events/${eventId}/couple-planner/collaboration-request`, payload: { plannerName: 'Pat Planner', plannerEmail: 'pat@example.com', note: 'Please add our planner' }, headers: { authorization: `Bearer ${reg.json().token}`, 'content-type': 'application/json' } });
    expect(plannerCollab.statusCode).toBe(201);
    expect(plannerCollab.json().request.requestType).toBe('planner_collaboration');
  });


  it('rehashes legacy-work-factor passwords on successful login', async () => {
    const u = await register();
    // Simulate a legacy account: hash derived with the old 120k work factor,
    // no iterations recorded on the row (as pre-0049 rows are).
    const { pbkdf2Sync } = await import('node:crypto');
    const salt = Buffer.from('U0FMVF9MRUdBQ1lfVEVTVF8wMDE=', 'base64');
    const legacyHash = pbkdf2Sync('testpass123', salt, 120_000, 32, 'sha256').toString('base64');
    db.prepare(`UPDATE users SET password_hash = ?, password_salt = ?, password_iterations = NULL WHERE id = (SELECT id FROM users WHERE email = ?)`).run(legacyHash, salt.toString('base64'), u.email);
    // Old hash must still verify, and the account must log in.
    const login = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { email: u.email, password: 'testpass123' }, headers: { 'content-type': 'application/json' } });
    expect(login.statusCode).toBe(200);
    const row = db.prepare(`SELECT password_iterations FROM users WHERE email = ?`).get(u.email) as { password_iterations: number | null };
    expect(row.password_iterations).toBe(600_000);
    // The issued session must still be valid after the silent upgrade.
    const me = await app.inject({ method: 'GET', url: '/api/auth/me', headers: { authorization: `Bearer ${login.json().token}` } });
    expect(me.statusCode).toBe(200);
    // Rehash is recorded in the audit log.
    const audit = db.prepare(`SELECT COUNT(*) AS n FROM audit_logs WHERE action = 'user.password.rehashed'`).get() as { n: number };
    expect(audit.n).toBeGreaterThanOrEqual(1);
  });

  it('register creates org + membership', async () => {
    const u = await register();
    const me = await app.inject({ method: 'GET', url: '/api/auth/me',
      headers: { authorization: `Bearer ${u.token}` } });
    expect(me.statusCode).toBe(200);
    expect(me.json().memberships.length).toBeGreaterThanOrEqual(1);
    expect(me.json().memberships[0].roleKey).toBe('owner');
  });
});
