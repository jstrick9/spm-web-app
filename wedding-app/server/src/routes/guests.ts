import type { FastifyInstance } from 'fastify';
import { broadcastSSE } from "./sse.js";
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { can } from '../lib/rbac.js';
import { auditRepo, eventsRepo, guestsRepo, jobsRepo, rsvpRepo, portalConfigRepo, layoutsRepo, orgsRepo, guestIdentityRepo } from '../db/repos/index.js';
import { BadRequest, Forbidden, NotFound } from '../lib/errors.js';
import { hashPassword, verifyPassword, uuid } from '../lib/crypto.js';
import { verifyCapabilitySecret } from '../lib/capability.js';
import { assertNoPublicHoneypot, auditPublicSubmission } from '../lib/publicAbuse.js';
import { db } from '../db/database.js';

const guestSchema = z.object({
  fullName:             z.string().min(1).max(200),
  email:                z.string().email().max(254).optional(),
  phone:                z.string().max(40).optional(),
  partyName:            z.string().max(200).optional(),
  rsvpStatus:           z.enum(['pending','attending','declined','maybe']).optional(),
  dietaryRestrictions:  z.string().max(2000).optional(),
  accessibilityNotes:   z.string().max(2000).optional(),
  tableAssignment:      z.string().max(60).optional(),
  roomAssignment:       z.string().max(60).optional(),
  seatAssignment:       z.string().max(60).optional(),
  plusOneAllowed:       z.boolean().optional(),
  allowPortalAccess:    z.boolean().optional(),
  allowLodgingAccess:   z.boolean().optional(),
  metadata:             z.record(z.unknown()).optional(),
});

const rsvpSchema = z.object({
  guestId:           z.string().optional(),
  attending:         z.boolean(),
  attendingDays:     z.array(z.string()).optional(),
  mealChoice:        z.string().max(60).optional(),
  plusOneName:       z.string().max(200).optional(),
  plusOneMealChoice: z.string().max(60).optional(),
  dietaryNotes:      z.string().max(2000).optional(),
  allergies:         z.string().max(2000).optional(),
  allergySeverity:   z.enum(['none','mild','moderate','severe']).optional(),
  crossContaminationWarning: z.boolean().optional(),
  beveragePreference: z.string().max(200).optional(),
  severeAllergyContact: z.boolean().optional(),
  specialNeeds:      z.string().max(2000).optional(),
  notes:             z.string().max(2000).optional(),
  subEventRSVPs:     z.record(z.union([z.boolean(), z.enum(['attending','declined','unsure'])])).optional(),
  token:             z.string().optional(),
  emailReminderConsent: z.boolean().optional(),
  smsReminderConsent:   z.boolean().optional(),
});

const portalConfigSchema = z.object({
  enabled:            z.boolean(),
  password:           z.string().min(4).max(200).optional(),
  clearPassword:      z.boolean().optional(),
  accessStartsAt:     z.string().optional(),
  accessEndsAt:       z.string().optional(),
  gracePeriodHours:   z.number().int().min(0).max(720).optional(),
  config:             z.record(z.unknown()).optional(),
});


const guestLookupSchema = z.object({
  query: z.string().min(2).max(120),
  email: z.string().email().optional().or(z.literal('')),
});

const guestHelpSchema = z.object({
  kind: z.enum(['cannot_find_name','wrong_guest','expired_or_revoked','other']).default('cannot_find_name'),
  name: z.string().max(160).optional(),
  email: z.string().email().optional().or(z.literal('')),
  message: z.string().max(2000).optional(),
  guestId: z.string().optional(),
});

const guestQuestionSchema = z.object({
  guestId: z.string().optional(),
  token: z.string().optional(),
  name: z.string().max(160).optional(),
  email: z.string().email().optional().or(z.literal('')),
  category: z.string().min(1).max(80).default('General'),
  language: z.string().max(12).optional(),
  question: z.string().min(3).max(2000),
});

const guestAccessibilityRequestSchema = z.object({
  guestId: z.string().optional(),
  token: z.string().optional(),
  name: z.string().max(160).optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().max(80).optional(),
  mobility: z.string().max(1000).optional(),
  seating: z.string().max(1000).optional(),
  sensory: z.string().max(1000).optional(),
  interpretationLanguage: z.string().max(300).optional(),
  serviceAnimal: z.string().max(1000).optional(),
  dietaryAllergy: z.string().max(1000).optional(),
  caregiver: z.string().max(1000).optional(),
  contactPreference: z.enum(['email','phone','text','in_app']).optional(),
  notes: z.string().max(2000).optional(),
});

const guestPrivacyRequestSchema = z.object({
  guestId: z.string().optional(),
  token: z.string().optional(),
  name: z.string().max(160).optional(),
  email: z.string().email().optional().or(z.literal('')),
  requestType: z.enum(['update_contact','delete_contact','data_question','consent_change']).default('data_question'),
  message: z.string().min(3).max(2000),
});

const guestReminderPreferencesSchema = z.object({
  guestId: z.string(),
  token: z.string().optional(),
  emailOptIn: z.boolean().optional(),
  smsOptIn: z.boolean().optional(),
  confirmationPreference: z.enum(['email','sms','both','none']).optional(),
  reminderTypes: z.array(z.enum(['rsvp','schedule','rain_plan','shuttle','directions','day_before','day_of'])).optional(),
  quietHoursStart: z.string().max(5).optional(),
  quietHoursEnd: z.string().max(5).optional(),
  language: z.string().max(12).optional(),
  sendInfo: z.enum(['schedule','directions']).optional(),
});

const guestDayOfHelpSchema = z.object({
  guestId: z.string().optional(),
  token: z.string().optional(),
  kind: z.enum(['running_late','need_help']).default('need_help'),
  name: z.string().max(160).optional(),
  email: z.string().email().optional().or(z.literal('')),
  message: z.string().max(1000).optional(),
});

const guestMemorySubmissionSchema = z.object({
  guestId: z.string().optional(),
  token: z.string().optional(),
  name: z.string().max(160).optional(),
  email: z.string().email().optional().or(z.literal('')),
  photoUrl: z.string().url().optional().or(z.literal('')),
  caption: z.string().max(1000).optional(),
  consent: z.boolean(),
});

const guestPostEventFeedbackSchema = z.object({
  guestId: z.string().optional(),
  token: z.string().optional(),
  name: z.string().max(160).optional(),
  npsScore: z.number().int().min(0).max(10),
  comment: z.string().max(2000).optional(),
  consentToContact: z.boolean().optional(),
});

const guestResendSchema = z.object({
  email: z.string().email(),
  name: z.string().max(160).optional(),
});


const guestHelpUpdateSchema = z.object({
  status: z.enum(['open','in_review','resolved','closed']).optional(),
  assignedTo: z.string().email().optional().or(z.literal('')),
  resolutionNote: z.string().max(2000).optional(),
  slaDueAt: z.string().optional().or(z.literal('')),
  slaDays: z.number().int().min(1).max(30).optional(),
});

const guestHelpReplySchema = z.object({
  channel: z.enum(['email','sms','in_app']).default('email'),
  message: z.string().min(1).max(2000),
  closeRequest: z.boolean().optional(),
});
function guestMetadata(g: NonNullable<ReturnType<typeof guestsRepo.findById>>) {
  try { return JSON.parse(g.metadata || '{}') as Record<string, any>; } catch { return {}; }
}

function guestHouseholdKey(g: NonNullable<ReturnType<typeof guestsRepo.findById>>) {
  const meta = guestMetadata(g);
  return String(meta.householdId || meta.householdName || g.party_name || '').trim().toLowerCase();
}

function publicGuest(g: NonNullable<ReturnType<typeof guestsRepo.findById>>, includePersonal = true, householdAuthorized = false) {
  const subEventInvites = db.prepare(`SELECT sub_event_id, rsvp_status FROM guest_sub_event_invitations WHERE guest_id = ?`).all(g.id) as Array<{ sub_event_id: string; rsvp_status: string }>;
  const meta = guestMetadata(g);
  const householdKey = guestHouseholdKey(g);
  return {
    id: g.id,
    fullName: includePersonal ? g.full_name : g.full_name.replace(/(^\S+)\s+(.).*$/, '$1 $2.'),
    tableAssignment: includePersonal ? g.table_assignment : null,
    seatAssignment: includePersonal ? g.seat_assignment : null,
    roomAssignment: includePersonal ? g.room_assignment : null,
    allowLodgingAccess: includePersonal && g.allow_lodging_access === 1,
    subEventInvites: includePersonal ? subEventInvites.map(r => r.sub_event_id) : [],
    subEventStatuses: includePersonal ? Object.fromEntries(subEventInvites.map((r) => [r.sub_event_id, r.rsvp_status])) : {},
    rsvpStatus: includePersonal ? g.rsvp_status : null,
    partyName: includePersonal ? g.party_name : null,
    householdId: includePersonal ? householdKey || null : null,
    householdName: includePersonal ? String(meta.householdName || g.party_name || '') || null : null,
    householdAuthorized,
    inviteStatus: g.allow_portal_access ? 'invited' : 'revoked',
    plusOneAllowed: includePersonal ? !!g.plus_one_allowed : false,
  };
}









function normalizeGuestPostEvent(portalConfig: Record<string, any>, metadata: Record<string, any>, event: any) {
  const start = event.start_date ? new Date(event.start_date).getTime() : 0;
  const afterEvent = start ? Date.now() >= start : false;
  const linksRaw = Array.isArray(portalConfig.memoryPhotoLinks) ? portalConfig.memoryPhotoLinks : Array.isArray(metadata.memoryPhotoLinks) ? metadata.memoryPhotoLinks : [];
  const links = linksRaw.map((link: any, index: number) => ({ id: String(link.id || `memory-${index}`), label: String(link.label || link.title || `Memory link ${index + 1}`), url: String(link.url || ''), description: String(link.description || '') })).filter((link: any) => /^https?:\/\//i.test(link.url));
  if (portalConfig.memoryShareUrl || metadata.memoryShareUrl) links.push({ id: 'memory-share', label: 'Memory/photo sharing link', url: String(portalConfig.memoryShareUrl || metadata.memoryShareUrl), description: '' });
  if (portalConfig.photoGalleryUrl || metadata.photoGalleryUrl) links.push({ id: 'photo-gallery', label: 'Photo gallery', url: String(portalConfig.photoGalleryUrl || metadata.photoGalleryUrl), description: '' });
  return {
    enabled: portalConfig.guestMemoryEnabled !== false,
    afterEvent,
    thankYouTitle: String(portalConfig.postEventThankYouTitle || metadata.postEventThankYouTitle || 'Thank you for celebrating with us'),
    thankYouMessage: String(portalConfig.postEventThankYouMessage || metadata.postEventThankYouMessage || 'We are grateful you joined the celebration.'),
    links: links.slice(0, 12),
    uploadEnabled: portalConfig.guestPhotoUploadEnabled !== false,
    moderationCopy: String(portalConfig.guestPhotoModerationCopy || 'Guest-submitted photos/links are reviewed before they are shared with the couple, gallery, or venue team.'),
    consentCopy: String(portalConfig.guestPhotoConsentCopy || 'By submitting a photo/link, you confirm you have permission to share it and understand it may be reviewed by the couple/venue team before publication.'),
    feedbackEnabled: portalConfig.guestPostEventFeedbackEnabled !== false,
    npsQuestion: String(portalConfig.guestNpsQuestion || 'How likely are you to recommend this venue guest experience to another guest?'),
  };
}

function normalizeGuestDayOf(portalConfig: Record<string, any>, metadata: Record<string, any>, eventId: string, tokenGuest: NonNullable<ReturnType<typeof guestsRepo.findById>> | null, token?: string) {
  const guestQuery = tokenGuest && token ? `?guest=${encodeURIComponent(tokenGuest.id)}&token=${encodeURIComponent(token)}` : '';
  return {
    enabled: portalConfig.dayOfModeEnabled !== false,
    title: String(portalConfig.dayOfModeTitle || metadata.dayOfModeTitle || 'Wedding day quick card'),
    contactLabel: String(portalConfig.dayOfContactLabel || portalConfig.accessibilityContactLabel || portalConfig.guestQuestionContactLabel || 'venue/couple team'),
    contactPhone: String(portalConfig.dayOfContactPhone || portalConfig.accessibilityContactPhone || ''),
    contactEmail: String(portalConfig.dayOfContactEmail || portalConfig.accessibilityContactEmail || portalConfig.guestQuestionContactEmail || ''),
    offlinePassUrl: `/api/portal/${eventId}/guest-pass.txt${guestQuery}`,
    staffHelpUrl: `/api/portal/${eventId}/staff-help${guestQuery}`,
    qrPayload: `WVI-GUEST-HELP:${eventId}:${tokenGuest?.id || 'anonymous'}`,
    pushAvailable: true,
    pushCopy: String(portalConfig.dayOfPushCopy || 'Allow browser notifications for rain-plan or shuttle changes on event day.'),
  };
}

function normalizeGuestReminders(portalConfig: Record<string, any>, metadata: Record<string, any>, organizationId: string, eventId: string, tokenGuest: NonNullable<ReturnType<typeof guestsRepo.findById>> | null) {
  const prefs = tokenGuest ? (guestMetadata(tokenGuest).reminderPreferences || {}) : {};
  return {
    providers: { emailConnected: !!activeSmtpIntegrationId(organizationId), smsConnected: !!activeSmsIntegrationId(organizationId) },
    defaults: {
      rsvpReminderEnabled: portalConfig.rsvpReminderEnabled !== false,
      scheduleReminderEnabled: portalConfig.scheduleReminderEnabled !== false,
      rainPlanReminderEnabled: portalConfig.rainPlanReminderEnabled !== false,
      shuttleReminderEnabled: portalConfig.shuttleReminderEnabled !== false,
      dayBeforeReminderEnabled: portalConfig.dayBeforeReminderEnabled !== false,
      dayOfReminderEnabled: portalConfig.dayOfReminderEnabled !== false,
      guestFriendlyCopy: String(portalConfig.reminderGuestFriendlyCopy || metadata.reminderGuestFriendlyCopy || 'We will only send helpful guest reminders such as RSVP deadlines, schedule updates, rain-plan changes, directions, shuttle times, and day-of arrival details.'),
    },
    preferences: {
      emailOptIn: prefs.emailOptIn === true,
      smsOptIn: prefs.smsOptIn === true,
      confirmationPreference: ['email','sms','both','none'].includes(String(prefs.confirmationPreference)) ? String(prefs.confirmationPreference) : 'email',
      reminderTypes: Array.isArray(prefs.reminderTypes) ? prefs.reminderTypes : ['rsvp','schedule','rain_plan','shuttle'],
      quietHoursStart: String(prefs.quietHoursStart || portalConfig.defaultQuietHoursStart || '21:00'),
      quietHoursEnd: String(prefs.quietHoursEnd || portalConfig.defaultQuietHoursEnd || '08:00'),
      language: String(prefs.language || 'en'),
    },
    actions: {
      scheduleAvailable: true,
      directionsAvailable: true,
      preferencesUrl: `/api/portal/${eventId}/reminder-preferences`,
    },
  };
}

function normalizeGuestPrivacy(portalConfig: Record<string, any>, metadata: Record<string, any>, identity: { mode: string; tokenStatus: string; guestDirectoryExposed: boolean }) {
  return {
    summary: String(portalConfig.privacySummary || metadata.privacySummary || 'Your RSVP details are used only to plan and host this event. Private weddings do not expose the full guest list by default.'),
    visibility: {
      rsvp: String(portalConfig.privacyRsvpVisibility || 'The couple, venue team, and authorized planners can see attendance and sub-event RSVP responses.'),
      meal: String(portalConfig.privacyMealVisibility || 'Meal choices and dietary details are shared with the couple, venue team, and catering team as needed.'),
      allergy: String(portalConfig.privacyAllergyVisibility || 'Allergy and severe allergy details are shared only with staff/vendors who need them for guest safety.'),
      accessibility: String(portalConfig.privacyAccessibilityVisibility || 'Accessibility and care requests are shared with venue/couple contacts who coordinate guest support.'),
      lodging: String(portalConfig.privacyLodgingVisibility || 'Lodging details are visible to the venue/couple team and only to invited guests when explicitly shared.'),
      notes: String(portalConfig.privacyNotesVisibility || 'Private notes are visible to the couple, venue team, and authorized planners.'),
    },
    consent: {
      emailReminderLabel: String(portalConfig.emailReminderConsentLabel || 'I agree to receive event email reminders and RSVP follow-up messages.'),
      smsReminderLabel: String(portalConfig.smsReminderConsentLabel || 'I agree to receive event SMS/text reminders if my phone number is on file.'),
    },
    retention: String(portalConfig.dataRetentionStatement || metadata.dataRetentionStatement || 'Guest RSVP and event-care records are retained only as long as needed for event operations, legal/accounting obligations, dispute resolution, and venue recordkeeping, then deleted or anonymized according to venue policy.'),
    correctionDeletion: {
      enabled: portalConfig.privacyRequestsEnabled !== false,
      contactLabel: String(portalConfig.privacyContactLabel || portalConfig.guestQuestionContactLabel || 'venue/couple privacy contact'),
      contactEmail: String(portalConfig.privacyContactEmail || portalConfig.guestQuestionContactEmail || ''),
    },
    antiAbuse: identity.tokenStatus === 'invalid' || identity.tokenStatus === 'revoked'
      ? 'This invitation link could not be verified. For safety, do not forward suspicious links; request a fresh secure link from the venue or couple.'
      : 'For privacy, use your secure invitation link and do not share guest portal links publicly.',
    access: {
      mode: identity.mode,
      tokenStatus: identity.tokenStatus,
      guestDirectoryExposed: identity.guestDirectoryExposed,
      privateWeddingDefault: !identity.guestDirectoryExposed,
    },
  };
}

function normalizeGuestCare(portalConfig: Record<string, any>, metadata: Record<string, any>) {
  return {
    contact: {
      label: String(portalConfig.accessibilityContactLabel || metadata.accessibilityContactLabel || portalConfig.guestQuestionContactLabel || 'venue accessibility contact'),
      email: String(portalConfig.accessibilityContactEmail || metadata.accessibilityContactEmail || portalConfig.guestQuestionContactEmail || ''),
      phone: String(portalConfig.accessibilityContactPhone || metadata.accessibilityContactPhone || ''),
      helpText: String(portalConfig.accessibilityHelpText || metadata.accessibilityHelpText || 'Share mobility, seating, sensory, interpretation/language, service animal, dietary/allergy, or caregiver needs so the venue can prepare before arrival.'),
    },
    details: {
      accessibleParking: String(portalConfig.accessibleParking || metadata.accessibleParking || ''),
      accessibleEntrance: String(portalConfig.accessibleEntrance || metadata.accessibleEntrance || portalConfig.guestEntranceLabel || ''),
      accessibleRestroom: String(portalConfig.accessibleRestroom || metadata.accessibleRestroom || portalConfig.restroomLabel || ''),
      accessibleSeating: String(portalConfig.accessibleSeating || metadata.accessibleSeating || ''),
      accessibleRoute: String(portalConfig.accessibilityRouteDetails || metadata.accessibilityRouteDetails || portalConfig.adaRouteLabel || ''),
      mobilityDropoff: String(portalConfig.mobilityDropoff || metadata.mobilityDropoff || ''),
    },
    requestTypes: ['mobility','seating','sensory','interpretation_language','service_animal','dietary_allergy','caregiver'],
    portalPreferences: { largeText: true, highContrast: true, languageSelector: true },
  };
}

function normalizeGuestGifts(portalConfig: Record<string, any>, metadata: Record<string, any>) {
  const rawStructured = Array.isArray(portalConfig.giftLinks) ? portalConfig.giftLinks : Array.isArray(metadata.giftLinks) ? metadata.giftLinks : [];
  const rawRegistry = String(portalConfig.registryLinks || metadata.registryLinks || '').split(',').map((link) => link.trim()).filter(Boolean);
  const fromRaw = rawRegistry.map((url, index) => {
    let label = `Registry ${index + 1}`;
    try {
      const host = new URL(url).hostname.replace(/^www\./, '');
      label = host.split('.')[0]?.replace(/[-_]/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase()) || label;
    } catch {}
    return { id: `registry-${index}`, type: 'registry', label, url, description: '' };
  });
  const structured = rawStructured.map((link: any, index: number) => ({
    id: String(link.id || `${link.type || 'gift'}-${index}`),
    type: ['registry','honeymoon','charity','cash','website','other'].includes(String(link.type || '').toLowerCase()) ? String(link.type).toLowerCase() : 'registry',
    label: String(link.label || link.title || link.name || `Gift link ${index + 1}`),
    url: String(link.url || link.href || ''),
    description: String(link.description || link.note || ''),
  })).filter((link: any) => /^https?:\/\//i.test(link.url));
  const all = [...structured, ...fromRaw.filter((raw) => !structured.some((s: any) => s.url === raw.url))].slice(0, 20);
  return {
    links: all,
    cardsGiftTableLocation: String(portalConfig.cardsGiftTableLocation || metadata.cardsGiftTableLocation || ''),
    note: String(portalConfig.registryGiftNote || metadata.registryGiftNote || ''),
    externalLinkWarning: 'Gift and registry links open in a new tab on an external website. Only use links shared by the couple or venue.',
  };
}

function normalizeGuestFaq(portalConfig: Record<string, any>, metadata: Record<string, any>) {
  const languagesRaw = Array.isArray(portalConfig.faqLanguages) ? portalConfig.faqLanguages : Array.isArray(metadata.faqLanguages) ? metadata.faqLanguages : [];
  const availableLanguages = [{ code: 'en', label: 'English' }, ...languagesRaw.map((lang: any) => ({ code: String(lang.code || lang.id || '').slice(0, 12), label: String(lang.label || lang.name || lang.code || '') })).filter((lang: any) => lang.code && lang.code !== 'en')].slice(0, 8);
  const rawItems = Array.isArray(portalConfig.guestFaqItems) ? portalConfig.guestFaqItems : Array.isArray(metadata.guestFaqItems) ? metadata.guestFaqItems : [];
  const fallbackFaqText = String(portalConfig.faqText || metadata.faqText || '').trim();
  const fallbackItems = fallbackFaqText
    ? fallbackFaqText.split(/\n{2,}/).map((block, index) => {
        const [first, ...rest] = block.split('\n');
        return { id: `faq-${index}`, category: 'General', question: first || 'Guest FAQ', answer: rest.join('\n') || first || '' };
      })
    : [];
  const items = (rawItems.length ? rawItems : fallbackItems).map((item: any, index: number) => ({
    id: String(item.id || `faq-${index}`),
    category: String(item.category || 'General'),
    question: String(item.question || item.q || 'Question'),
    answer: String(item.answer || item.a || ''),
    translations: item.translations && typeof item.translations === 'object' ? item.translations : {},
  })).filter((item: any) => item.question || item.answer).slice(0, 80);
  const categories = Array.from(new Set(['Dress code', 'Arrival', 'Kids & plus-ones', 'Ceremony', 'Reception', 'Accessibility', ...items.map((item: any) => item.category).filter(Boolean)])).slice(0, 20);
  return {
    dressCode: {
      summary: String(portalConfig.dressCodeSummary || metadata.dressCodeSummary || portalConfig.dressCode || metadata.dressCode || 'Dress code details have not been posted yet.'),
      examples: String(portalConfig.dressCodeExamples || metadata.dressCodeExamples || ''),
      weather: String(portalConfig.dressCodeWeather || metadata.dressCodeWeather || portalConfig.weatherRainPlanNote || ''),
      rainPlan: String(portalConfig.dressCodeRainPlan || metadata.dressCodeRainPlan || portalConfig.indoorRainPlanMapNote || ''),
    },
    policies: {
      kidsPolicy: String(portalConfig.kidsPolicy || metadata.kidsPolicy || 'Kids policy has not been posted yet.'),
      plusOneRules: String(portalConfig.plusOneRules || metadata.plusOneRules || 'Please only bring guests listed on your invitation.'),
      phonePhotoPolicy: String(portalConfig.phonePhotoPolicy || metadata.phonePhotoPolicy || 'Ceremony phone/photo policy has not been posted yet.'),
      smokingVapingPolicy: String(portalConfig.smokingVapingPolicy || metadata.smokingVapingPolicy || 'Smoking/vaping policy has not been posted yet.'),
      barAlcoholPolicy: String(portalConfig.barAlcoholPolicy || metadata.barAlcoholPolicy || 'Bar/alcohol policy has not been posted yet.'),
    },
    categories,
    items,
    multilingual: { availableLanguages },
    askQuestion: {
      enabled: portalConfig.guestQuestionsEnabled !== false,
      contactLabel: String(portalConfig.guestQuestionContactLabel || metadata.guestQuestionContactLabel || 'venue/couple team'),
    },
  };
}

function normalizeWayfindingLabels(portalConfig: Record<string, any>, metadata: Record<string, any>) {
  const labels = Array.isArray(portalConfig.guestWayfindingLabels) ? portalConfig.guestWayfindingLabels : Array.isArray(metadata.guestWayfindingLabels) ? metadata.guestWayfindingLabels : [];
  const fallback = [
    ['parking', portalConfig.parkingEntrance || metadata.parkingEntrance, 'Parking / guest lot'],
    ['entrance', portalConfig.guestEntranceLabel || metadata.guestEntranceLabel, 'Guest entrance'],
    ['ceremony', portalConfig.ceremonySpaceLabel || metadata.ceremonySpaceLabel, 'Ceremony space'],
    ['reception', portalConfig.receptionSpaceLabel || metadata.receptionSpaceLabel, 'Reception space'],
    ['restroom', portalConfig.restroomLabel || metadata.restroomLabel, 'Restrooms'],
    ['bar', portalConfig.barLabel || metadata.barLabel, 'Bar'],
    ['buffet', portalConfig.buffetLabel || metadata.buffetLabel, 'Buffet'],
    ['dance_floor', portalConfig.danceFloorLabel || metadata.danceFloorLabel, 'Dance floor'],
    ['ada_route', portalConfig.adaRouteLabel || portalConfig.accessibilityRouteDetails || metadata.adaRouteLabel, 'ADA / accessible route'],
  ];
  const normalized = labels.map((label: any, index: number) => ({
    id: String(label.id || label.key || `wayfinding-${index}`),
    type: String(label.type || label.key || 'custom'),
    label: String(label.label || label.title || label.name || ''),
    details: String(label.details || label.description || label.note || ''),
  })).filter((label: any) => label.label || label.details);
  for (const [type, value, label] of fallback) {
    if (value && !normalized.some((item: any) => item.type === type)) {
      normalized.push({ id: String(type), type: String(type), label: String(label), details: String(value) });
    }
  }
  return normalized.slice(0, 30);
}

function safeGuestLayoutPayload(layoutPayload: any, tokenGuest: NonNullable<ReturnType<typeof guestsRepo.findById>> | null, portalConfig: Record<string, any>) {
  if (!layoutPayload || !Array.isArray(layoutPayload.items)) return layoutPayload;
  const personalOnly = portalConfig.seatingPrivacyMode === 'personal_only' || portalConfig.showOnlyPersonalSeat === true;
  if (!personalOnly) return layoutPayload;
  return {
    ...layoutPayload,
    privacyMode: 'personal_only',
    items: layoutPayload.items
      .filter((item: any) => item.type !== 'chair' || !item.guestId || (tokenGuest && item.guestId === tokenGuest.id))
      .map((item: any) => {
        if (item.type !== 'chair') return item;
        if (tokenGuest && item.guestId === tokenGuest.id) return item;
        return { ...item, guestId: null, guestInitials: null, label: '' };
      }),
  };
}

function verifyGuestPortalToken(g: NonNullable<ReturnType<typeof guestsRepo.findById>>, token?: string | null) {
  if (!g.allow_portal_access) return 'revoked' as const;
  if (!token) return 'missing' as const;
  if (!g.portal_token_hash || !g.portal_token_salt) return 'missing' as const;
  if (g.portal_token_expires_at && g.portal_token_expires_at <= new Date().toISOString()) return 'expired' as const;
  if (!verifyCapabilitySecret(token, { token_hash: g.portal_token_hash, token_salt: g.portal_token_salt })) return 'invalid' as const;
  db.prepare(`UPDATE guests SET portal_token_last_used_at = datetime('now') WHERE id = ?`).run(g.id);
  return 'valid' as const;
}

function activeSmtpIntegrationId(organizationId: string) {
  const row = db.prepare(`SELECT id FROM integrations WHERE organization_id = ? AND provider = 'email_smtp' AND status = 'connected' LIMIT 1`).get(organizationId) as { id: string } | undefined;
  return row?.id ?? null;
}

function activeSmsIntegrationId(organizationId: string) {
  const row = db.prepare(`SELECT id FROM integrations WHERE organization_id = ? AND provider = 'sms_twilio' AND status = 'connected' LIMIT 1`).get(organizationId) as { id: string } | undefined;
  return row?.id ?? null;
}

function addDaysIso(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch] || ch));
}

function isGuestTimelineItem(item: any) {
  const text = `${item.title || ''} ${item.category || ''} ${item.notes || ''}`.toLowerCase();
  const hidden = ['vendor', 'load-in', 'load in', 'load-out', 'load out', 'setup', 'strike', 'staff', 'internal', 'incident', 'prep', 'kitchen', 'security'];
  return !hidden.some((term) => text.includes(term));
}

function safeGuestTimelineItem(item: any) {
  return {
    id: item.id,
    title: item.title,
    category: item.category,
    starts_at: item.starts_at,
    ends_at: item.ends_at,
    location: item.location,
    description: item.description || null,
  };
}

function eventTimezone(metadata: Record<string, any>) {
  return String(metadata.timezone || metadata.eventTimezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'local');
}

function icsDate(value: string | null | undefined) {
  if (!value) return '';
  return new Date(value).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

function guestCalendarIcs(input: { event: any; timeline: any[]; subEvents: any[]; metadata: Record<string, any> }) {
  const escape = (value: string) => String(value || '').replace(/\n/g, ' ').replace(/,/g, '\\,');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Wedding Venue Intelligence//Guest Schedule//EN'];
  for (const item of input.timeline) {
    if (!item.starts_at) continue;
    lines.push('BEGIN:VEVENT', `UID:${item.id}@wvi`, `SUMMARY:${escape(item.title)}`, `DTSTART:${icsDate(item.starts_at)}`);
    if (item.ends_at) lines.push(`DTEND:${icsDate(item.ends_at)}`);
    if (item.location) lines.push(`LOCATION:${escape(item.location)}`);
    if (item.description) lines.push(`DESCRIPTION:${escape(item.description)}`);
    lines.push('END:VEVENT');
  }
  for (const sub of input.subEvents) {
    if (!sub.starts_at) continue;
    const meta = typeof sub.metadata === 'string' ? (() => { try { return JSON.parse(sub.metadata || '{}'); } catch { return {}; } })() : (sub.metadata || {});
    lines.push('BEGIN:VEVENT', `UID:${sub.id}@wvi`, `SUMMARY:${escape(sub.title)}`, `DTSTART:${icsDate(sub.starts_at)}`);
    if (sub.ends_at) lines.push(`DTEND:${icsDate(sub.ends_at)}`);
    if (meta.location || sub.location) lines.push(`LOCATION:${escape(meta.location || sub.location)}`);
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}


function safeGuestHelpRequest(row: any) {
  return {
    id: row.id,
    organizationId: row.organization_id,
    eventId: row.event_id,
    guestId: row.guest_id,
    kind: row.kind,
    name: row.name,
    email: row.email,
    message: row.message,
    status: row.status,
    assignedTo: row.assigned_to,
    resolutionNote: row.resolution_note,
    slaDueAt: row.sla_due_at,
    slaStatus: row.status === 'resolved' || row.status === 'closed' ? 'closed' : row.sla_due_at && row.sla_due_at < new Date().toISOString().slice(0, 10) ? 'overdue' : row.sla_due_at ? 'on_track' : 'unset',
    lastReplyAt: row.last_reply_at,
    lastReplyChannel: row.last_reply_channel,
    lastReplyJobId: row.last_reply_job_id,
    lastReplyStatus: row.last_reply_status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function safeGuestHelpReply(row: any) {
  return {
    id: row.id,
    requestId: row.request_id,
    channel: row.channel,
    body: row.body,
    dispatchStatus: row.dispatch_status,
    jobId: row.job_id,
    sentByLabel: row.sent_by_label || 'Venue team',
    createdAt: row.created_at,
  };
}

function requireCoupleGuestManager(memberships: any[], eventId: string) {
  if (!memberships.some((membership) => membership.eventId === eventId && String(membership.roleKey).toLowerCase() === 'couple')) throw Forbidden();
}

export async function guestRoutes(app: FastifyInstance) {
  app.get('/api/events/:eventId/guest-portal-security', { preHandler: requireAuth }, async (req) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound();
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'guests.view', orgMap)) throw Forbidden();
    const rows = db.prepare(`SELECT * FROM audit_logs WHERE organization_id = ? AND (target_id = ? OR details LIKE ?) AND (action LIKE 'public.portal.%' OR action LIKE 'public.rsvp.%' OR action LIKE 'public.abuse.%') ORDER BY created_at DESC LIMIT 250`)
      .all(event.organization_id, eventId, `%${eventId}%`) as any[];
    const parse = (value: string) => { try { return JSON.parse(value || '{}'); } catch { return {}; } };
    const audits = rows.map((row) => ({ id: row.id, action: row.action, targetType: row.target_type, targetId: row.target_id, ip: row.ip, userAgent: row.user_agent, deviceSession: parse(row.details).deviceSession || null, details: parse(row.details), createdAt: row.created_at }));
    const counts = audits.reduce((acc: Record<string, number>, row) => { acc[row.action] = (acc[row.action] || 0) + 1; return acc; }, {});
    const deviceCounts = audits.reduce((acc: Record<string, number>, row) => { const key = row.deviceSession || 'unknown'; acc[key] = (acc[key] || 0) + 1; return acc; }, {});
    const suspicious = audits.filter((row) => row.action.includes('abuse') || row.action.includes('failed') || row.action.includes('suspicious') || row.action.includes('token_failed'));
    const cfg = portalConfigRepo.getForEvent(eventId) as any;
    const portalConfig = cfg ? (typeof cfg.config === 'string' ? JSON.parse(cfg.config || '{}') : (cfg.config || {})) : {};
    return {
      summary: {
        totalAudits: audits.length,
        suspiciousCount: suspicious.length,
        uniqueDeviceSessions: Object.keys(deviceCounts).filter((k) => k !== 'unknown').length,
        genericGuestDirectoryExposed: portalConfig.allowGenericGuestDirectory === true,
        tokenizedLinksPreferred: true,
        rateLimitsAndHoneypotsActive: true,
      },
      counts,
      topDeviceSessions: Object.entries(deviceCounts).map(([deviceSession, count]) => ({ deviceSession, count })).sort((a, b) => b.count - a.count).slice(0, 8),
      suspicious: suspicious.slice(0, 25),
      audits: audits.slice(0, 80),
    };
  });

  app.get('/api/events/:eventId/guest-help-requests', { preHandler: requireAuth }, async (req) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound();
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'guests.view', orgMap)) throw Forbidden();
    const rows = db.prepare(`SELECT * FROM guest_help_requests WHERE event_id = ? ORDER BY CASE status WHEN 'open' THEN 0 WHEN 'in_review' THEN 1 ELSE 2 END, created_at DESC LIMIT 200`).all(eventId);
    return { requests: rows.map(safeGuestHelpRequest), counts: { open: rows.filter((r: any) => r.status === 'open').length, inReview: rows.filter((r: any) => r.status === 'in_review').length, resolved: rows.filter((r: any) => r.status === 'resolved').length, closed: rows.filter((r: any) => r.status === 'closed').length } };
  });

  app.get('/api/events/:eventId/catering-dietary-export.csv', { preHandler: requireAuth }, async (req, reply) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound();
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'guests.view', orgMap)) throw Forbidden();
    const rows = db.prepare(`SELECT g.full_name, g.email, g.phone, g.party_name, g.table_assignment, g.seat_assignment, g.room_assignment, g.dietary_restrictions, g.accessibility_notes, r.meal_choice, r.dietary_notes, r.special_needs, r.notes, r.submitted_at
      FROM guests g
      LEFT JOIN rsvp_submissions r ON r.id = (SELECT id FROM rsvp_submissions WHERE guest_id = g.id ORDER BY submitted_at DESC LIMIT 1)
      WHERE g.event_id = ? AND g.deleted_at IS NULL
      ORDER BY g.full_name`).all(eventId) as Array<Record<string, any>>;
    const escape = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const csv = [
      ['Guest','Email','Phone','Household','Table','Seat','Lodging','Meal choice','Dietary restrictions','Allergies / dietary notes','Accessibility needs','Catering notes','Submitted at'].map(escape).join(','),
      ...rows.map((r) => [r.full_name, r.email, r.phone, r.party_name, r.table_assignment, r.seat_assignment, r.room_assignment, r.meal_choice, r.dietary_restrictions, r.dietary_notes, r.accessibility_notes, [r.special_needs, r.notes].filter(Boolean).join(' | '), r.submitted_at].map(escape).join(',')),
    ].join('\n');
    auditRepo.log({ organizationId: event.organization_id, actorUserId: req.auth!.userId, actorLabel: req.auth!.email, action: 'guests.catering_dietary_export', targetType: 'event', targetId: eventId, ip: req.ip, details: { rows: rows.length } });
    return reply.header('content-type', 'text/csv; charset=utf-8').header('content-disposition', `attachment; filename="catering-dietary-${eventId}.csv"`).send(csv);
  });

  app.patch('/api/events/:eventId/guest-help-requests/:requestId', { preHandler: requireAuth }, async (req) => {
    const { eventId, requestId } = req.params as { eventId: string; requestId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound();
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'guests.manage', orgMap)) throw Forbidden();
    const parsed = guestHelpUpdateSchema.safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    const current = db.prepare(`SELECT * FROM guest_help_requests WHERE id = ? AND event_id = ?`).get(requestId, eventId) as any;
    if (!current) throw NotFound('guest-help-request-not-found');
    const nextStatus = parsed.data.status ?? current.status;
    const slaDueAt = parsed.data.slaDueAt || (parsed.data.slaDays ? addDaysIso(parsed.data.slaDays) : null);
    db.prepare(`UPDATE guest_help_requests SET status = ?, assigned_to = COALESCE(?, assigned_to), resolution_note = COALESCE(?, resolution_note), sla_due_at = COALESCE(?, sla_due_at), updated_at = datetime('now') WHERE id = ?`).run(nextStatus, parsed.data.assignedTo || null, parsed.data.resolutionNote || null, slaDueAt, requestId);
    auditRepo.log({ organizationId: event.organization_id, actorUserId: req.auth!.userId, actorLabel: req.auth!.email, action: 'portal.guest_help_request.update', targetType: 'guest_help_request', targetId: requestId, ip: req.ip, details: { status: nextStatus, assignedTo: parsed.data.assignedTo, slaDueAt } });
    return { request: safeGuestHelpRequest(db.prepare(`SELECT * FROM guest_help_requests WHERE id = ?`).get(requestId)) };
  });

  app.post('/api/events/:eventId/guest-help-requests/:requestId/reply', { preHandler: requireAuth }, async (req, reply) => {
    const { eventId, requestId } = req.params as { eventId: string; requestId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound();
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'guests.manage', orgMap)) throw Forbidden();
    const parsed = guestHelpReplySchema.safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    const current = db.prepare(`SELECT * FROM guest_help_requests WHERE id = ? AND event_id = ?`).get(requestId, eventId) as any;
    if (!current) throw NotFound('guest-help-request-not-found');
    const guest = current.guest_id ? guestsRepo.findById(current.guest_id) : null;
    const recipient = parsed.data.channel === 'email' ? (current.email || guest?.email || null) : parsed.data.channel === 'sms' ? (guest?.phone || null) : null;
    let jobId: string | null = null;
    let status = parsed.data.channel === 'in_app' ? 'in_app_recorded' : 'missing_recipient';
    if (parsed.data.channel === 'email' && recipient) {
      const smtpId = activeSmtpIntegrationId(event.organization_id);
      if (smtpId) {
        const job = jobsRepo.enqueue({ kind: 'email.send', organizationId: event.organization_id, payload: { integrationId: smtpId, to: recipient, subject: `${event.title} guest portal help`, text: parsed.data.message, html: `<p>${escapeHtml(parsed.data.message).replace(/\n/g, '<br/>')}</p>` } });
        jobId = job.id; status = 'email_job_queued';
      } else status = 'email_provider_not_connected';
    }
    if (parsed.data.channel === 'sms' && recipient) {
      const smsId = activeSmsIntegrationId(event.organization_id);
      if (smsId) {
        const job = jobsRepo.enqueue({ kind: 'sms.send', organizationId: event.organization_id, payload: { integrationId: smsId, to: recipient, body: parsed.data.message } });
        jobId = job.id; status = 'sms_job_queued';
      } else status = 'sms_provider_not_connected';
    }
    const nextStatus = parsed.data.closeRequest ? 'resolved' : current.status === 'open' ? 'in_review' : current.status;
    db.prepare(`UPDATE guest_help_requests SET status = ?, last_reply_at = datetime('now'), last_reply_channel = ?, last_reply_job_id = ?, last_reply_status = ?, resolution_note = COALESCE(?, resolution_note), updated_at = datetime('now') WHERE id = ?`).run(nextStatus, parsed.data.channel, jobId, status, parsed.data.closeRequest ? 'Replied and resolved.' : null, requestId);
    const replyId = uuid();
    db.prepare(`INSERT INTO guest_help_request_replies (id, organization_id, event_id, request_id, guest_id, channel, body, dispatch_status, job_id, sent_by, sent_by_label, visible_to_guest) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`)
      .run(replyId, event.organization_id, eventId, requestId, current.guest_id || null, parsed.data.channel, parsed.data.message, status, jobId, req.auth!.userId, req.auth!.email);
    auditRepo.log({ organizationId: event.organization_id, actorUserId: req.auth!.userId, actorLabel: req.auth!.email, action: 'portal.guest_help_request.reply', targetType: 'guest_help_request', targetId: requestId, ip: req.ip, details: { channel: parsed.data.channel, status, jobId, recipient: !!recipient, replyId } });
    return reply.code(201).send({ request: safeGuestHelpRequest(db.prepare(`SELECT * FROM guest_help_requests WHERE id = ?`).get(requestId)), reply: safeGuestHelpReply(db.prepare(`SELECT * FROM guest_help_request_replies WHERE id = ?`).get(replyId)), jobId, dispatchStatus: status });
  });

  // Venue staff have an operational, read-only manifest; couple guest records remain private to mutation workflows.
  app.get('/api/events/:eventId/venue-guest-manifest', { preHandler: requireAuth }, async (req) => {
    const { eventId } = req.params as { eventId: string }; const event = eventsRepo.findById(eventId); if (!event) throw NotFound();
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId); if (!can(req.auth!.memberships, { eventId }, 'guests.view', orgMap)) throw Forbidden();
    const guests = guestsRepo.listForEvent(eventId).filter((guest: any) => guest.rsvp_status === 'attending').map((guest: any) => { let metadata: any = {}; try { metadata = JSON.parse(guest.metadata || '{}'); } catch {} return { id: guest.id, fullName: guest.full_name, rsvpStatus: guest.rsvp_status, partyName: guest.party_name, relationship: metadata.relationship || null, bridalParty: !!metadata.bridalParty, tableAssignment: guest.table_assignment, seatAssignment: guest.seat_assignment }; });
    return { guests, counts: guestsRepo.countByStatus(eventId) };
  });

  // ─── List guests for an event ─────────────────────────
  app.get('/api/events/:eventId/guests', { preHandler: requireAuth }, async (req) => {
    const { eventId } = req.params as { eventId: string };
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'guests.view', orgMap)) throw Forbidden();
    
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound();

    const layouts = layoutsRepo.listForOrg(event.organization_id, { eventId });
    const layout = layouts.length > 0 ? layouts[0] : null;
    let layoutPayload = null;
    if (layout) {
       try { layoutPayload = typeof layout.payload === 'string' ? JSON.parse(layout.payload) : layout.payload; } catch {}
    }

    return {
      layout: layoutPayload,
      guests: guestsRepo.listForEvent(eventId),
      counts: guestsRepo.countByStatus(eventId),
    };
  });


  // ─── List guests across all events in an org ──────────
  app.get("/api/orgs/:orgId/guests", { preHandler: requireAuth }, async (req) => {
    const { orgId } = req.params as { orgId: string };
    if (!can(req.auth!.memberships, { organizationId: orgId }, "guests.view")) throw Forbidden();

    const q = req.query as {
      search?: string;
      rsvpStatus?: string;
      eventId?: string;
      limit?: string;
      offset?: string;
    };
    const rsvpStatusList = q.rsvpStatus
      ? q.rsvpStatus.split(",").filter(Boolean)
      : undefined;

    const result = guestsRepo.listForOrg(orgId, {
      search: q.search,
      rsvpStatus: rsvpStatusList,
      eventId: q.eventId,
      limit: q.limit ? Number(q.limit) : undefined,
      offset: q.offset ? Number(q.offset) : undefined,
    });
    const counts = guestsRepo.countByStatusForOrg(orgId);

    return { guests: result.guests, total: result.total, counts };
  });

  // ─── Guest identity resolution: duplicate clusters across events ──
  app.get("/api/orgs/:orgId/guest-duplicates", { preHandler: requireAuth }, async (req) => {
    const { orgId } = req.params as { orgId: string };
    if (!can(req.auth!.memberships, { organizationId: orgId }, "guests.view")) throw Forbidden();
    return { clusters: guestIdentityRepo.findDuplicates(orgId) };
  });

  // ─── Cross-event guest merge retired ──────────────────────
  app.post("/api/orgs/:orgId/guests/merge", { preHandler: requireAuth }, async () => {
    // Couples manage guest identity within their own event; venue-wide merge is intentionally unavailable.
    throw Forbidden();
  });

  
  app.post('/api/events/:eventId/guests/bulk', { preHandler: requireAuth }, async (req, reply) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound();
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'guests.manage', orgMap)) throw Forbidden(); requireCoupleGuestManager(req.auth!.memberships, eventId);
    
    const bulkSchema = z.object({
      mode: z.enum(['skip', 'replace', 'append']),
      guests: z.array(guestSchema),
    });
    
    const parsed = bulkSchema.safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    
    const result = guestsRepo.bulkCreate(event.organization_id, eventId, parsed.data.mode, parsed.data.guests);
    auditRepo.log({
      organizationId: event.organization_id, actorUserId: req.auth!.userId,
      actorLabel: req.auth!.email, action: 'guest.bulk_create',
      targetType: 'event', targetId: eventId, ip: req.ip,
    });
    return reply.code(201).send(result);
  });

  app.post('/api/events/:eventId/guests', { preHandler: requireAuth }, async (req, reply) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound();
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'guests.manage', orgMap)) throw Forbidden(); requireCoupleGuestManager(req.auth!.memberships, eventId);
    const parsed = guestSchema.safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    const guest = guestsRepo.create(event.organization_id, eventId, parsed.data);
    auditRepo.log({
      organizationId: event.organization_id, actorUserId: req.auth!.userId,
      actorLabel: req.auth!.email, action: 'guest.create',
      targetType: 'guest', targetId: guest.id, ip: req.ip,
    });
    broadcastSSE(event.organization_id, "guest.created", { guestId: guest.id, eventId, name: guest.full_name }, req.auth!.userId);
    return reply.code(201).send({ guest });
  });

  app.patch('/api/guests/:id', { preHandler: requireAuth }, async (req) => {
    const { id } = req.params as { id: string };
    const guest = guestsRepo.findById(id);
    if (!guest) throw NotFound();
    if (!can(req.auth!.memberships, { organizationId: guest.organization_id }, 'guests.manage')) throw Forbidden(); requireCoupleGuestManager(req.auth!.memberships, guest.event_id);
    const parsed = guestSchema.partial().safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    const updated = guestsRepo.update(id, parsed.data);
    broadcastSSE(guest.organization_id, "guest.updated", { guestId: id, eventId: guest.event_id }, req.auth!.userId);
    return { guest: updated };
  });

  app.delete('/api/guests/:id', { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const guest = guestsRepo.findById(id);
    if (!guest) throw NotFound();
    if (!can(req.auth!.memberships, { organizationId: guest.organization_id }, 'guests.manage')) throw Forbidden(); requireCoupleGuestManager(req.auth!.memberships, guest.event_id);
    guestsRepo.softDelete(id);
    return reply.code(204).send();
  });

  app.post('/api/guests/:id/portal-token', { preHandler: requireAuth }, async (req) => {
    const { id } = req.params as { id: string };
    const guest = guestsRepo.findById(id);
    if (!guest) throw NotFound();
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId); if (!can(req.auth!.memberships, { eventId: guest.event_id }, 'guests.manage', orgMap)) throw Forbidden(); requireCoupleGuestManager(req.auth!.memberships, guest.event_id);
    const token = guestsRepo.rotatePortalToken(id);
    return { token };
  });

  app.delete('/api/guests/:id/portal-token', { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const guest = guestsRepo.findById(id);
    if (!guest) throw NotFound();
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId); if (!can(req.auth!.memberships, { eventId: guest.event_id }, 'guests.manage', orgMap)) throw Forbidden(); requireCoupleGuestManager(req.auth!.memberships, guest.event_id);
    guestsRepo.revokePortalToken(id);
    return reply.code(204).send();
  });

  // ─── RSVPs (authenticated list) ───────────────────────
  app.get('/api/events/:eventId/rsvps', { preHandler: requireAuth }, async (req) => {
    const { eventId } = req.params as { eventId: string };
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'rsvp.view', orgMap)) throw Forbidden();
    return { rsvps: rsvpRepo.listForEvent(eventId) };
  });

  // ─── Portal config (authenticated) ────────────────────
  app.get('/api/events/:eventId/portal-config', { preHandler: requireAuth }, async (req) => {
    const { eventId } = req.params as { eventId: string };
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'portal.config.manage', orgMap)) throw Forbidden();
    return { config: portalConfigRepo.getForEvent(eventId) };
  });

  app.put('/api/events/:eventId/portal-config', { preHandler: requireAuth }, async (req) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound();
    if (!can(req.auth!.memberships, { organizationId: event.organization_id }, 'portal.config.manage')) throw Forbidden();
    const parsed = portalConfigSchema.safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);

    let passwordHash: string | null | undefined;
    let passwordSalt: string | null | undefined;
    if (parsed.data.password) {
      const rec = hashPassword(parsed.data.password);
      passwordHash = rec.passwordHash;
      passwordSalt = rec.passwordSalt;
    } else if (parsed.data.clearPassword) {
      passwordHash = null;
      passwordSalt = null;
    }

    const config = portalConfigRepo.upsert({
      organizationId: event.organization_id,
      eventId,
      enabled: parsed.data.enabled,
      passwordHash, passwordSalt,
      accessStartsAt: parsed.data.accessStartsAt,
      accessEndsAt: parsed.data.accessEndsAt,
      gracePeriodHours: parsed.data.gracePeriodHours,
      config: parsed.data.config,
      updatedBy: req.auth!.userId,
    });
    auditRepo.log({
      organizationId: event.organization_id, actorUserId: req.auth!.userId,
      actorLabel: req.auth!.email, action: 'portal_config.update',
      targetType: 'event', targetId: eventId, ip: req.ip,
    });
    return { config };
  });

  // ─── PUBLIC portal endpoints ──────────────────────────
  app.get('/api/portal/:eventId/status', { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } }, async (req) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound();
    const cfg = portalConfigRepo.getForEvent(eventId) as any;
    const org = orgsRepo.findById(event.organization_id);
    let brandingConfig: Record<string, any> = {};
    try {
      const settings = org ? (typeof org.settings === 'string' ? JSON.parse(org.settings) : org.settings) : {};
      const branding = org ? (typeof org.branding === 'string' ? JSON.parse(org.branding || '{}') : org.branding) : {};
      brandingConfig = settings?.platformConfig?.branding ?? branding ?? {};
    } catch {}
    const portalConfig = cfg ? (typeof cfg.config === 'string' ? JSON.parse(cfg.config || '{}') : (cfg.config || {})) : {};
    const supportEmail = String(portalConfig.supportEmail || brandingConfig.supportEmail || org?.support_email || '');
    const supportPhone = String(portalConfig.supportPhone || brandingConfig.supportPhone || '');
    const enabled = cfg ? !!cfg.enabled : true;
    return {
      event: { id: event.id, title: event.title, startDate: event.start_date },
      status: enabled ? 'available' : 'disabled',
      support: { label: String(portalConfig.supportLabel || brandingConfig.platformName || org?.name || 'venue/couple team'), email: supportEmail, phone: supportPhone },
      message: enabled ? 'Guest portal is available.' : String(portalConfig.portalDisabledMessage || 'This guest portal is currently disabled by the venue/couple team.'),
      recovery: {
        requestNewLink: true,
        helpKinds: ['expired_or_revoked','cannot_find_name','wrong_guest','other'],
      },
    };
  });

  app.get('/api/portal/:eventId/info', { config: { rateLimit: { max: 120, timeWindow: '1 minute' } } }, async (req, reply) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound();
    const cfg = portalConfigRepo.getForEvent(eventId) as { enabled: number; password_hash: string | null } | undefined;
    const requiresPassword = !!cfg?.password_hash;
    // Security: return 404 if portal is explicitly disabled
    if (cfg && !cfg.enabled) throw NotFound("portal-disabled");
    const q = req.query as { guest?: string; token?: string };
    const requestedGuest = q.guest ? guestsRepo.findById(q.guest) : undefined;
    const tokenStatus = requestedGuest && requestedGuest.event_id === eventId ? verifyGuestPortalToken(requestedGuest, q.token) : q.guest ? 'invalid' as const : 'missing' as const;
    const tokenGuest = requestedGuest && requestedGuest.event_id === eventId && tokenStatus === 'valid' ? requestedGuest : null;
    const portalConfig = cfg ? (typeof (cfg as any).config === 'string' ? JSON.parse((cfg as any).config || '{}') : ((cfg as any).config || {})) : {};
    const genericDirectoryEnabled = portalConfig.allowGenericGuestDirectory === true;
    const householdKey = tokenGuest ? guestHouseholdKey(tokenGuest) : '';
    const allowHouseholdRsvp = portalConfig.allowHouseholdRsvp !== false;
    const householdGuests = tokenGuest && householdKey && allowHouseholdRsvp
      ? guestsRepo.listForEvent(eventId).filter((g) => g.allow_portal_access && guestHouseholdKey(g) === householdKey)
      : [];
    const guestList = tokenGuest
      ? (householdGuests.length ? householdGuests : [tokenGuest]).map((g) => publicGuest(g, true, !!householdKey && allowHouseholdRsvp))
      : genericDirectoryEnabled
        ? guestsRepo.listForEvent(eventId).filter((g) => g.allow_portal_access).map((g) => publicGuest(g, true, false))
        : [];
    // Include org theme for portal styling
    const org = orgsRepo.findById(event.organization_id);
    let themeConfig = null;
    let brandingConfig: Record<string, unknown> = {};
    if (org) {
      try {
        const settings = typeof org.settings === "string" ? JSON.parse(org.settings) : org.settings;
        const branding = typeof org.branding === "string" ? JSON.parse(org.branding || '{}') : org.branding;
        themeConfig = settings?.platformConfig?.theme ?? null;
        brandingConfig = settings?.platformConfig?.branding ?? branding ?? {};
      } catch {}
    }
    // Include layout for the map viewer
    const layouts = layoutsRepo.listForOrg(event.organization_id, { eventId });
    const layoutPayload = layouts.length > 0 ? (typeof layouts[0].payload === "string" ? JSON.parse(layouts[0].payload) : layouts[0].payload) : null;
    
    const { subEventsRepo, timelineRepo } = await import('../db/repos/index.js');
    const subEvents = subEventsRepo.listForEvent(eventId).map((sub) => {
      const meta = (() => { try { return JSON.parse(sub.metadata || '{}'); } catch { return {}; } })() as Record<string, any>;
      const invited = tokenGuest ? (!sub.invite_only || !!db.prepare(`SELECT 1 FROM guest_sub_event_invitations WHERE guest_id = ? AND sub_event_id = ?`).get(tokenGuest.id, sub.id)) : !sub.invite_only;
      const rsvpRow = tokenGuest ? db.prepare(`SELECT rsvp_status FROM guest_sub_event_invitations WHERE guest_id = ? AND sub_event_id = ?`).get(tokenGuest.id, sub.id) as { rsvp_status: string } | undefined : undefined;
      return {
        ...sub,
        metadata: meta,
        eventType: meta.eventType || (sub.title.toLowerCase().includes('rehearsal') ? 'rehearsal_dinner' : sub.title.toLowerCase().includes('brunch') ? 'brunch' : sub.title.toLowerCase().includes('welcome') ? 'welcome_party' : sub.title.toLowerCase().includes('after') ? 'after_party' : 'sub_event'),
        location: meta.location || meta.venueName || meta.address || null,
        dressCode: meta.dressCode || null,
        host: meta.host || null,
        parking: meta.parking || null,
        dietaryFields: meta.dietaryFields || meta.dietary || null,
        lateArrivalInstructions: meta.lateArrivalInstructions || null,
        contactName: meta.contactName || null,
        contactEmail: meta.contactEmail || null,
        helpText: meta.helpText || null,
        itineraryStatus: invited ? 'invited' : 'not_on_your_itinerary',
        guestRsvpStatus: rsvpRow?.rsvp_status || null,
        calendarUrl: `/api/portal/${eventId}/sub-events/${sub.id}.ics${tokenGuest && q.token ? `?guest=${encodeURIComponent(tokenGuest.id)}&token=${encodeURIComponent(q.token)}` : ''}`,
      };
    });
    const rawTimeline = timelineRepo.listForEvent(eventId);
    const timeline = rawTimeline.filter(isGuestTimelineItem).map(safeGuestTimelineItem);

    const eventMetadata = (() => { try { return JSON.parse(event.metadata || '{}'); } catch { return {}; } })() as Record<string, any>;
    const eventType = String(eventMetadata.eventType || eventMetadata.guestEventType || (event.title.toLowerCase().includes('rehearsal') ? 'rehearsal_dinner' : 'wedding'));
    const locationSummary = eventMetadata.guestLocation || eventMetadata.venueAddress || eventMetadata.location || org?.name || 'Venue details pending';
    const changeNotices = Array.isArray(portalConfig.changeNotices) ? portalConfig.changeNotices : Array.isArray(eventMetadata.guestChangeNotices) ? eventMetadata.guestChangeNotices : [];
    const identityPayload = {
      mode: tokenGuest ? 'tokenized' : 'lookup_required',
      tokenStatus,
      selectedGuestId: tokenGuest?.id ?? null,
      guestDirectoryExposed: genericDirectoryEnabled,
      supportMessage: tokenStatus === 'invalid' ? 'This guest link could not be verified. Please request a new link.' : tokenStatus === 'revoked' ? 'This guest link is no longer active. Please contact the venue or couple for help.' : null,
    };
    auditPublicSubmission(req, { organizationId: event.organization_id, action: 'portal.view', targetType: 'event', targetId: eventId, details: { mode: identityPayload.mode, tokenStatus, guestId: tokenGuest?.id || requestedGuest?.id || null, guestDirectoryExposed: genericDirectoryEnabled } });
    if (tokenStatus === 'invalid' || tokenStatus === 'revoked') {
      auditPublicSubmission(req, { organizationId: event.organization_id, action: 'portal.token_failed', targetType: 'guest', targetId: requestedGuest?.id || eventId, details: { tokenStatus, eventId } });
    }

    return {
      event: {
        id: event.id, title: event.title,
        startDate: event.start_date, endDate: event.end_date,
        eventType,
        locationSummary,
        rsvpDeadline: event.rsvp_deadline || eventMetadata.rsvpDeadline || portalConfig.rsvpDeadline || null,
        lastUpdatedAt: (event as any).updated_at || event.created_at,
      },
      portalEnabled: !!cfg?.enabled,
      requiresPassword,
      guests: guestList,
      layout: safeGuestLayoutPayload(layoutPayload, tokenGuest, portalConfig),
      theme: themeConfig,
      branding: {
        platformName: typeof brandingConfig.platformName === 'string' && brandingConfig.platformName.trim()
          ? brandingConfig.platformName
          : org?.name ?? 'Wedding Venue Intelligence',
        logoUrl: typeof brandingConfig.logoUrl === 'string' ? brandingConfig.logoUrl : '',
        tagline: typeof brandingConfig.tagline === 'string' ? brandingConfig.tagline : '',
        supportEmail: typeof brandingConfig.supportEmail === 'string' ? brandingConfig.supportEmail : org?.support_email ?? '',
      },
      config: portalConfig,
      access: cfg ? {
        startsAt: (cfg as any).access_starts_at ?? null,
        endsAt: (cfg as any).access_ends_at ?? null,
        gracePeriodHours: (cfg as any).grace_period_hours ?? null,
      } : null,
      identity: identityPayload,
      guestExperience: {
        welcomeTitle: 'Welcome, guest',
        can: ['RSVP securely', 'Review schedule and invited events', 'Find travel, lodging, and venue details', 'View your seating details when shared', 'Ask for help if your invitation looks wrong'],
        cannot: ['Access couple planning tools', 'See venue staff operations', 'See contracts, payments, or private couple notes'],
      },
      guestHome: {
        eventType,
        locationSummary,
        primaryActions: ['RSVP', 'Schedule', 'Directions', 'Lodging', 'FAQ', 'Contact'],
        rsvpDeadline: event.rsvp_deadline || eventMetadata.rsvpDeadline || portalConfig.rsvpDeadline || null,
        editWindowDays: portalConfig.rsvpEditWindowDays ?? null,
        lastUpdatedAt: (event as any).updated_at || event.created_at,
        changeNotices: changeNotices.map((notice: any, index: number) => ({ id: String(notice.id || `notice-${index}`), title: String(notice.title || 'Guest information updated'), body: String(notice.body || notice.message || notice), category: String(notice.category || 'general'), updatedAt: String(notice.updatedAt || notice.date || (event as any).updated_at || event.created_at) })).slice(0, 8),
      },
      guestSchedule: {
        timezone: eventTimezone(eventMetadata),
        ceremonyArrivalTime: eventMetadata.ceremonyArrivalTime || portalConfig.ceremonyArrivalTime || null,
        ceremonyStartTime: eventMetadata.ceremonyTime || eventMetadata.ceremonyStartTime || portalConfig.ceremonyStartTime || null,
        receptionEndTime: eventMetadata.receptionEndTime || portalConfig.receptionEndTime || null,
        shuttleDepartureTime: eventMetadata.shuttleDepartureTime || portalConfig.shuttleDepartureTime || null,
        afterPartyTime: eventMetadata.afterPartyTime || portalConfig.afterPartyTime || null,
        calendarUrl: `/api/portal/${eventId}/calendar.ics${tokenGuest && q.token ? `?guest=${encodeURIComponent(tokenGuest.id)}&token=${encodeURIComponent(q.token)}` : ''}`,
        hiddenInternalCount: rawTimeline.length - timeline.length,
        changeAlerts: changeNotices.filter((notice: any) => ['schedule','timeline','ceremony','reception','shuttle','rain_plan'].includes(String(notice.category || '').toLowerCase())).slice(0, 5),
      },
      guestTravel: {
        venueAddress: portalConfig.venueAddress || eventMetadata.venueAddress || locationSummary,
        mapUrl: portalConfig.mapUrl || eventMetadata.mapUrl || '',
        parkingEntrance: portalConfig.parkingEntrance || eventMetadata.parkingEntrance || '',
        dropoffPoint: portalConfig.dropoffPoint || eventMetadata.dropoffPoint || '',
        rideshareInstructions: portalConfig.rideshareInstructions || eventMetadata.rideshareInstructions || '',
        shuttleSchedule: portalConfig.shuttleSchedule || eventMetadata.shuttleSchedule || portalConfig.transportationText || '',
        shuttlePickupLocation: portalConfig.shuttlePickupLocation || eventMetadata.shuttlePickupLocation || '',
        shuttleDropoffLocation: portalConfig.shuttleDropoffLocation || eventMetadata.shuttleDropoffLocation || '',
        lastShuttleReminder: portalConfig.lastShuttleReminder || eventMetadata.lastShuttleReminder || '',
        roomBlockDetails: portalConfig.roomBlockDetails || eventMetadata.roomBlockDetails || '',
        accessibleParking: portalConfig.accessibleParking || eventMetadata.accessibleParking || '',
        mobilityDropoff: portalConfig.mobilityDropoff || eventMetadata.mobilityDropoff || '',
        destinationTravelFaq: portalConfig.destinationTravelFaq || eventMetadata.destinationTravelFaq || '',
        weatherRainPlanNote: portalConfig.weatherRainPlanNote || eventMetadata.weatherRainPlanNote || '',
        offlineCardUrl: `/api/portal/${eventId}/travel-card.txt${tokenGuest && q.token ? `?guest=${encodeURIComponent(tokenGuest.id)}&token=${encodeURIComponent(q.token)}` : ''}`,
      },
      guestPostEvent: normalizeGuestPostEvent(portalConfig, eventMetadata, event),
      guestDayOf: normalizeGuestDayOf(portalConfig, eventMetadata, eventId, tokenGuest, q.token),
      guestReminders: normalizeGuestReminders(portalConfig, eventMetadata, event.organization_id, eventId, tokenGuest),
      guestPrivacy: normalizeGuestPrivacy(portalConfig, eventMetadata, identityPayload),
      guestCare: normalizeGuestCare(portalConfig, eventMetadata),
      guestGifts: normalizeGuestGifts(portalConfig, eventMetadata),
      guestFaq: normalizeGuestFaq(portalConfig, eventMetadata),
      guestWayfinding: {
        seatingPrivacyMode: portalConfig.seatingPrivacyMode === 'personal_only' || portalConfig.showOnlyPersonalSeat === true ? 'personal_only' : 'full_chart',
        labels: normalizeWayfindingLabels(portalConfig, eventMetadata),
        indoorMapNote: portalConfig.indoorRainPlanMapNote || eventMetadata.indoorRainPlanMapNote || '',
        outdoorMapNote: portalConfig.outdoorMapNote || eventMetadata.outdoorMapNote || '',
        accessibilityRouteDetails: portalConfig.accessibilityRouteDetails || eventMetadata.accessibilityRouteDetails || portalConfig.adaRouteLabel || '',
        arPreviewUrl: portalConfig.arPreviewUrl || eventMetadata.arPreviewUrl || '',
        arPreviewDescription: portalConfig.arPreviewDescription || eventMetadata.arPreviewDescription || '',
      },
      subEvents,
      timeline,
    };
  });

  app.post('/api/portal/:eventId/lookup', { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } }, async (req) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound();
    assertNoPublicHoneypot(req, { organizationId: event.organization_id, action: 'portal.lookup.blocked', targetType: 'event', targetId: eventId });
    const parsed = guestLookupSchema.safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    const query = parsed.data.query.trim().toLowerCase();
    const email = parsed.data.email?.trim().toLowerCase();
    const matches = guestsRepo.listForEvent(eventId)
      .filter((g) => g.allow_portal_access && (email ? g.email?.toLowerCase() === email : g.full_name.toLowerCase().includes(query)))
      .slice(0, 5)
      .map((g) => ({ id: g.id, label: g.full_name.replace(/(^\S+)\s+(.).*$/, '$1 $2.'), partyName: g.party_name || null, requiresSecureLink: true }));
    auditPublicSubmission(req, { organizationId: event.organization_id, action: 'portal.lookup', targetType: 'event', targetId: eventId, details: { resultCount: matches.length, emailProvided: !!email } });
    if (matches.length === 0) auditPublicSubmission(req, { organizationId: event.organization_id, action: 'portal.lookup_failed', targetType: 'event', targetId: eventId, details: { emailProvided: !!email, queryLength: query.length } });
    return { matches, privacy: 'For privacy, generic lookup only shows limited matches. Use your invitation link or request a secure link to RSVP.' };
  });

  app.post('/api/portal/:eventId/help-request', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (req, reply) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound();
    assertNoPublicHoneypot(req, { organizationId: event.organization_id, action: 'portal.help_request.blocked', targetType: 'event', targetId: eventId });
    const parsed = guestHelpSchema.safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    const id = uuid();
    const guest = parsed.data.guestId ? guestsRepo.findById(parsed.data.guestId) : undefined;
    const guestId = guest?.event_id === eventId ? guest.id : null;
    db.prepare(`INSERT INTO guest_help_requests (id, organization_id, event_id, guest_id, kind, name, email, message, created_ip, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(id, event.organization_id, eventId, guestId, parsed.data.kind, parsed.data.name || null, parsed.data.email || null, parsed.data.message || null, req.ip, req.headers['user-agent'] || null);
    auditRepo.log({ organizationId: event.organization_id, action: 'portal.guest_help_request', targetType: 'guest_help_request', targetId: id, ip: req.ip, userAgent: req.headers['user-agent'], details: { kind: parsed.data.kind, name: parsed.data.name, email: parsed.data.email, guestId, message: parsed.data.message } });
    return reply.code(201).send({ ok: true, requestId: id, message: 'Your request was sent. The venue or couple can help confirm your invitation details.' });
  });

  app.post('/api/portal/:eventId/reminder-preferences', { config: { rateLimit: { max: 12, timeWindow: '1 minute' } } }, async (req, reply) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound();
    assertNoPublicHoneypot(req, { organizationId: event.organization_id, action: 'portal.reminder_preferences.blocked', targetType: 'event', targetId: eventId });
    const parsed = guestReminderPreferencesSchema.safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    const guest = guestsRepo.findById(parsed.data.guestId);
    if (!guest || guest.event_id !== eventId) throw BadRequest('guest-not-in-event');
    if (verifyGuestPortalToken(guest, parsed.data.token) !== 'valid') throw new (await import('../lib/errors.js')).HttpError(403, 'portal-token-invalid');
    const meta = guestMetadata(guest);
    const reminderPreferences = {
      ...(typeof meta.reminderPreferences === 'object' && meta.reminderPreferences ? meta.reminderPreferences : {}),
      emailOptIn: parsed.data.emailOptIn === true,
      smsOptIn: parsed.data.smsOptIn === true,
      confirmationPreference: parsed.data.confirmationPreference || 'email',
      reminderTypes: parsed.data.reminderTypes || [],
      quietHoursStart: parsed.data.quietHoursStart || '21:00',
      quietHoursEnd: parsed.data.quietHoursEnd || '08:00',
      language: parsed.data.language || 'en',
      updatedAt: new Date().toISOString(),
    };
    guestsRepo.update(guest.id, { metadata: { ...meta, reminderPreferences } });
    const cfg = portalConfigRepo.getForEvent(eventId) as any;
    const portalConfig = cfg ? (typeof cfg.config === 'string' ? JSON.parse(cfg.config || '{}') : (cfg.config || {})) : {};
    let jobId: string | null = null;
    let dispatchStatus = 'preferences_saved';
    if (parsed.data.sendInfo) {
      const travel = {
        venueAddress: portalConfig.venueAddress || '',
        parkingEntrance: portalConfig.parkingEntrance || '',
        dropoffPoint: portalConfig.dropoffPoint || '',
        rideshareInstructions: portalConfig.rideshareInstructions || '',
        shuttleSchedule: portalConfig.shuttleSchedule || portalConfig.transportationText || '',
      };
      const scheduleText = `Helpful ${event.title} guest information\n\nSchedule: Check your guest portal for the latest ceremony, reception, and shuttle times.\n\nDirections: ${travel.venueAddress || 'Venue address pending'}\nParking: ${travel.parkingEntrance || 'Parking details pending'}\nDrop-off: ${travel.dropoffPoint || 'Drop-off details pending'}\nRideshare: ${travel.rideshareInstructions || 'Rideshare details pending'}\nShuttle: ${travel.shuttleSchedule || 'Shuttle details pending'}`;
      if ((reminderPreferences.confirmationPreference === 'email' || reminderPreferences.confirmationPreference === 'both') && reminderPreferences.emailOptIn && guest.email) {
        const smtpId = activeSmtpIntegrationId(event.organization_id);
        if (smtpId) { const job = jobsRepo.enqueue({ kind: 'email.send', organizationId: event.organization_id, payload: { integrationId: smtpId, to: guest.email, subject: `${event.title} guest info`, text: scheduleText, html: `<p>${escapeHtml(scheduleText).replace(/\n/g, '<br/>')}</p>` } }); jobId = job.id; dispatchStatus = 'email_job_queued'; }
        else dispatchStatus = 'email_provider_not_connected';
      } else if ((reminderPreferences.confirmationPreference === 'sms' || reminderPreferences.confirmationPreference === 'both') && reminderPreferences.smsOptIn && guest.phone) {
        const smsId = activeSmsIntegrationId(event.organization_id);
        if (smsId) { const job = jobsRepo.enqueue({ kind: 'sms.send', organizationId: event.organization_id, payload: { integrationId: smsId, to: guest.phone, body: scheduleText.slice(0, 1000) } }); jobId = job.id; dispatchStatus = 'sms_job_queued'; }
        else dispatchStatus = 'sms_provider_not_connected';
      } else dispatchStatus = 'missing_opt_in_or_contact';
    }
    auditPublicSubmission(req, { organizationId: event.organization_id, action: 'portal.reminder_preferences', targetType: 'guest', targetId: guest.id, details: { emailOptIn: reminderPreferences.emailOptIn, smsOptIn: reminderPreferences.smsOptIn, confirmationPreference: reminderPreferences.confirmationPreference, sendInfo: parsed.data.sendInfo || null, dispatchStatus, jobId } });
    return reply.send({ ok: true, preferences: reminderPreferences, message: parsed.data.sendInfo ? 'Reminder preferences saved and guest info delivery was requested.' : 'Reminder preferences saved.', dispatchStatus, jobId });
  });

  app.post('/api/portal/:eventId/privacy-request', { config: { rateLimit: { max: 6, timeWindow: '1 minute' } } }, async (req, reply) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound();
    assertNoPublicHoneypot(req, { organizationId: event.organization_id, action: 'portal.privacy_request.blocked', targetType: 'event', targetId: eventId });
    const parsed = guestPrivacyRequestSchema.safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    const cfg = portalConfigRepo.getForEvent(eventId) as any;
    const portalConfig = cfg ? (typeof cfg.config === 'string' ? JSON.parse(cfg.config || '{}') : (cfg.config || {})) : {};
    const guest = parsed.data.guestId ? guestsRepo.findById(parsed.data.guestId) : undefined;
    const tokenStatus = guest && guest.event_id === eventId ? verifyGuestPortalToken(guest, parsed.data.token) : 'missing';
    const guestId = guest?.event_id === eventId && tokenStatus === 'valid' ? guest.id : null;
    const id = uuid();
    const assignedTo = String(portalConfig.privacyContactEmail || portalConfig.guestQuestionContactEmail || '').trim() || null;
    const message = [`Guest privacy/data request`, `Type: ${parsed.data.requestType}`, `Token status: ${tokenStatus}`, '', parsed.data.message].join('\n');
    db.prepare(`INSERT INTO guest_help_requests (id, organization_id, event_id, guest_id, kind, name, email, message, assigned_to, sla_due_at, created_ip, user_agent) VALUES (?, ?, ?, ?, 'other', ?, ?, ?, ?, ?, ?, ?)`)
      .run(id, event.organization_id, eventId, guestId, parsed.data.name || guest?.full_name || null, parsed.data.email || guest?.email || null, message, assignedTo, addDaysIso(3), req.ip, req.headers['user-agent'] || null);
    auditPublicSubmission(req, { organizationId: event.organization_id, action: 'portal.privacy_request', targetType: 'guest_help_request', targetId: id, details: { requestType: parsed.data.requestType, guestId, assignedTo: !!assignedTo, tokenStatus } });
    return reply.code(201).send({ ok: true, requestId: id, message: `Your privacy/data request was sent to the ${portalConfig.privacyContactLabel || 'venue/couple privacy contact'}.` });
  });

  app.post('/api/portal/:eventId/accessibility-request', { config: { rateLimit: { max: 8, timeWindow: '1 minute' } } }, async (req, reply) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound();
    assertNoPublicHoneypot(req, { organizationId: event.organization_id, action: 'portal.accessibility_request.blocked', targetType: 'event', targetId: eventId });
    const parsed = guestAccessibilityRequestSchema.safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    const cfg = portalConfigRepo.getForEvent(eventId) as any;
    const portalConfig = cfg ? (typeof cfg.config === 'string' ? JSON.parse(cfg.config || '{}') : (cfg.config || {})) : {};
    const guest = parsed.data.guestId ? guestsRepo.findById(parsed.data.guestId) : undefined;
    const tokenStatus = guest && guest.event_id === eventId ? verifyGuestPortalToken(guest, parsed.data.token) : 'missing';
    const guestId = guest?.event_id === eventId && tokenStatus === 'valid' ? guest.id : null;
    const id = uuid();
    const assignedTo = String(portalConfig.accessibilityContactEmail || portalConfig.guestQuestionContactEmail || '').trim() || null;
    const sections = [
      ['Mobility', parsed.data.mobility],
      ['Seating', parsed.data.seating],
      ['Sensory', parsed.data.sensory],
      ['Interpretation / language', parsed.data.interpretationLanguage],
      ['Service animal', parsed.data.serviceAnimal],
      ['Dietary / allergy', parsed.data.dietaryAllergy],
      ['Caregiver', parsed.data.caregiver],
      ['Contact preference', parsed.data.contactPreference],
      ['Phone', parsed.data.phone],
      ['Additional notes', parsed.data.notes],
    ].filter(([, value]) => String(value || '').trim()).map(([label, value]) => `${label}: ${value}`).join('\n');
    const message = ['Accessibility & care request', '', sections || 'Guest requested accessibility/care follow-up.'].join('\n');
    db.prepare(`INSERT INTO guest_help_requests (id, organization_id, event_id, guest_id, kind, name, email, message, assigned_to, sla_due_at, created_ip, user_agent) VALUES (?, ?, ?, ?, 'other', ?, ?, ?, ?, ?, ?, ?)`)
      .run(id, event.organization_id, eventId, guestId, parsed.data.name || guest?.full_name || null, parsed.data.email || guest?.email || null, message, assignedTo, addDaysIso(1), req.ip, req.headers['user-agent'] || null);
    auditPublicSubmission(req, { organizationId: event.organization_id, action: 'portal.accessibility_request', targetType: 'guest_help_request', targetId: id, details: { guestId, assignedTo: !!assignedTo, contactPreference: parsed.data.contactPreference } });
    return reply.code(201).send({ ok: true, requestId: id, message: `Your accessibility and care request was sent to the ${portalConfig.accessibilityContactLabel || 'venue accessibility contact'}.` });
  });

  app.post('/api/portal/:eventId/question', { config: { rateLimit: { max: 8, timeWindow: '1 minute' } } }, async (req, reply) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound();
    assertNoPublicHoneypot(req, { organizationId: event.organization_id, action: 'portal.question.blocked', targetType: 'event', targetId: eventId });
    const parsed = guestQuestionSchema.safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    const cfg = portalConfigRepo.getForEvent(eventId) as any;
    const portalConfig = cfg ? (typeof cfg.config === 'string' ? JSON.parse(cfg.config || '{}') : (cfg.config || {})) : {};
    if (portalConfig.guestQuestionsEnabled === false) throw BadRequest('guest-questions-disabled');
    const guest = parsed.data.guestId ? guestsRepo.findById(parsed.data.guestId) : undefined;
    const tokenStatus = guest && guest.event_id === eventId ? verifyGuestPortalToken(guest, parsed.data.token) : 'missing';
    const guestId = guest?.event_id === eventId && tokenStatus === 'valid' ? guest.id : null;
    const id = uuid();
    const assignedTo = String(portalConfig.guestQuestionContactEmail || '').trim() || null;
    const message = [`Guest question`, `Category: ${parsed.data.category}`, `Language: ${parsed.data.language || 'en'}`, '', parsed.data.question].join('\n');
    db.prepare(`INSERT INTO guest_help_requests (id, organization_id, event_id, guest_id, kind, name, email, message, assigned_to, sla_due_at, created_ip, user_agent) VALUES (?, ?, ?, ?, 'other', ?, ?, ?, ?, ?, ?, ?)`)
      .run(id, event.organization_id, eventId, guestId, parsed.data.name || guest?.full_name || null, parsed.data.email || guest?.email || null, message, assignedTo, addDaysIso(2), req.ip, req.headers['user-agent'] || null);
    auditPublicSubmission(req, { organizationId: event.organization_id, action: 'portal.guest_question', targetType: 'guest_help_request', targetId: id, details: { category: parsed.data.category, language: parsed.data.language || 'en', guestId, assignedTo: !!assignedTo } });
    return reply.code(201).send({ ok: true, requestId: id, message: `Your question was sent to the ${portalConfig.guestQuestionContactLabel || 'venue/couple team'}.` });
  });

  app.post('/api/portal/:eventId/resend-link', { config: { rateLimit: { max: 5, timeWindow: '1 minute' } } }, async (req, reply) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound();
    assertNoPublicHoneypot(req, { organizationId: event.organization_id, action: 'portal.resend_link.blocked', targetType: 'event', targetId: eventId });
    const parsed = guestResendSchema.safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    const email = parsed.data.email.trim().toLowerCase();
    const guest = guestsRepo.listForEvent(eventId).find((g) => g.email?.toLowerCase() === email && (!parsed.data.name || g.full_name.toLowerCase().includes(parsed.data.name.toLowerCase().split(' ')[0])));
    let queued = false;
    if (guest && guest.allow_portal_access) {
      const token = guestsRepo.rotatePortalToken(guest.id);
      const baseUrl = (process.env.PUBLIC_APP_URL || process.env.BASE_URL || 'http://localhost:5173').replace(/\/+$/, '');
      const url = `${baseUrl}/#/portal/${eventId}?guest=${encodeURIComponent(guest.id)}&token=${encodeURIComponent(token)}`;
      const smtpId = activeSmtpIntegrationId(event.organization_id);
      if (smtpId) {
        jobsRepo.enqueue({ kind: 'email.send', organizationId: event.organization_id, payload: { integrationId: smtpId, to: email, subject: `${event.title} RSVP link`, text: `Open your secure RSVP link: ${url}`, html: `<p>Open your secure RSVP link:</p><p><a href="${escapeHtml(url)}">RSVP for ${escapeHtml(event.title)}</a></p>` } });
        queued = true;
      }
    }
    auditPublicSubmission(req, { organizationId: event.organization_id, action: 'portal.resend_link', targetType: 'event', targetId: eventId, details: { matched: !!guest, queued } });
    return reply.code(202).send({ ok: true, queued, message: 'If that email matches an invited guest, a secure RSVP link will be sent.' });
  });

  app.post('/api/portal/:eventId/memory-submission', { config: { rateLimit: { max: 8, timeWindow: '1 minute' } } }, async (req, reply) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound();
    assertNoPublicHoneypot(req, { organizationId: event.organization_id, action: 'portal.memory_submission.blocked', targetType: 'event', targetId: eventId });
    const parsed = guestMemorySubmissionSchema.safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    if (!parsed.data.consent) throw BadRequest('photo-consent-required');
    const guest = parsed.data.guestId ? guestsRepo.findById(parsed.data.guestId) : undefined;
    const tokenStatus = guest && guest.event_id === eventId ? verifyGuestPortalToken(guest, parsed.data.token) : 'missing';
    const guestId = guest?.event_id === eventId && tokenStatus === 'valid' ? guest.id : null;
    const id = uuid();
    const message = ['Guest memory/photo submission', `Photo/link: ${parsed.data.photoUrl || 'not provided'}`, `Caption: ${parsed.data.caption || ''}`, 'Moderation status: pending_review'].join('\n');
    db.prepare(`INSERT INTO guest_help_requests (id, organization_id, event_id, guest_id, kind, name, email, message, status, sla_due_at, created_ip, user_agent) VALUES (?, ?, ?, ?, 'other', ?, ?, ?, 'open', ?, ?, ?)`)
      .run(id, event.organization_id, eventId, guestId, parsed.data.name || guest?.full_name || null, parsed.data.email || guest?.email || null, message, addDaysIso(3), req.ip, req.headers['user-agent'] || null);
    auditPublicSubmission(req, { organizationId: event.organization_id, action: 'portal.memory_submission', targetType: 'guest_help_request', targetId: id, details: { guestId, hasPhotoUrl: !!parsed.data.photoUrl, tokenStatus } });
    return reply.code(201).send({ ok: true, requestId: id, moderationStatus: 'pending_review', message: 'Your memory/photo submission was received and will be reviewed before sharing.' });
  });

  app.post('/api/portal/:eventId/guest-feedback', { config: { rateLimit: { max: 8, timeWindow: '1 minute' } } }, async (req, reply) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound();
    assertNoPublicHoneypot(req, { organizationId: event.organization_id, action: 'portal.guest_feedback.blocked', targetType: 'event', targetId: eventId });
    const parsed = guestPostEventFeedbackSchema.safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    const guest = parsed.data.guestId ? guestsRepo.findById(parsed.data.guestId) : undefined;
    const tokenStatus = guest && guest.event_id === eventId ? verifyGuestPortalToken(guest, parsed.data.token) : 'missing';
    const guestId = guest?.event_id === eventId && tokenStatus === 'valid' ? guest.id : null;
    const meta = (() => { try { return JSON.parse(event.metadata || '{}'); } catch { return {}; } })() as Record<string, any>;
    const feedback = { id: uuid(), source: 'guest_portal', guestId, name: parsed.data.name || guest?.full_name || 'Guest', npsScore: parsed.data.npsScore, comment: parsed.data.comment || '', consentToContact: !!parsed.data.consentToContact, submittedAt: new Date().toISOString() };
    eventsRepo.update(eventId, { metadata: { ...meta, guestPostEventFeedback: [...(Array.isArray(meta.guestPostEventFeedback) ? meta.guestPostEventFeedback : []), feedback] } });
    auditPublicSubmission(req, { organizationId: event.organization_id, action: 'portal.guest_feedback', targetType: 'event', targetId: eventId, details: { guestId, npsScore: parsed.data.npsScore, tokenStatus } });
    return reply.code(201).send({ ok: true, feedback, message: 'Thank you for sharing guest feedback.' });
  });

  app.post('/api/portal/:eventId/day-of-help', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (req, reply) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound();
    assertNoPublicHoneypot(req, { organizationId: event.organization_id, action: 'portal.day_of_help.blocked', targetType: 'event', targetId: eventId });
    const parsed = guestDayOfHelpSchema.safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    const cfg = portalConfigRepo.getForEvent(eventId) as any;
    const portalConfig = cfg ? (typeof cfg.config === 'string' ? JSON.parse(cfg.config || '{}') : (cfg.config || {})) : {};
    const guest = parsed.data.guestId ? guestsRepo.findById(parsed.data.guestId) : undefined;
    const tokenStatus = guest && guest.event_id === eventId ? verifyGuestPortalToken(guest, parsed.data.token) : 'missing';
    const guestId = guest?.event_id === eventId && tokenStatus === 'valid' ? guest.id : null;
    const id = uuid();
    const assignedTo = String(portalConfig.dayOfContactEmail || portalConfig.accessibilityContactEmail || portalConfig.guestQuestionContactEmail || '').trim() || null;
    const label = parsed.data.kind === 'running_late' ? 'Guest running late' : 'Guest needs day-of help';
    const message = [label, `Token status: ${tokenStatus}`, parsed.data.message || 'No additional message provided.'].join('\n');
    db.prepare(`INSERT INTO guest_help_requests (id, organization_id, event_id, guest_id, kind, name, email, message, assigned_to, sla_due_at, created_ip, user_agent) VALUES (?, ?, ?, ?, 'other', ?, ?, ?, ?, ?, ?, ?)`)
      .run(id, event.organization_id, eventId, guestId, parsed.data.name || guest?.full_name || null, parsed.data.email || guest?.email || null, message, assignedTo, addDaysIso(0), req.ip, req.headers['user-agent'] || null);
    auditPublicSubmission(req, { organizationId: event.organization_id, action: 'portal.day_of_help', targetType: 'guest_help_request', targetId: id, details: { kind: parsed.data.kind, guestId, assignedTo: !!assignedTo, tokenStatus } });
    return reply.code(201).send({ ok: true, requestId: id, message: parsed.data.kind === 'running_late' ? 'Thanks for letting us know. The venue/couple team can see that you are running late.' : 'Your day-of help request was sent to the venue/couple team.' });
  });

  app.get('/api/portal/:eventId/guest-pass.txt', { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } }, async (req, reply) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound();
    const q = req.query as { guest?: string; token?: string };
    const guest = q.guest ? guestsRepo.findById(q.guest) : undefined;
    const tokenValid = guest && guest.event_id === eventId && verifyGuestPortalToken(guest, q.token) === 'valid';
    const cfg = portalConfigRepo.getForEvent(eventId) as any;
    const portalConfig = cfg ? (typeof cfg.config === 'string' ? JSON.parse(cfg.config || '{}') : (cfg.config || {})) : {};
    const org = orgsRepo.findById(event.organization_id);
    const metadata = (() => { try { return JSON.parse(event.metadata || '{}'); } catch { return {}; } })() as Record<string, any>;
    const lines = [
      `${event.title} — Offline guest event-day pass`,
      `Guest: ${tokenValid ? guest!.full_name : 'Use secure link for personalized pass'}`,
      `Date: ${event.start_date || 'TBD'}`,
      `Address: ${portalConfig.venueAddress || metadata.venueAddress || metadata.location || org?.name || 'TBD'}`,
      `Table: ${tokenValid ? (guest!.table_assignment || 'Not assigned yet') : 'Use secure link'}`,
      `Seat: ${tokenValid ? (guest!.seat_assignment || 'Not assigned yet') : 'Use secure link'}`,
      `Lodging: ${tokenValid ? (guest!.room_assignment || 'Not assigned') : 'Use secure link'}`,
      `Shuttle: ${portalConfig.shuttleSchedule || portalConfig.transportationText || 'TBD'}`,
      `Parking: ${portalConfig.parkingEntrance || 'TBD'}`,
      `Drop-off: ${portalConfig.dropoffPoint || 'TBD'}`,
      `Contact: ${portalConfig.dayOfContactLabel || portalConfig.guestQuestionContactLabel || 'venue/couple team'} ${portalConfig.dayOfContactPhone || portalConfig.dayOfContactEmail || ''}`,
      `Staff help code: WVI-GUEST-HELP:${eventId}:${tokenValid ? guest!.id : 'anonymous'}`,
    ].join('\n');
    auditPublicSubmission(req, { organizationId: event.organization_id, action: 'portal.guest_pass_export', targetType: 'event', targetId: eventId, details: { tokenized: !!tokenValid } });
    return reply.header('content-type', 'text/plain; charset=utf-8').header('content-disposition', `attachment; filename="guest-event-day-pass-${eventId}.txt"`).send(lines);
  });

  app.get('/api/portal/:eventId/travel-card.txt', { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } }, async (req, reply) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound();
    const q = req.query as { guest?: string; token?: string };
    const guest = q.guest ? guestsRepo.findById(q.guest) : undefined;
    const tokenValid = guest && guest.event_id === eventId && verifyGuestPortalToken(guest, q.token) === 'valid';
    const cfg = portalConfigRepo.getForEvent(eventId) as any;
    const portalConfig = cfg ? (typeof cfg.config === 'string' ? JSON.parse(cfg.config || '{}') : (cfg.config || {})) : {};
    const org = orgsRepo.findById(event.organization_id);
    const metadata = (() => { try { return JSON.parse(event.metadata || '{}'); } catch { return {}; } })() as Record<string, any>;
    const locationSummary = metadata.guestLocation || metadata.venueAddress || metadata.location || org?.name || 'Venue details pending';
    const travel = {
      venueAddress: portalConfig.venueAddress || metadata.venueAddress || locationSummary,
      mapUrl: portalConfig.mapUrl || metadata.mapUrl || '',
      parkingEntrance: portalConfig.parkingEntrance || metadata.parkingEntrance || '',
      dropoffPoint: portalConfig.dropoffPoint || metadata.dropoffPoint || '',
      rideshareInstructions: portalConfig.rideshareInstructions || metadata.rideshareInstructions || '',
      shuttleSchedule: portalConfig.shuttleSchedule || metadata.shuttleSchedule || portalConfig.transportationText || '',
      shuttlePickupLocation: portalConfig.shuttlePickupLocation || metadata.shuttlePickupLocation || '',
      shuttleDropoffLocation: portalConfig.shuttleDropoffLocation || metadata.shuttleDropoffLocation || '',
      lastShuttleReminder: portalConfig.lastShuttleReminder || metadata.lastShuttleReminder || '',
      roomBlockDetails: portalConfig.roomBlockDetails || metadata.roomBlockDetails || '',
      accessibleParking: portalConfig.accessibleParking || metadata.accessibleParking || '',
      mobilityDropoff: portalConfig.mobilityDropoff || metadata.mobilityDropoff || '',
      destinationTravelFaq: portalConfig.destinationTravelFaq || metadata.destinationTravelFaq || '',
      weatherRainPlanNote: portalConfig.weatherRainPlanNote || metadata.weatherRainPlanNote || '',
    };
    const lines = [
      `${event.title} — Offline guest travel card`,
      `Guest: ${tokenValid ? guest!.full_name : 'Use your secure link for personalized details'}`,
      `Date: ${event.start_date || 'TBD'}`,
      `Venue/address: ${travel.venueAddress || 'TBD'}`,
      `Map link: ${travel.mapUrl || 'TBD'}`,
      `Parking entrance: ${travel.parkingEntrance || 'TBD'}`,
      `Drop-off point: ${travel.dropoffPoint || 'TBD'}`,
      `Rideshare: ${travel.rideshareInstructions || 'TBD'}`,
      `Shuttle schedule: ${travel.shuttleSchedule || 'TBD'}`,
      `Shuttle pickup: ${travel.shuttlePickupLocation || 'TBD'}`,
      `Shuttle drop-off: ${travel.shuttleDropoffLocation || 'TBD'}`,
      `Last shuttle reminder: ${travel.lastShuttleReminder || 'TBD'}`,
      `Lodging/room block: ${tokenValid && guest?.room_assignment ? guest.room_assignment : travel.roomBlockDetails || 'TBD'}`,
      `Accessible parking: ${travel.accessibleParking || 'TBD'}`,
      `Mobility drop-off: ${travel.mobilityDropoff || 'TBD'}`,
      `Weather/rain plan: ${travel.weatherRainPlanNote || 'Check portal for latest venue updates.'}`,
      '',
      'If details look incomplete, contact the couple or venue from your invitation.',
    ].join('\n');
    auditPublicSubmission(req, { organizationId: event.organization_id, action: 'portal.travel_card_export', targetType: 'event', targetId: eventId, details: { tokenized: !!tokenValid } });
    return reply.header('content-type', 'text/plain; charset=utf-8').header('content-disposition', `attachment; filename="guest-travel-card-${eventId}.txt"`).send(lines);
  });

  app.get('/api/portal/:eventId/calendar.ics', { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } }, async (req, reply) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound();
    const q = req.query as { guest?: string; token?: string };
    const guest = q.guest ? guestsRepo.findById(q.guest) : undefined;
    const tokenValid = guest && guest.event_id === eventId && verifyGuestPortalToken(guest, q.token) === 'valid';
    const { subEventsRepo, timelineRepo } = await import('../db/repos/index.js');
    const rawTimeline = timelineRepo.listForEvent(eventId);
    const timeline = rawTimeline.filter(isGuestTimelineItem).map(safeGuestTimelineItem);
    const subEvents = subEventsRepo.listForEvent(eventId).filter((sub: any) => !sub.invite_only || (tokenValid && db.prepare(`SELECT 1 FROM guest_sub_event_invitations WHERE guest_id = ? AND sub_event_id = ?`).get(guest!.id, sub.id)));
    const metadata = (() => { try { return JSON.parse(event.metadata || '{}'); } catch { return {}; } })();
    const ics = guestCalendarIcs({ event, timeline, subEvents, metadata });
    auditPublicSubmission(req, { organizationId: event.organization_id, action: 'portal.calendar_export', targetType: 'event', targetId: eventId, details: { tokenized: !!tokenValid, timelineItems: timeline.length, subEvents: subEvents.length } });
    return reply.header('content-type', 'text/calendar; charset=utf-8').header('content-disposition', `attachment; filename="guest-schedule-${eventId}.ics"`).send(ics);
  });

  app.get('/api/portal/:eventId/sub-events/:subEventId.ics', { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } }, async (req, reply) => {
    const { eventId, subEventId } = req.params as { eventId: string; subEventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound();
    const sub = db.prepare(`SELECT * FROM sub_events WHERE id = ? AND event_id = ?`).get(subEventId, eventId) as any;
    if (!sub) throw NotFound('sub-event-not-found');
    if (sub.invite_only) {
      const q = req.query as { guest?: string; token?: string };
      const guest = q.guest ? guestsRepo.findById(q.guest) : undefined;
      if (!guest || guest.event_id !== eventId || verifyGuestPortalToken(guest, q.token) !== 'valid') return reply.code(403).send({ error: 'guest-token-required' });
      const invited = db.prepare(`SELECT 1 FROM guest_sub_event_invitations WHERE guest_id = ? AND sub_event_id = ?`).get(guest.id, subEventId);
      if (!invited) return reply.code(403).send({ error: 'not-on-your-itinerary' });
    }
    const meta = (() => { try { return JSON.parse(sub.metadata || '{}'); } catch { return {}; } })() as Record<string, any>;
    const dt = (value: string | null) => value ? new Date(value).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z') : '';
    const description = [meta.helpText, meta.parking ? `Parking: ${meta.parking}` : '', meta.dressCode ? `Dress code: ${meta.dressCode}` : '', meta.lateArrivalInstructions ? `Late arrival: ${meta.lateArrivalInstructions}` : ''].filter(Boolean).join('\\n');
    const ics = ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Wedding Venue Intelligence//Guest Portal//EN','BEGIN:VEVENT',`UID:${sub.id}@wvi`,`SUMMARY:${String(sub.title).replace(/\n/g, ' ')}`,`DTSTART:${dt(sub.starts_at)}`,sub.ends_at ? `DTEND:${dt(sub.ends_at)}` : '',meta.location ? `LOCATION:${String(meta.location).replace(/\n/g, ' ')}` : '',`DESCRIPTION:${description.replace(/\n/g, '\\n')}`,'END:VEVENT','END:VCALENDAR'].filter(Boolean).join('\r\n');
    return reply.header('content-type', 'text/calendar; charset=utf-8').header('content-disposition', `attachment; filename="${sub.id}.ics"`).send(ics);
  });

  app.get('/api/portal/:eventId/messages', { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } }, async (req, reply) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound();
    const q = req.query as { guest?: string; token?: string };
    if (!q.guest) throw BadRequest('guest-required');
    const guest = guestsRepo.findById(q.guest);
    if (!guest || guest.event_id !== eventId) throw BadRequest('guest-not-in-event');
    const tokenStatus = verifyGuestPortalToken(guest, q.token);
    if (tokenStatus !== 'valid') return reply.code(403).send({ error: tokenStatus === 'revoked' ? 'portal-access-revoked' : 'portal-token-required' });
    const helpRequests = db.prepare(`SELECT * FROM guest_help_requests WHERE event_id = ? AND guest_id = ? ORDER BY created_at DESC LIMIT 20`).all(eventId, guest.id).map(safeGuestHelpRequest);
    const replies = db.prepare(`SELECT * FROM guest_help_request_replies WHERE event_id = ? AND guest_id = ? AND visible_to_guest = 1 ORDER BY created_at DESC LIMIT 50`).all(eventId, guest.id).map(safeGuestHelpReply);
    auditPublicSubmission(req, { organizationId: event.organization_id, action: 'portal.messages.view', targetType: 'guest', targetId: guest.id, details: { eventId, replies: replies.length } });
    return { helpRequests, replies, tokenStatus, emptyState: 'Venue replies to your guest help requests will appear here.' };
  });

  app.post('/api/portal/:eventId/verify-password', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (req, reply) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    assertNoPublicHoneypot(req, { organizationId: event?.organization_id, action: 'portal.verify_password.blocked', targetType: 'event', targetId: eventId });
    const { password } = (req.body ?? {}) as { password?: string };
    const cfg = portalConfigRepo.getForEvent(eventId) as { password_hash: string | null; password_salt: string | null } | undefined;
    if (!cfg?.password_hash || !cfg.password_salt) return { ok: true }; // no password set
    if (!password) { auditPublicSubmission(req, { organizationId: event?.organization_id, action: 'portal.verify_password_failed', targetType: 'event', targetId: eventId, details: { reason: 'missing_password' } }); return reply.code(401).send({ ok: false }); }
    const ok = verifyPassword(password, {
      passwordHash: cfg.password_hash, passwordSalt: cfg.password_salt,
    });
    auditPublicSubmission(req, { organizationId: event?.organization_id, action: ok ? 'portal.verify_password' : 'portal.verify_password_failed', targetType: 'event', targetId: eventId, details: { ok } });
    return reply.code(ok ? 200 : 401).send({ ok });
  });

  app.post('/api/portal/:eventId/rsvp', { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } }, async (req, reply) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound();
    assertNoPublicHoneypot(req, { organizationId: event.organization_id, action: 'rsvp.blocked', targetType: 'event', targetId: eventId });
    const parsed = rsvpSchema.safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);

    if (parsed.data.guestId) {
      const g = guestsRepo.findById(parsed.data.guestId);
      if (!g || g.event_id !== eventId) throw BadRequest('guest-not-in-event');
      if (!g.allow_portal_access) throw new (await import('../lib/errors.js')).HttpError(403, 'portal-access-revoked');
      const prior = db.prepare(`SELECT COUNT(*) AS n FROM rsvp_submissions WHERE guest_id = ?`).get(g.id) as { n: number };
      if (g.portal_token_hash && (parsed.data.token || prior.n > 0) && verifyGuestPortalToken(g, parsed.data.token) !== 'valid') {
        auditPublicSubmission(req, { organizationId: event.organization_id, action: 'rsvp.suspicious_submit', targetType: 'guest', targetId: g.id, details: { reason: prior.n > 0 ? 'edit_token_required_or_invalid' : 'token_invalid', priorCount: prior.n } });
        throw new (await import('../lib/errors.js')).HttpError(403, prior.n > 0 ? 'portal-token-required-for-rsvp-edit' : 'portal-token-invalid');
      }
    }

    const isRsvpEdit = parsed.data.guestId ? ((db.prepare(`SELECT COUNT(*) AS n FROM rsvp_submissions WHERE guest_id = ?`).get(parsed.data.guestId) as { n: number }).n > 0) : false;
    const rsvpId = rsvpRepo.submit({
      organizationId: event.organization_id, eventId,
      guestId: parsed.data.guestId,
      attending: parsed.data.attending,
      attendingDays: parsed.data.attendingDays,
      mealChoice: parsed.data.mealChoice,
      plusOneName: parsed.data.plusOneName,
      plusOneMealChoice: parsed.data.plusOneMealChoice,
      dietaryNotes: [parsed.data.dietaryNotes, parsed.data.allergies ? `Allergies: ${parsed.data.allergies}` : '', parsed.data.allergySeverity ? `Severity: ${parsed.data.allergySeverity}` : '', parsed.data.crossContaminationWarning ? 'Cross-contamination warning requested' : '', parsed.data.severeAllergyContact ? 'Severe allergy: please contact guest' : ''].filter(Boolean).join(' | ') || undefined,
      specialNeeds: [parsed.data.specialNeeds, parsed.data.beveragePreference ? `Beverage preference: ${parsed.data.beveragePreference}` : ''].filter(Boolean).join(' | ') || undefined,
      notes: [parsed.data.notes, parsed.data.emailReminderConsent ? 'Email reminder consent: yes' : 'Email reminder consent: no', parsed.data.smsReminderConsent ? 'SMS reminder consent: yes' : 'SMS reminder consent: no'].filter(Boolean).join(' | ') || undefined,
      ip: req.ip, userAgent: req.headers['user-agent'],
    });

    if (parsed.data.guestId && (parsed.data.severeAllergyContact || parsed.data.allergySeverity === 'severe')) {
      const alertId = uuid();
      const g = guestsRepo.findById(parsed.data.guestId);
      db.prepare(`INSERT INTO guest_help_requests (id, organization_id, event_id, guest_id, kind, name, email, message, status, sla_due_at, created_ip, user_agent) VALUES (?, ?, ?, ?, 'other', ?, ?, ?, 'open', ?, ?, ?)`).run(
        alertId,
        event.organization_id,
        eventId,
        parsed.data.guestId,
        g?.full_name || null,
        g?.email || null,
        `Severe allergy follow-up requested. Allergies: ${parsed.data.allergies || 'not specified'}. Severity: ${parsed.data.allergySeverity || 'severe'}. Cross-contamination concern: ${parsed.data.crossContaminationWarning ? 'yes' : 'no'}.`,
        addDaysIso(1),
        req.ip,
        req.headers['user-agent'] || null,
      );
      auditRepo.log({ organizationId: event.organization_id, action: 'portal.severe_allergy_alert', targetType: 'guest_help_request', targetId: alertId, ip: req.ip, userAgent: req.headers['user-agent'], details: { eventId, guestId: parsed.data.guestId, allergySeverity: parsed.data.allergySeverity, crossContaminationWarning: parsed.data.crossContaminationWarning } });
    }

    if (parsed.data.subEventRSVPs && parsed.data.guestId) {
      const { db } = await import('../db/database.js');
      for (const [subId, attends] of Object.entries(parsed.data.subEventRSVPs)) {
         const status = attends === true || attends === 'attending' ? 'accepted' : attends === false || attends === 'declined' ? 'declined' : 'maybe';
         db.prepare(
            `UPDATE guest_sub_event_invitations 
             SET rsvp_status = ? 
             WHERE guest_id = ? AND sub_event_id = ?`
         ).run(status, parsed.data.guestId, subId);
      }
    }

    auditPublicSubmission(req, {
      organizationId: event.organization_id,
      action: 'rsvp.submit',
      targetType: 'rsvp',
      targetId: rsvpId,
      details: { eventId, attending: parsed.data.attending, guestId: parsed.data.guestId ?? null, edit: isRsvpEdit, tokenized: !!parsed.data.token, emailReminderConsent: parsed.data.emailReminderConsent === true, smsReminderConsent: parsed.data.smsReminderConsent === true },
    });
    if (isRsvpEdit) auditPublicSubmission(req, { organizationId: event.organization_id, action: 'rsvp.edit', targetType: 'rsvp', targetId: rsvpId, details: { eventId, guestId: parsed.data.guestId ?? null, tokenized: !!parsed.data.token } });
    // Preserve the historical audit action used by existing reports/tests while
    // also writing the explicit public.* telemetry event above.
    auditRepo.log({
      organizationId: event.organization_id, action: 'rsvp.submit',
      targetType: 'rsvp', targetId: rsvpId, ip: req.ip, userAgent: req.headers['user-agent'],
    });
    const confirmation: { emailJobId?: string; smsJobId?: string; status: string } = { status: 'not_available' };
    const guest = parsed.data.guestId ? guestsRepo.findById(parsed.data.guestId) : undefined;
    if (guest) {
      const summaryText = [`${event.title} RSVP confirmation`, `Response: ${parsed.data.attending ? 'Attending' : 'Not attending'}`, parsed.data.mealChoice ? `Meal: ${parsed.data.mealChoice}` : '', parsed.data.plusOneName ? `Plus-one: ${parsed.data.plusOneName}` : '', parsed.data.notes ? `Note: ${parsed.data.notes}` : ''].filter(Boolean).join('\n');
      if (guest.email) {
        const smtpId = activeSmtpIntegrationId(event.organization_id);
        if (smtpId) {
          const job = jobsRepo.enqueue({ kind: 'email.send', organizationId: event.organization_id, payload: { integrationId: smtpId, to: guest.email, subject: `${event.title} RSVP confirmation`, text: summaryText, html: `<p>${escapeHtml(summaryText).replace(/\n/g, '<br/>')}</p>` } });
          confirmation.emailJobId = job.id;
          confirmation.status = 'queued';
        }
      }
      if (guest.phone) {
        const smsId = activeSmsIntegrationId(event.organization_id);
        if (smsId) {
          const job = jobsRepo.enqueue({ kind: 'sms.send', organizationId: event.organization_id, payload: { integrationId: smsId, to: guest.phone, body: summaryText.slice(0, 1000) } });
          confirmation.smsJobId = job.id;
          confirmation.status = 'queued';
        }
      }
    }
    broadcastSSE(event.organization_id, "rsvp.submitted", { rsvpId, eventId, attending: parsed.data.attending });
    return reply.code(201).send({ ok: true, rsvpId, confirmation });
  });
}
