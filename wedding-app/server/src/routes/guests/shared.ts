import type { FastifyInstance } from 'fastify';
import { broadcastSSE } from '../sse.js';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth.js';
import { can } from '../../lib/rbac.js';
import { auditRepo, eventsRepo, guestsRepo, jobsRepo, rsvpRepo, portalConfigRepo, layoutsRepo, orgsRepo, guestIdentityRepo } from '../../db/repos/index.js';
import { BadRequest, Forbidden, NotFound } from '../../lib/errors.js';
import { hashPassword, verifyPassword, uuid } from '../../lib/crypto.js';
import { verifyCapabilitySecret } from '../../lib/capability.js';
import { assertNoPublicHoneypot, auditPublicSubmission } from '../../lib/publicAbuse.js';
import { db } from '../../db/database.js';

export const guestSchema = z.object({
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

export const rsvpSchema = z.object({
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

export const portalConfigSchema = z.object({
  enabled:            z.boolean(),
  password:           z.string().min(4).max(200).optional(),
  clearPassword:      z.boolean().optional(),
  accessStartsAt:     z.string().optional(),
  accessEndsAt:       z.string().optional(),
  gracePeriodHours:   z.number().int().min(0).max(720).optional(),
  config:             z.record(z.unknown()).optional(),
});


export const guestLookupSchema = z.object({
  query: z.string().min(2).max(120),
  email: z.string().email().optional().or(z.literal('')),
});

export const guestHelpSchema = z.object({
  kind: z.enum(['cannot_find_name','wrong_guest','expired_or_revoked','other']).default('cannot_find_name'),
  name: z.string().max(160).optional(),
  email: z.string().email().optional().or(z.literal('')),
  message: z.string().max(2000).optional(),
  guestId: z.string().optional(),
});

export const guestQuestionSchema = z.object({
  guestId: z.string().optional(),
  token: z.string().optional(),
  name: z.string().max(160).optional(),
  email: z.string().email().optional().or(z.literal('')),
  category: z.string().min(1).max(80).default('General'),
  language: z.string().max(12).optional(),
  question: z.string().min(3).max(2000),
});

export const guestAccessibilityRequestSchema = z.object({
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

export const guestPrivacyRequestSchema = z.object({
  guestId: z.string().optional(),
  token: z.string().optional(),
  name: z.string().max(160).optional(),
  email: z.string().email().optional().or(z.literal('')),
  requestType: z.enum(['update_contact','delete_contact','data_question','consent_change']).default('data_question'),
  message: z.string().min(3).max(2000),
});

export const guestReminderPreferencesSchema = z.object({
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

export const guestDayOfHelpSchema = z.object({
  guestId: z.string().optional(),
  token: z.string().optional(),
  kind: z.enum(['running_late','need_help']).default('need_help'),
  name: z.string().max(160).optional(),
  email: z.string().email().optional().or(z.literal('')),
  message: z.string().max(1000).optional(),
});

export const guestMemorySubmissionSchema = z.object({
  guestId: z.string().optional(),
  token: z.string().optional(),
  name: z.string().max(160).optional(),
  email: z.string().email().optional().or(z.literal('')),
  photoUrl: z.string().url().optional().or(z.literal('')),
  caption: z.string().max(1000).optional(),
  consent: z.boolean(),
});

export const guestPostEventFeedbackSchema = z.object({
  guestId: z.string().optional(),
  token: z.string().optional(),
  name: z.string().max(160).optional(),
  npsScore: z.number().int().min(0).max(10),
  comment: z.string().max(2000).optional(),
  consentToContact: z.boolean().optional(),
});

export const guestResendSchema = z.object({
  email: z.string().email(),
  name: z.string().max(160).optional(),
});


export const guestHelpUpdateSchema = z.object({
  status: z.enum(['open','in_review','resolved','closed']).optional(),
  assignedTo: z.string().email().optional().or(z.literal('')),
  resolutionNote: z.string().max(2000).optional(),
  slaDueAt: z.string().optional().or(z.literal('')),
  slaDays: z.number().int().min(1).max(30).optional(),
});

export const guestHelpReplySchema = z.object({
  channel: z.enum(['email','sms','in_app']).default('email'),
  message: z.string().min(1).max(2000),
  closeRequest: z.boolean().optional(),
});
export function guestMetadata(g: NonNullable<ReturnType<typeof guestsRepo.findById>>) {
  try { return JSON.parse(g.metadata || '{}') as Record<string, any>; } catch { return {}; }
}

export function guestHouseholdKey(g: NonNullable<ReturnType<typeof guestsRepo.findById>>) {
  const meta = guestMetadata(g);
  return String(meta.householdId || meta.householdName || g.party_name || '').trim().toLowerCase();
}

export function publicGuest(g: NonNullable<ReturnType<typeof guestsRepo.findById>>, includePersonal = true, householdAuthorized = false) {
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









export function normalizeGuestPostEvent(portalConfig: Record<string, any>, metadata: Record<string, any>, event: any) {
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

export function normalizeGuestDayOf(portalConfig: Record<string, any>, metadata: Record<string, any>, eventId: string, tokenGuest: NonNullable<ReturnType<typeof guestsRepo.findById>> | null, token?: string) {
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

export function normalizeGuestReminders(portalConfig: Record<string, any>, metadata: Record<string, any>, organizationId: string, eventId: string, tokenGuest: NonNullable<ReturnType<typeof guestsRepo.findById>> | null) {
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

export function normalizeGuestPrivacy(portalConfig: Record<string, any>, metadata: Record<string, any>, identity: { mode: string; tokenStatus: string; guestDirectoryExposed: boolean }) {
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

export function normalizeGuestCare(portalConfig: Record<string, any>, metadata: Record<string, any>) {
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

export function normalizeGuestGifts(portalConfig: Record<string, any>, metadata: Record<string, any>) {
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

export function normalizeGuestFaq(portalConfig: Record<string, any>, metadata: Record<string, any>) {
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

export function normalizeWayfindingLabels(portalConfig: Record<string, any>, metadata: Record<string, any>) {
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

export function safeGuestLayoutPayload(layoutPayload: any, tokenGuest: NonNullable<ReturnType<typeof guestsRepo.findById>> | null, portalConfig: Record<string, any>) {
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

export function verifyGuestPortalToken(g: NonNullable<ReturnType<typeof guestsRepo.findById>>, token?: string | null) {
  if (!g.allow_portal_access) return 'revoked' as const;
  if (!token) return 'missing' as const;
  if (!g.portal_token_hash || !g.portal_token_salt) return 'missing' as const;
  if (g.portal_token_expires_at && g.portal_token_expires_at <= new Date().toISOString()) return 'expired' as const;
  if (!verifyCapabilitySecret(token, { token_hash: g.portal_token_hash, token_salt: g.portal_token_salt })) return 'invalid' as const;
  db.prepare(`UPDATE guests SET portal_token_last_used_at = datetime('now') WHERE id = ?`).run(g.id);
  return 'valid' as const;
}

export function activeSmtpIntegrationId(organizationId: string) {
  const row = db.prepare(`SELECT id FROM integrations WHERE organization_id = ? AND provider = 'email_smtp' AND status = 'connected' LIMIT 1`).get(organizationId) as { id: string } | undefined;
  return row?.id ?? null;
}

export function activeSmsIntegrationId(organizationId: string) {
  const row = db.prepare(`SELECT id FROM integrations WHERE organization_id = ? AND provider = 'sms_twilio' AND status = 'connected' LIMIT 1`).get(organizationId) as { id: string } | undefined;
  return row?.id ?? null;
}

export function addDaysIso(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

import { icsText } from '../../lib/ics.js';

export function escapeHtml(value: string) {
  return value.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch] || ch));
}

export function isGuestTimelineItem(item: any) {
  const text = `${item.title || ''} ${item.category || ''} ${item.notes || ''}`.toLowerCase();
  const hidden = ['vendor', 'load-in', 'load in', 'load-out', 'load out', 'setup', 'strike', 'staff', 'internal', 'incident', 'prep', 'kitchen', 'security'];
  return !hidden.some((term) => text.includes(term));
}

export function safeGuestTimelineItem(item: any) {
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

export function eventTimezone(metadata: Record<string, any>) {
  return String(metadata.timezone || metadata.eventTimezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'local');
}

export function icsDate(value: string | null | undefined) {
  if (!value) return '';
  return new Date(value).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

export function guestCalendarIcs(input: { event: any; timeline: any[]; subEvents: any[]; metadata: Record<string, any> }) {
  const escape = (value: string) => icsText(value);
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


export function safeGuestHelpRequest(row: any) {
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

export function safeGuestHelpReply(row: any) {
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

/**
 * Couple-owned guest mutations require the couple-only `guests.couple.manage`
 * permission (granted to the couple system role). Venue staff — including
 * managers/planners with the venue-side `guests.manage` permission used for
 * help-desk operations — cannot mutate the couple's guest list.
 */
export function requireCoupleGuestManager(memberships: any[], eventId: string, orgMap: Record<string, string> = {}) {
  if (!can(memberships, { eventId }, 'guests.couple.manage', orgMap)) throw Forbidden();
}

