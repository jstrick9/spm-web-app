/**
 * portalTypes.ts — Typed shapes for the public guest portal.
 *
 * Phase 34b: initial version (PortalTheme, PortalGuestEntry,
 *   LayoutCanvasItem discriminated union, PortalLayoutPayload,
 *   PortalInfoResponse, PortalRsvpInput).
 *
 * Phase 35a additions:
 *   PollOption — the individual choice shape inside a Poll.
 *   Re-exported from here so PublicGuestPortal.tsx imports from one place.
 *
 * All shapes derived directly from:
 *   server/src/routes/guests.ts     GET /api/portal/:eventId/info
 *   server/src/routes/feedback.ts   GET /api/events/:eventId/polls
 *   client/src/sdk/feedback.ts      Poll interface
 */

// ── Portal theme ──────────────────────────────────────────────────────────

export interface PortalTheme {
  bgColor?: string;
  surfaceColor?: string;
  borderColor?: string;
  fgColor?: string;
  fgMutedColor?: string;
  fgSubtleColor?: string;
  brandColor?: string;
  brandFgColor?: string;
  brandHoverColor?: string;
  accentColor?: string;
  accentSoftColor?: string;
}

// ── Portal guest entry ────────────────────────────────────────────────────

export interface PortalGuestEntry {
  id: string;
  fullName: string;
  tableAssignment: string | null;
  seatAssignment: string | null;
  roomAssignment: string | null;
  allowLodgingAccess?: boolean;
  subEventInvites?: string[];
  subEventStatuses?: Record<string, string>;
  rsvpStatus?: 'pending' | 'attending' | 'declined' | 'maybe' | null;
  partyName?: string | null;
  householdId?: string | null;
  householdName?: string | null;
  householdAuthorized?: boolean;
  inviteStatus?: string;
  plusOneAllowed?: boolean;
}

// ── Canvas layout items (discriminated union) ─────────────────────────────

interface CanvasItemBase {
  id: string;
  x: number;
  y: number;
  label: string;
}

export interface RoundTableItem extends CanvasItemBase {
  type: 'round_table';
  radius: number;
}

export interface RectTableItem extends CanvasItemBase {
  type: 'rect_table';
  width: number;
  height: number;
  rotation: number;
}

export interface DanceFloorItem extends CanvasItemBase {
  type: 'dance_floor';
  width: number;
  height: number;
  rotation: number;
}

export interface ChairItem extends CanvasItemBase {
  type: 'chair';
  radius: number;
  guestId: string | null;
  guestInitials: string | null;
}

export interface UnknownCanvasItem extends CanvasItemBase {
  type: string;
  [key: string]: unknown;
}

export type LayoutCanvasItem =
  | RoundTableItem
  | RectTableItem
  | DanceFloorItem
  | ChairItem
  | UnknownCanvasItem;

export interface PortalLayoutPayload {
  items: LayoutCanvasItem[];
  [key: string]: unknown;
}

// ── Full portal info response ─────────────────────────────────────────────

export interface PortalInfoResponse {
  /** Guest's saved portal display language ('en' | 'es' | 'fr' | 'zh'). */
  language?: string;
  /** True when the portal is password-protected and this payload is the
   *  locked shell (event title only) — the client must show the unlock gate. */
  passwordLocked?: boolean;
  event: {
    id: string;
    title: string;
    startDate: string | null;
    endDate: string | null;
    eventType?: string;
    locationSummary?: string;
    rsvpDeadline?: string | null;
    lastUpdatedAt?: string | null;
  };
  portalEnabled: boolean;
  requiresPassword: boolean;
  guests: PortalGuestEntry[];
  layout: PortalLayoutPayload | null;
  theme: PortalTheme | null;
  branding?: {
    platformName?: string;
    logoUrl?: string;
    tagline?: string;
    supportEmail?: string;
  };
  config?: Record<string, any>;
  access?: { startsAt: string | null; endsAt: string | null; gracePeriodHours: number | null } | null;
  identity?: { mode: 'tokenized' | 'lookup_required'; tokenStatus: 'valid' | 'invalid' | 'revoked' | 'missing'; selectedGuestId: string | null; guestDirectoryExposed: boolean; supportMessage: string | null };
  guestExperience?: { welcomeTitle: string; can: string[]; cannot: string[] };
  guestHome?: { eventType: string; locationSummary: string; primaryActions: string[]; rsvpDeadline: string | null; editWindowDays: number | null; lastUpdatedAt: string | null; changeNotices: Array<{ id: string; title: string; body: string; category: string; updatedAt: string }> };
  guestSchedule?: { timezone: string; ceremonyArrivalTime: string | null; ceremonyStartTime: string | null; receptionEndTime: string | null; shuttleDepartureTime: string | null; afterPartyTime: string | null; calendarUrl: string; hiddenInternalCount: number; changeAlerts: Array<Record<string, any>> };
  guestTravel?: { venueAddress: string; mapUrl: string; parkingEntrance: string; dropoffPoint: string; rideshareInstructions: string; shuttleSchedule: string; shuttlePickupLocation: string; shuttleDropoffLocation: string; lastShuttleReminder: string; roomBlockDetails: string; accessibleParking: string; mobilityDropoff: string; destinationTravelFaq: string; weatherRainPlanNote: string; offlineCardUrl: string };
  guestPostEvent?: {
    enabled: boolean;
    afterEvent: boolean;
    thankYouTitle: string;
    thankYouMessage: string;
    links: Array<{ id: string; label: string; url: string; description: string }>;
    galleryDocuments?: Array<{ id: string; filename: string; mimeType: string | null; url: string; notes: string | null }>;
    uploadEnabled: boolean;
    moderationCopy: string;
    consentCopy: string;
    feedbackEnabled: boolean;
    npsQuestion: string;
  };
  guestDayOf?: {
    enabled: boolean;
    title: string;
    contactLabel: string;
    contactPhone: string;
    contactEmail: string;
    offlinePassUrl: string;
    staffHelpUrl: string;
    qrPayload: string;
    pushAvailable: boolean;
    pushCopy: string;
  };
  guestReminders?: {
    providers: { emailConnected: boolean; smsConnected: boolean };
    defaults: { rsvpReminderEnabled: boolean; scheduleReminderEnabled: boolean; rainPlanReminderEnabled: boolean; shuttleReminderEnabled: boolean; dayBeforeReminderEnabled: boolean; dayOfReminderEnabled: boolean; guestFriendlyCopy: string };
    preferences: { emailOptIn: boolean; smsOptIn: boolean; confirmationPreference: 'email' | 'sms' | 'both' | 'none'; reminderTypes: string[]; quietHoursStart: string; quietHoursEnd: string; language: string };
    actions: { scheduleAvailable: boolean; directionsAvailable: boolean; preferencesUrl: string };
  };
  guestPrivacy?: {
    summary: string;
    visibility: { rsvp: string; meal: string; allergy: string; accessibility: string; lodging: string; notes: string };
    consent: { emailReminderLabel: string; smsReminderLabel: string };
    retention: string;
    correctionDeletion: { enabled: boolean; contactLabel: string; contactEmail: string };
    antiAbuse: string;
    access: { mode: string; tokenStatus: string; guestDirectoryExposed: boolean; privateWeddingDefault: boolean };
  };
  guestCare?: {
    contact: { label: string; email: string; phone: string; helpText: string };
    details: { accessibleParking: string; accessibleEntrance: string; accessibleRestroom: string; accessibleSeating: string; accessibleRoute: string; mobilityDropoff: string };
    requestTypes: string[];
    portalPreferences: { largeText: boolean; highContrast: boolean; languageSelector: boolean };
  };
  guestGifts?: {
    links: Array<{ id: string; type: 'registry' | 'honeymoon' | 'charity' | 'cash' | 'website' | 'other'; label: string; url: string; description: string }>;
    cardsGiftTableLocation: string;
    note: string;
    externalLinkWarning: string;
  };
  guestFaq?: {
    dressCode: { summary: string; examples: string; weather: string; rainPlan: string };
    policies: { kidsPolicy: string; plusOneRules: string; phonePhotoPolicy: string; smokingVapingPolicy: string; barAlcoholPolicy: string };
    categories: string[];
    items: Array<{ id: string; category: string; question: string; answer: string; translations?: Record<string, { question?: string; answer?: string }> }>;
    multilingual: { availableLanguages: Array<{ code: string; label: string }> };
    askQuestion: { enabled: boolean; contactLabel: string };
  };
  guestWayfinding?: {
    seatingPrivacyMode: 'personal_only' | 'full_chart';
    labels: Array<{ id: string; type: string; label: string; details: string }>;
    indoorMapNote: string;
    outdoorMapNote: string;
    accessibilityRouteDetails: string;
    arPreviewUrl: string;
    arPreviewDescription: string;
  };
}

// ── RSVP submission input ─────────────────────────────────────────────────

export interface PortalRsvpInput {
  guestId: string;
  attending: boolean;
  /** Tri-state override: 'maybe' records an unsure guest as maybe (not declined). */
  status?: 'attending' | 'declined' | 'maybe';
  attendingDays?: string[];
  mealChoice?: string;
  plusOneName?: string;
  plusOneMealChoice?: string;
  dietaryNotes?: string;
  allergies?: string;
  allergySeverity?: 'none' | 'mild' | 'moderate' | 'severe';
  crossContaminationWarning?: boolean;
  beveragePreference?: string;
  severeAllergyContact?: boolean;
  specialNeeds?: string;
  notes?: string;
  subEventRSVPs?: Record<string, boolean | 'attending' | 'declined' | 'unsure'>;
  token?: string;
  emailReminderConsent?: boolean;
  smsReminderConsent?: boolean;
}

// ── Poll option (Phase 35a) ───────────────────────────────────────────────
/**
 * Individual choice inside a Poll.
 * Mirrors the shape from server feedback routes and sdk/feedback.ts Poll.options[].
 * Extracted here so PublicGuestPortal.tsx can type poll.options.map()
 * without importing from a separate SDK module.
 */
export interface PollOption {
  id: string;
  text: string;
  votes: number;
}
