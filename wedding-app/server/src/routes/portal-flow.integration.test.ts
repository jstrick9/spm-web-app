/**
 * End-to-end portal flow tests — simulates the complete guest RSVP journey
 * from portal info → guest selection → RSVP submission → verification.
 */
import './../test/setup.js';
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { db } from '../db/database.js';
import { buildApp } from '../index.js';
import type { FastifyInstance } from 'fastify';
import { guestsRepo, rolesRepo } from '../db/repos/index.js';

let app: FastifyInstance;
beforeAll(async () => { app = await buildApp(); await app.ready(); });

beforeEach(() => {
  for (const t of [
    'invite_tracking','vendor_checkins','gallery_images','inventory_items','contracts',
    'budget_items','webhook_deliveries','webhooks','push_subscriptions','sse_events',
    'audit_logs','direct_messages','event_answers','event_questions',
    'staff_shifts','staff_areas','staff_tasks','timeline_events',
    'vendor_payments','vendors','decor_packages','decor_arrangements',
    'decor_categories','decor_items','guest_portal_configs','rsvp_submissions',
    'guest_sub_event_invitations','guests','layout_versions','layouts',
    'catalog_items','venues','sub_events','event_memberships','events',
    'organization_memberships','organizations','users',
  ]) { try { db.prepare(`DELETE FROM ${t}`).run(); } catch {} }
  try { db.prepare(`DELETE FROM role_permissions WHERE role_id IN (SELECT id FROM roles WHERE is_system = 0)`).run(); db.prepare(`DELETE FROM roles WHERE is_system = 0`).run(); } catch {}
  rolesRepo.ensureSystemRoles();
});

async function setupEvent() {
  const r = await app.inject({ method: 'POST', url: '/api/auth/register',
    payload: { email: `pf-${Math.random().toString(36).slice(2)}@x.com`, password: 'testpass123', fullName: 'Owner', orgName: 'Venue' },
    headers: { 'content-type': 'application/json' } });
  const token = r.json().token, orgId = r.json().organizationId;
  const e = await app.inject({ method: 'POST', url: '/api/events',
    payload: { organizationId: orgId, title: 'Smith Wedding', startDate: '2026-09-12', guestCount: 100 },
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' } });
  const eventId = e.json().event.id;

  // Portal setup is venue seed data; couple mutation is covered in auth invitation tests.
  const g1 = guestsRepo.create(orgId, eventId, { fullName: 'Alice Johnson', email: 'alice@test.com', partyName: 'Johnson Household', tableAssignment: 'Table 1' });
  const g2 = guestsRepo.create(orgId, eventId, { fullName: 'Bob Williams', email: 'bob@test.com', partyName: 'Johnson Household' });

  return { token, orgId, eventId, guestId1: g1.id, guestId2: g2.id };
}

describe('Public portal: full RSVP flow', () => {
  it('1. Portal info returns event + guest list (no auth needed)', async () => {
    const s = await setupEvent();
    const generic = await app.inject({ method: 'GET', url: `/api/portal/${s.eventId}/info` });
    expect(generic.statusCode).toBe(200);
    expect(generic.json().event.title).toBe('Smith Wedding');
    expect(generic.json().identity.mode).toBe('lookup_required');
    expect(generic.json().guests).toHaveLength(0);
    const token = guestsRepo.rotatePortalToken(s.guestId1);
    const res = await app.inject({ method: 'GET', url: `/api/portal/${s.eventId}/info?guest=${s.guestId1}&token=${token}` });
    expect(res.statusCode).toBe(200);
    expect(res.json().event.startDate).toBe('2026-09-12');
    expect(res.json().identity.mode).toBe('tokenized');
    expect(res.json().guests).toHaveLength(2);
    expect(res.json().guests[0].fullName).toBe('Alice Johnson');
    expect(res.json().guests[0].householdAuthorized).toBe(true);
    expect(res.json().guests[1].fullName).toBe('Bob Williams');
    expect(res.json().guests[0].tableAssignment).toBe('Table 1');
  });


  it('expires guest portal tokens and records successful use', async () => {
    const s = await setupEvent();
    const token = guestsRepo.rotatePortalToken(s.guestId1);
    const valid = await app.inject({ method: 'GET', url: `/api/portal/${s.eventId}/info?guest=${s.guestId1}&token=${token}` });
    expect(valid.statusCode).toBe(200);
    expect(db.prepare('SELECT portal_token_last_used_at FROM guests WHERE id = ?').get(s.guestId1)).toMatchObject({ portal_token_last_used_at: expect.any(String) });
    db.prepare(`UPDATE guests SET portal_token_expires_at = '2000-01-01T00:00:00.000Z' WHERE id = ?`).run(s.guestId1);
    const expired = await app.inject({ method: 'GET', url: `/api/portal/${s.eventId}/info?guest=${s.guestId1}&token=${token}` });
    expect(expired.statusCode).toBe(200);
    expect(expired.json().identity.tokenStatus).toBe('expired');
    expect(expired.json().guests).toHaveLength(0);
  });

  it('1c. Portal wayfinding returns labels and personal-only seating privacy', async () => {
    const s = await setupEvent();
    const other = guestsRepo.create(s.orgId, s.eventId, { fullName: 'Charlie Guest', email: 'charlie@test.com', tableAssignment: 'Table 9' });
    db.prepare(`INSERT INTO layouts (id, organization_id, event_id, name, payload) VALUES (?, ?, ?, ?, ?)`)
      .run('layout-wayfinding', s.orgId, s.eventId, 'Guest layout', JSON.stringify({ items: [
        { id: 'chair-active', type: 'chair', x: 10, y: 20, label: '', radius: 10, guestId: s.guestId1, guestInitials: 'AJ' },
        { id: 'chair-other', type: 'chair', x: 40, y: 20, label: '', radius: 10, guestId: other.id, guestInitials: 'CG' },
        { id: 'table-1', type: 'round_table', x: 20, y: 20, label: 'Table 1', radius: 35 },
      ] }));
    const cfg = await app.inject({ method: 'PUT', url: `/api/events/${s.eventId}/portal-config`,
      payload: { enabled: true, config: { seatingPrivacyMode: 'personal_only', guestWayfindingLabels: [
        { type: 'parking', label: 'Guest parking', details: 'West lot' },
        { type: 'entrance', label: 'Main entrance', details: 'Garden gate' },
        { type: 'ada_route', label: 'ADA route', details: 'Paved route from accessible parking' },
      ], indoorRainPlanMapNote: 'Reception hall rain-plan entrance', outdoorMapNote: 'Garden arrival route', accessibilityRouteDetails: 'Use the paved route.' } },
      headers: { authorization: `Bearer ${s.token}`, 'content-type': 'application/json' } });
    expect(cfg.statusCode).toBe(200);
    const guestToken = guestsRepo.rotatePortalToken(s.guestId1);
    const res = await app.inject({ method: 'GET', url: `/api/portal/${s.eventId}/info?guest=${s.guestId1}&token=${guestToken}` });
    expect(res.statusCode).toBe(200);
    expect(res.json().guestWayfinding.seatingPrivacyMode).toBe('personal_only');
    expect(res.json().guestWayfinding.labels.some((l: any) => l.type === 'parking' && l.details === 'West lot')).toBe(true);
    expect(res.json().layout.privacyMode).toBe('personal_only');
    expect(res.json().layout.items.some((i: any) => i.guestId === other.id || i.guestInitials === 'CG')).toBe(false);
    expect(res.json().layout.items.some((i: any) => i.guestId === s.guestId1 && i.guestInitials === 'AJ')).toBe(true);
  });


  it('1d. Portal FAQ includes etiquette policies and accepts routed guest questions', async () => {
    const s = await setupEvent();
    const cfg = await app.inject({ method: 'PUT', url: `/api/events/${s.eventId}/portal-config`,
      payload: { enabled: true, config: {
        dressCodeSummary: 'Garden cocktail attire',
        dressCodeExamples: 'Suits, sundresses, wedges',
        dressCodeWeather: 'Bring a wrap for evening weather.',
        dressCodeRainPlan: 'Indoor rain-plan shoes are welcome.',
        kidsPolicy: 'Adults-only reception except named children.',
        plusOneRules: 'Only named plus-ones may attend.',
        phonePhotoPolicy: 'Unplugged ceremony.',
        smokingVapingPolicy: 'Smoking only in marked patio area.',
        barAlcoholPolicy: 'Open bar with ID required.',
        guestFaqItems: [{ category: 'Dress code', question: 'Can I wear heels?', answer: 'Block heels work best.', translations: { es: { question: '¿Puedo usar tacones?', answer: 'Tacones anchos son mejores.' } } }],
        faqLanguages: [{ code: 'es', label: 'Español' }],
        guestQuestionContactLabel: 'venue concierge',
        guestQuestionContactEmail: 'concierge@test.com',
      } },
      headers: { authorization: `Bearer ${s.token}`, 'content-type': 'application/json' } });
    expect(cfg.statusCode).toBe(200);
    const guestToken = guestsRepo.rotatePortalToken(s.guestId1);
    const info = await app.inject({ method: 'GET', url: `/api/portal/${s.eventId}/info?guest=${s.guestId1}&token=${guestToken}` });
    expect(info.statusCode).toBe(200);
    expect(info.json().guestFaq.dressCode.summary).toBe('Garden cocktail attire');
    expect(info.json().guestFaq.policies.phonePhotoPolicy).toBe('Unplugged ceremony.');
    expect(info.json().guestFaq.multilingual.availableLanguages.some((l: any) => l.code === 'es')).toBe(true);
    const question = await app.inject({ method: 'POST', url: `/api/portal/${s.eventId}/question`,
      payload: { guestId: s.guestId1, token: guestToken, category: 'Dress code', language: 'es', question: 'Is the garden path paved?' },
      headers: { 'content-type': 'application/json' } });
    expect(question.statusCode).toBe(201);
    expect(question.json().message).toContain('venue concierge');
    const row = db.prepare(`SELECT * FROM guest_help_requests WHERE id = ?`).get(question.json().requestId) as any;
    expect(row.guest_id).toBe(s.guestId1);
    expect(row.assigned_to).toBe('concierge@test.com');
    expect(row.message).toContain('Category: Dress code');
    expect(row.message).toContain('Language: es');
  });


  it('1e. Portal registry gifts returns labeled links, cards table, honeymoon, and charity links', async () => {
    const s = await setupEvent();
    const cfg = await app.inject({ method: 'PUT', url: `/api/events/${s.eventId}/portal-config`,
      payload: { enabled: true, config: {
        giftLinks: [
          { type: 'registry', label: 'Zola Registry', url: 'https://zola.example/registry', description: 'Home goods' },
          { type: 'honeymoon', label: 'Honeymoon Fund', url: 'https://fund.example/honeymoon', description: 'Optional travel fund' },
          { type: 'charity', label: 'Animal Rescue Donation', url: 'https://charity.example/donate', description: 'Optional donation' },
        ],
        cardsGiftTableLocation: 'Welcome table near reception entrance',
        registryGiftNote: 'Your presence is the best gift.',
      } },
      headers: { authorization: `Bearer ${s.token}`, 'content-type': 'application/json' } });
    expect(cfg.statusCode).toBe(200);
    const res = await app.inject({ method: 'GET', url: `/api/portal/${s.eventId}/info` });
    expect(res.statusCode).toBe(200);
    expect(res.json().guestGifts.cardsGiftTableLocation).toBe('Welcome table near reception entrance');
    expect(res.json().guestGifts.note).toBe('Your presence is the best gift.');
    expect(res.json().guestGifts.links.map((l: any) => l.label)).toEqual(expect.arrayContaining(['Zola Registry', 'Honeymoon Fund', 'Animal Rescue Donation']));
    expect(res.json().guestGifts.externalLinkWarning).toContain('open in a new tab');
  });


  it('1f. Portal accessibility care center returns details and accepts explicit accessibility request', async () => {
    const s = await setupEvent();
    const cfg = await app.inject({ method: 'PUT', url: `/api/events/${s.eventId}/portal-config`,
      payload: { enabled: true, config: {
        accessibleParking: 'ADA parking by west lot',
        accessibleEntrance: 'Ramp at main entrance',
        accessibleRestroom: 'Accessible restroom in lobby',
        accessibleSeating: 'Aisle and companion seating available',
        accessibilityRouteDetails: 'Paved route from parking to ceremony',
        mobilityDropoff: 'Covered drop-off at front door',
        accessibilityContactLabel: 'venue accessibility concierge',
        accessibilityContactEmail: 'access@test.com',
        accessibilityContactPhone: '555-0100',
        accessibilityHelpText: 'Tell us how we can support your arrival and seating.',
      } },
      headers: { authorization: `Bearer ${s.token}`, 'content-type': 'application/json' } });
    expect(cfg.statusCode).toBe(200);
    const guestToken = guestsRepo.rotatePortalToken(s.guestId1);
    const info = await app.inject({ method: 'GET', url: `/api/portal/${s.eventId}/info?guest=${s.guestId1}&token=${guestToken}` });
    expect(info.statusCode).toBe(200);
    expect(info.json().guestCare.details.accessibleParking).toBe('ADA parking by west lot');
    expect(info.json().guestCare.details.accessibleEntrance).toBe('Ramp at main entrance');
    expect(info.json().guestCare.contact.label).toBe('venue accessibility concierge');
    const req = await app.inject({ method: 'POST', url: `/api/portal/${s.eventId}/accessibility-request`,
      payload: { guestId: s.guestId1, token: guestToken, mobility: 'Wheelchair access from parking', seating: 'Aisle companion seat', sensory: 'Quiet space if possible', interpretationLanguage: 'Spanish', serviceAnimal: 'Service dog relief area', dietaryAllergy: 'Severe peanut allergy', caregiver: 'Caregiver will assist arrival', contactPreference: 'email', notes: 'Please confirm route.' },
      headers: { 'content-type': 'application/json' } });
    expect(req.statusCode).toBe(201);
    expect(req.json().message).toContain('venue accessibility concierge');
    const row = db.prepare(`SELECT * FROM guest_help_requests WHERE id = ?`).get(req.json().requestId) as any;
    expect(row.guest_id).toBe(s.guestId1);
    expect(row.assigned_to).toBe('access@test.com');
    expect(row.sla_due_at).toBeTruthy();
    expect(row.message).toContain('Accessibility & care request');
    expect(row.message).toContain('Mobility: Wheelchair access from parking');
    expect(row.message).toContain('Dietary / allergy: Severe peanut allergy');
  });


  it('1g. Portal privacy explains visibility/retention and accepts contact deletion requests', async () => {
    const s = await setupEvent();
    const cfg = await app.inject({ method: 'PUT', url: `/api/events/${s.eventId}/portal-config`,
      payload: { enabled: true, config: {
        privacySummary: 'Private wedding privacy summary.',
        dataRetentionStatement: 'Guest data retained for 90 days unless required longer.',
        privacyContactLabel: 'privacy concierge',
        privacyContactEmail: 'privacy@test.com',
        privacyRequestsEnabled: true,
      } },
      headers: { authorization: `Bearer ${s.token}`, 'content-type': 'application/json' } });
    expect(cfg.statusCode).toBe(200);
    const guestToken = guestsRepo.rotatePortalToken(s.guestId1);
    const info = await app.inject({ method: 'GET', url: `/api/portal/${s.eventId}/info?guest=${s.guestId1}&token=${guestToken}` });
    expect(info.statusCode).toBe(200);
    expect(info.json().guestPrivacy.summary).toBe('Private wedding privacy summary.');
    expect(info.json().guestPrivacy.retention).toContain('90 days');
    expect(info.json().guestPrivacy.access.privateWeddingDefault).toBe(true);
    expect(info.json().guestPrivacy.correctionDeletion.contactEmail).toBe('privacy@test.com');
    const req = await app.inject({ method: 'POST', url: `/api/portal/${s.eventId}/privacy-request`,
      payload: { guestId: s.guestId1, token: guestToken, requestType: 'delete_contact', message: 'Please delete my old phone number.' },
      headers: { 'content-type': 'application/json' } });
    expect(req.statusCode).toBe(201);
    expect(req.json().message).toContain('privacy concierge');
    const row = db.prepare(`SELECT * FROM guest_help_requests WHERE id = ?`).get(req.json().requestId) as any;
    expect(row.guest_id).toBe(s.guestId1);
    expect(row.assigned_to).toBe('privacy@test.com');
    expect(row.message).toContain('Guest privacy/data request');
    expect(row.message).toContain('Type: delete_contact');
  });


  it('1h. Portal reminder preferences persist and send-me-info handles provider state safely', async () => {
    const s = await setupEvent();
    await app.inject({ method: 'PUT', url: `/api/events/${s.eventId}/portal-config`,
      payload: { enabled: true, config: { reminderGuestFriendlyCopy: 'Helpful guest reminders only.', defaultQuietHoursStart: '22:00', defaultQuietHoursEnd: '07:00', scheduleReminderEnabled: true, rainPlanReminderEnabled: true, shuttleReminderEnabled: true } },
      headers: { authorization: `Bearer ${s.token}`, 'content-type': 'application/json' } });
    const guestToken = guestsRepo.rotatePortalToken(s.guestId1);
    const info = await app.inject({ method: 'GET', url: `/api/portal/${s.eventId}/info?guest=${s.guestId1}&token=${guestToken}` });
    expect(info.statusCode).toBe(200);
    expect(info.json().guestReminders.defaults.guestFriendlyCopy).toBe('Helpful guest reminders only.');
    expect(info.json().guestReminders.preferences.quietHoursStart).toBe('22:00');
    const pref = await app.inject({ method: 'POST', url: `/api/portal/${s.eventId}/reminder-preferences`,
      payload: { guestId: s.guestId1, token: guestToken, emailOptIn: true, smsOptIn: false, confirmationPreference: 'email', reminderTypes: ['rsvp','schedule','rain_plan','shuttle','day_before'], quietHoursStart: '21:30', quietHoursEnd: '07:30', language: 'es', sendInfo: 'schedule' },
      headers: { 'content-type': 'application/json' } });
    expect(pref.statusCode).toBe(200);
    expect(pref.json().preferences.emailOptIn).toBe(true);
    expect(pref.json().dispatchStatus).toMatch(/provider_not_connected|missing_opt_in_or_contact|preferences_saved/);
    const updated = guestsRepo.findById(s.guestId1)!;
    const meta = JSON.parse(updated.metadata || '{}');
    expect(meta.reminderPreferences.language).toBe('es');
    expect(meta.reminderPreferences.quietHoursStart).toBe('21:30');
  });


  it('1i. Portal day-of mode returns offline pass and accepts running-late quick action', async () => {
    const s = await setupEvent();
    await app.inject({ method: 'PUT', url: `/api/events/${s.eventId}/portal-config`,
      payload: { enabled: true, config: { venueAddress: '1 Venue Lane', shuttleSchedule: 'Shuttle every 20 minutes', dayOfModeTitle: 'Wedding day quick card', dayOfContactLabel: 'venue concierge', dayOfContactEmail: 'dayof@test.com', dayOfContactPhone: '555-0100', dayOfPushCopy: 'Allow rain-plan and shuttle alerts.' } },
      headers: { authorization: `Bearer ${s.token}`, 'content-type': 'application/json' } });
    const guestToken = guestsRepo.rotatePortalToken(s.guestId1);
    const info = await app.inject({ method: 'GET', url: `/api/portal/${s.eventId}/info?guest=${s.guestId1}&token=${guestToken}` });
    expect(info.statusCode).toBe(200);
    expect(info.json().guestDayOf.title).toBe('Wedding day quick card');
    expect(info.json().guestDayOf.contactLabel).toBe('venue concierge');
    expect(info.json().guestDayOf.offlinePassUrl).toContain('/guest-pass.txt');
    expect(info.json().guestDayOf.qrPayload).toContain(s.guestId1);
    const pass = await app.inject({ method: 'GET', url: `/api/portal/${s.eventId}/guest-pass.txt?guest=${s.guestId1}&token=${guestToken}` });
    expect(pass.statusCode).toBe(200);
    expect(pass.body).toContain('Offline guest event-day pass');
    expect(pass.body).toContain('Alice Johnson');
    expect(pass.body).toContain('Table 1');
    const help = await app.inject({ method: 'POST', url: `/api/portal/${s.eventId}/day-of-help`, payload: { guestId: s.guestId1, token: guestToken, kind: 'running_late', message: 'Parking now.' }, headers: { 'content-type': 'application/json' } });
    expect(help.statusCode).toBe(201);
    const row = db.prepare(`SELECT * FROM guest_help_requests WHERE id = ?`).get(help.json().requestId) as any;
    expect(row.guest_id).toBe(s.guestId1);
    expect(row.assigned_to).toBe('dayof@test.com');
    expect(row.message).toContain('Guest running late');
  });


  it('1j. Portal post-event memories supports moderated photo link and guest feedback', async () => {
    const s = await setupEvent();
    await app.inject({ method: 'PUT', url: `/api/events/${s.eventId}/portal-config`, payload: { enabled: true, config: { guestMemoryEnabled: true, postEventThankYouTitle: 'Thanks guests', postEventThankYouMessage: 'Gallery is open.', memoryPhotoLinks: [{ id: 'gallery', label: 'Photo gallery', url: 'https://gallery.example.com', description: 'Official gallery' }], guestPhotoUploadEnabled: true, guestPostEventFeedbackEnabled: true } }, headers: { authorization: `Bearer ${s.token}`, 'content-type': 'application/json' } });
    const guestToken = guestsRepo.rotatePortalToken(s.guestId1);
    const info = await app.inject({ method: 'GET', url: `/api/portal/${s.eventId}/info?guest=${s.guestId1}&token=${guestToken}` });
    expect(info.statusCode).toBe(200);
    expect(info.json().guestPostEvent.thankYouTitle).toBe('Thanks guests');
    expect(info.json().guestPostEvent.links[0].label).toBe('Photo gallery');
    const memory = await app.inject({ method: 'POST', url: `/api/portal/${s.eventId}/memory-submission`, payload: { guestId: s.guestId1, token: guestToken, photoUrl: 'https://photos.example.com/album', caption: 'Dance floor!', consent: true }, headers: { 'content-type': 'application/json' } });
    expect(memory.statusCode).toBe(201);
    expect(memory.json().moderationStatus).toBe('pending_review');
    const row = db.prepare(`SELECT * FROM guest_help_requests WHERE id = ?`).get(memory.json().requestId) as any;
    expect(row.message).toContain('Guest memory/photo submission');
    expect(row.message).toContain('pending_review');
    const fb = await app.inject({ method: 'POST', url: `/api/portal/${s.eventId}/guest-feedback`, payload: { guestId: s.guestId1, token: guestToken, npsScore: 9, comment: 'Great guest flow', consentToContact: true }, headers: { 'content-type': 'application/json' } });
    expect(fb.statusCode).toBe(201);
    expect(fb.json().feedback.npsScore).toBe(9);
  });


  it('1k. Portal status exposes disabled recovery support contact without broad guest data', async () => {
    const s = await setupEvent();
    const cfg = await app.inject({ method: 'PUT', url: `/api/events/${s.eventId}/portal-config`,
      payload: { enabled: false, config: { supportEmail: 'help@test.com', supportPhone: '555-0100', supportLabel: 'venue concierge', portalDisabledMessage: 'Portal opens after invitations are approved.' } },
      headers: { authorization: `Bearer ${s.token}`, 'content-type': 'application/json' } });
    expect(cfg.statusCode).toBe(200);
    const info = await app.inject({ method: 'GET', url: `/api/portal/${s.eventId}/info` });
    expect(info.statusCode).toBe(404);
    const status = await app.inject({ method: 'GET', url: `/api/portal/${s.eventId}/status` });
    expect(status.statusCode).toBe(200);
    expect(status.json().status).toBe('disabled');
    expect(status.json().message).toBe('Portal opens after invitations are approved.');
    expect(status.json().support.email).toBe('help@test.com');
    expect(status.json().support.phone).toBe('555-0100');
  });


  it('1l. Guest portal security dashboard summarizes public audit events and device sessions', async () => {
    const s = await setupEvent();
    const guestToken = guestsRepo.rotatePortalToken(s.guestId1);
    await app.inject({ method: 'GET', url: `/api/portal/${s.eventId}/info?guest=${s.guestId1}&token=${guestToken}`, headers: { 'user-agent': 'security-test-agent' } });
    await app.inject({ method: 'POST', url: `/api/portal/${s.eventId}/lookup`, payload: { query: 'No Match' }, headers: { 'content-type': 'application/json', 'user-agent': 'security-test-agent' } });
    const security = await app.inject({ method: 'GET', url: `/api/events/${s.eventId}/guest-portal-security`, headers: { authorization: `Bearer ${s.token}` } });
    expect(security.statusCode).toBe(200);
    expect(security.json().summary.totalAudits).toBeGreaterThan(0);
    expect(security.json().summary.tokenizedLinksPreferred).toBe(true);
    expect(security.json().summary.rateLimitsAndHoneypotsActive).toBe(true);
    expect(security.json().counts['public.portal.view']).toBeGreaterThanOrEqual(1);
    expect(security.json().counts['public.portal.lookup_failed']).toBeGreaterThanOrEqual(1);
    expect(security.json().topDeviceSessions[0].deviceSession).toBeTruthy();
  });

  it('1b. Generic lookup and help flows do not expose full guest list', async () => {
    const s = await setupEvent();
    const lookup = await app.inject({ method: 'POST', url: `/api/portal/${s.eventId}/lookup`, payload: { query: 'Alice', email: 'alice@test.com' }, headers: { 'content-type': 'application/json' } });
    expect(lookup.statusCode).toBe(200);
    expect(lookup.json().matches[0].label).toContain('Alice');
    expect(lookup.json().matches[0].requiresSecureLink).toBe(true);
    const help = await app.inject({ method: 'POST', url: `/api/portal/${s.eventId}/help-request`, payload: { kind: 'cannot_find_name', name: 'Alicia', email: 'alice@test.com', message: 'I cannot find my invitation.' }, headers: { 'content-type': 'application/json' } });
    expect(help.statusCode).toBe(201);
    expect(help.json().message).toContain('request was sent');
    const resend = await app.inject({ method: 'POST', url: `/api/portal/${s.eventId}/resend-link`, payload: { email: 'alice@test.com', name: 'Alice' }, headers: { 'content-type': 'application/json' } });
    expect(resend.statusCode).toBe(202);
    expect(resend.json().message).toContain('secure RSVP link');
    const linkedHelp = await app.inject({ method: 'POST', url: `/api/portal/${s.eventId}/help-request`, payload: { kind: 'wrong_guest', guestId: s.guestId1, email: 'alice@test.com', message: 'This link question needs venue help.' }, headers: { 'content-type': 'application/json' } });
    const reply = await app.inject({ method: 'POST', url: `/api/events/${s.eventId}/guest-help-requests/${linkedHelp.json().requestId}/reply`, payload: { channel: 'in_app', message: 'The venue confirmed your invitation details.' }, headers: { authorization: `Bearer ${s.token}`, 'content-type': 'application/json' } });
    expect(reply.statusCode).toBe(201);
    const guestToken = guestsRepo.rotatePortalToken(s.guestId1);
    const messages = await app.inject({ method: 'GET', url: `/api/portal/${s.eventId}/messages?guest=${s.guestId1}&token=${guestToken}` });
    expect(messages.statusCode).toBe(200);
    expect(messages.json().replies[0].body).toContain('confirmed');
  });

  it('2. Guest submits RSVP (attending + meal choice)', async () => {
    const s = await setupEvent();
    const res = await app.inject({ method: 'POST', url: `/api/portal/${s.eventId}/rsvp`,
      payload: { guestId: s.guestId1, attending: true, mealChoice: 'vegetarian', dietaryNotes: 'Vegetarian', allergies: 'Peanuts', allergySeverity: 'severe', crossContaminationWarning: true, beveragePreference: 'Mocktail', severeAllergyContact: true, notes: 'Looking forward!' },
      headers: { 'content-type': 'application/json' } });
    expect(res.statusCode).toBe(201);
    expect(res.json().ok).toBe(true);
    expect(res.json().rsvpId).toBeTruthy();
    const exportRes = await app.inject({ method: 'GET', url: `/api/events/${s.eventId}/catering-dietary-export.csv`, headers: { authorization: `Bearer ${s.token}` } });
    expect(exportRes.statusCode).toBe(200);
    expect(exportRes.body).toContain('Peanuts');
    expect(exportRes.body).toContain('Mocktail');
    const allergyAlerts = await app.inject({ method: 'GET', url: `/api/events/${s.eventId}/guest-help-requests`, headers: { authorization: `Bearer ${s.token}` } });
    expect(allergyAlerts.statusCode).toBe(200);
    expect(allergyAlerts.json().requests.some((r: any) => String(r.message).includes('Severe allergy follow-up'))).toBe(true);
  });

  it('3. RSVP updates guest status to attending', async () => {
    const s = await setupEvent();
    await app.inject({ method: 'POST', url: `/api/portal/${s.eventId}/rsvp`,
      payload: { guestId: s.guestId1, attending: true },
      headers: { 'content-type': 'application/json' } });

    // Verify via authenticated guest list
    const guests = await app.inject({ method: 'GET', url: `/api/events/${s.eventId}/guests`,
      headers: { authorization: `Bearer ${s.token}` } });
    expect(guests.json().counts.attending).toBe(1);
    expect(guests.json().counts.pending).toBe(1); // g2 still pending
  });

  it('4. Guest declines RSVP', async () => {
    const s = await setupEvent();
    await app.inject({ method: 'POST', url: `/api/portal/${s.eventId}/rsvp`,
      payload: { guestId: s.guestId2, attending: false },
      headers: { 'content-type': 'application/json' } });

    const guests = await app.inject({ method: 'GET', url: `/api/events/${s.eventId}/guests`,
      headers: { authorization: `Bearer ${s.token}` } });
    expect(guests.json().counts.declined).toBe(1);
  });

  it('5. Portal rejects RSVP for non-existent guest', async () => {
    const s = await setupEvent();
    const res = await app.inject({ method: 'POST', url: `/api/portal/${s.eventId}/rsvp`,
      payload: { guestId: 'fake-guest-id', attending: true },
      headers: { 'content-type': 'application/json' } });
    expect(res.statusCode).toBe(400);
  });

  it('6. Portal returns 404 for non-existent event', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/portal/fake-event-id/info' });
    expect(res.statusCode).toBe(404);
  });

  it('7. Multiple RSVPs from same guest (latest wins)', async () => {
    const s = await setupEvent();
    // First: attend
    await app.inject({ method: 'POST', url: `/api/portal/${s.eventId}/rsvp`,
      payload: { guestId: s.guestId1, attending: true },
      headers: { 'content-type': 'application/json' } });
    // Then: decline
    await app.inject({ method: 'POST', url: `/api/portal/${s.eventId}/rsvp`,
      payload: { guestId: s.guestId1, attending: false },
      headers: { 'content-type': 'application/json' } });

    const guests = await app.inject({ method: 'GET', url: `/api/events/${s.eventId}/guests`,
      headers: { authorization: `Bearer ${s.token}` } });
    expect(guests.json().counts.declined).toBe(1);
    expect(guests.json().counts.attending).toBe(0);
  });

  it('8. Portal includes theme config for styling', async () => {
    const s = await setupEvent();
    const res = await app.inject({ method: 'GET', url: `/api/portal/${s.eventId}/info` });
    // theme may be null if no config set, but the field should exist
    expect(res.json()).toHaveProperty('theme');
  });
});
