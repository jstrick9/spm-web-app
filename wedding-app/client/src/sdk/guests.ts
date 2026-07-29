/**
 * guests.ts — Guest + portal SDK module.
 *
 * Phase 34b changes:
 *   - portalSdk.info() now returns Promise<PortalInfoResponse> instead of
 *     Promise<SdkPortalInfo>. PortalInfoResponse is a superset that adds
 *     the `theme` field the server has always returned but SdkPortalInfo
 *     never declared — forcing PublicGuestPortal to use `.then((r: any)`.
 *   - All other methods, types, and exports are identical to the live file.
 *   - SdkPortalInfo in types.ts is deliberately NOT removed — other
 *     consumers (EventDetail, GuestPortalSettingsTab) still use it.
 */
import { api } from './client.js';
import type {
  SdkGuest,
  SdkGuestCounts,
  SdkRsvp,
  SdkPortalConfig,
} from './types.js';
import type { PortalInfoResponse, PortalRsvpInput } from './portalTypes.js';

// ── Guest input ───────────────────────────────────────────────────────────

export interface GuestInput {
  fullName: string;
  email?: string;
  phone?: string;
  partyName?: string;
  rsvpStatus?: SdkGuest['rsvp_status'];
  dietaryRestrictions?: string;
  accessibilityNotes?: string;
  tableAssignment?: string;
  roomAssignment?: string;
  seatAssignment?: string;
  plusOneAllowed?: boolean;
  allowPortalAccess?: boolean;
  allowLodgingAccess?: boolean;
  metadata?: Record<string, unknown>;
}

// ── Guest identity / dedup types ──────────────────────────────────────────

export type GuestMatchSignal = 'email' | 'phone' | 'name';

export interface GuestDuplicateMember {
  id: string;
  eventId: string;
  eventTitle: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  rsvpStatus: string;
  createdAt: string;
}

export interface GuestDuplicateCluster {
  key: string;
  signals: GuestMatchSignal[];
  confidence: 'high' | 'medium';
  members: GuestDuplicateMember[];
  hasInEventDuplicate: boolean;
}

// ── RSVP input ────────────────────────────────────────────────────────────

export interface RsvpInput {
  guestId?: string;
  attending: boolean;
  attendingDays?: string[];
  mealChoice?: string;
  plusOneName?: string;
  plusOneMealChoice?: string;
  dietaryNotes?: string;
  specialNeeds?: string;
  notes?: string;
}

// ── Guests SDK ────────────────────────────────────────────────────────────

export const guestsSdk = {
  list(eventId: string): Promise<{ guests: SdkGuest[]; counts: SdkGuestCounts }> {
    return api.get(`/api/events/${eventId}/guests`);
  },

  venueManifest(eventId: string): Promise<{ guests: Array<{ id: string; fullName: string; relationship: string | null; bridalParty: boolean; tableAssignment: string | null; seatAssignment: string | null }>; counts: SdkGuestCounts }> { return api.get(`/api/events/${eventId}/venue-guest-manifest`); },

  guestHelpRequests(eventId: string): Promise<{ requests: Array<{ id: string; kind: string; name: string | null; email: string | null; message: string | null; status: string; assignedTo: string | null; resolutionNote: string | null; slaDueAt?: string | null; slaStatus?: string; lastReplyAt?: string | null; lastReplyChannel?: string | null; lastReplyJobId?: string | null; lastReplyStatus?: string | null; createdAt: string; updatedAt: string }>; counts: Record<string, number> }> {
    return api.get(`/api/events/${eventId}/guest-help-requests`);
  },

  guestPortalSecurity(eventId: string): Promise<{ summary: { totalAudits: number; suspiciousCount: number; uniqueDeviceSessions: number; genericGuestDirectoryExposed: boolean; tokenizedLinksPreferred: boolean; rateLimitsAndHoneypotsActive: boolean }; counts: Record<string, number>; topDeviceSessions: Array<{ deviceSession: string; count: number }>; suspicious: Array<Record<string, any>>; audits: Array<Record<string, any>> }> {
    return api.get(`/api/events/${eventId}/guest-portal-security`);
  },

  updateGuestHelpRequest(eventId: string, requestId: string, input: { status?: 'open' | 'in_review' | 'resolved' | 'closed'; assignedTo?: string; resolutionNote?: string; slaDueAt?: string; slaDays?: number }): Promise<{ request: any }> {
    return api.patch(`/api/events/${eventId}/guest-help-requests/${requestId}`, input);
  },

  replyGuestHelpRequest(eventId: string, requestId: string, input: { channel?: 'email' | 'sms' | 'in_app'; message: string; closeRequest?: boolean }): Promise<{ request: any; jobId: string | null; dispatchStatus: string }> {
    return api.post(`/api/events/${eventId}/guest-help-requests/${requestId}/reply`, input);
  },

  listForOrg(
    orgId: string,
    filters: {
      search?: string;
      rsvpStatus?: string[];
      eventId?: string;
      limit?: number;
      offset?: number;
    } = {},
  ): Promise<{ guests: (SdkGuest & { event_title: string })[]; total: number; counts: SdkGuestCounts }> {
    const q = new URLSearchParams();
    if (filters.search) q.set('search', filters.search);
    if (filters.rsvpStatus?.length) q.set('rsvpStatus', filters.rsvpStatus.join(','));
    if (filters.eventId) q.set('eventId', filters.eventId);
    if (filters.limit !== undefined) q.set('limit', String(filters.limit));
    if (filters.offset !== undefined) q.set('offset', String(filters.offset));
    const qs = q.toString();
    return api.get(`/api/orgs/${orgId}/guests${qs ? `?${qs}` : ''}`);
  },

  // ── Guest identity resolution ──────────────────────────────────────────

  duplicates(orgId: string): Promise<{ clusters: GuestDuplicateCluster[] }> {
    return api.get(`/api/orgs/${orgId}/guest-duplicates`);
  },

  merge(
    orgId: string,
    primaryId: string,
    duplicateIds: string[],
  ): Promise<{ primary: SdkGuest; mergedCount: number }> {
    return api.post(`/api/orgs/${orgId}/guests/merge`, { primaryId, duplicateIds });
  },

  // ── CRUD ──────────────────────────────────────────────────────────────

  create(eventId: string, input: GuestInput): Promise<{ guest: SdkGuest }> {
    return api.post(`/api/events/${eventId}/guests`, input);
  },

  bulkCreate(
    eventId: string,
    mode: 'skip' | 'replace' | 'append',
    guests: GuestInput[],
  ): Promise<{ inserted: number; updated: number; skipped: number }> {
    return api.post(`/api/events/${eventId}/guests/bulk`, { mode, guests });
  },

  update(guestId: string, patch: Partial<GuestInput>): Promise<{ guest: SdkGuest }> {
    return api.patch(`/api/guests/${guestId}`, patch);
  },

  delete(guestId: string): Promise<void> {
    return api.delete(`/api/guests/${guestId}`);
  },

  // ── Portal token management (authenticated) ───────────────────────────

  rotatePortalToken(guestId: string): Promise<{ token: string }> {
    return api.post(`/api/guests/${guestId}/portal-token`);
  },

  revokePortalToken(guestId: string): Promise<void> {
    return api.delete(`/api/guests/${guestId}/portal-token`);
  },

  // ── Portal config (authenticated) ────────────────────────────────────

  getPortalConfig(eventId: string): Promise<{ config: SdkPortalConfig | undefined }> {
    return api.get(`/api/events/${eventId}/portal-config`);
  },

  updatePortalConfig(
    eventId: string,
    payload: {
      enabled: boolean;
      password?: string;
      clearPassword?: boolean;
      accessStartsAt?: string;
      accessEndsAt?: string;
      gracePeriodHours?: number;
      config?: Record<string, unknown>;
    },
  ): Promise<{ config: SdkPortalConfig }> {
    return api.put(`/api/events/${eventId}/portal-config`, payload);
  },
};

// ── RSVPs SDK (authenticated) ─────────────────────────────────────────────

export const rsvpSdk = {
  list(eventId: string): Promise<{ rsvps: SdkRsvp[] }> {
    return api.get(`/api/events/${eventId}/rsvps`);
  },
};

// ── Public portal SDK (no auth required) ─────────────────────────────────

export const portalSdk = {
  /**
   * Fetch all public information for a portal event.
   *
   * Phase 34b: return type changed from Promise<SdkPortalInfo> to
   * Promise<PortalInfoResponse>. PortalInfoResponse is a superset that
   * adds the `theme` field the server has always returned.
   *
   * The old `SdkPortalInfo` type is preserved in types.ts for other
   * consumers; this method is the only one that needs the richer type.
   */
  info(eventId: string, params?: { guest?: string; token?: string }): Promise<PortalInfoResponse> {
    const qs = params?.guest ? `?guest=${encodeURIComponent(params.guest)}${params.token ? `&token=${encodeURIComponent(params.token)}` : ''}` : '';
    return api.get(`/api/portal/${eventId}/info${qs}`, { auth: false });
  },

  lookup(eventId: string, input: { query: string; email?: string }): Promise<{ matches: Array<{ id: string; label: string; partyName: string | null; requiresSecureLink: boolean }>; privacy: string }> {
    return api.post(`/api/portal/${eventId}/lookup`, input, { auth: false });
  },

  status(eventId: string): Promise<{ event: { id: string; title: string; startDate: string | null }; status: 'available' | 'disabled'; support: { label: string; email: string; phone: string }; message: string; recovery: { requestNewLink: boolean; helpKinds: string[] } }> {
    return api.get(`/api/portal/${eventId}/status`, { auth: false });
  },

  requestHelp(eventId: string, input: { kind?: 'cannot_find_name' | 'wrong_guest' | 'expired_or_revoked' | 'other'; name?: string; email?: string; message?: string; guestId?: string }): Promise<{ ok: boolean; requestId: string; message: string }> {
    return api.post(`/api/portal/${eventId}/help-request`, input, { auth: false });
  },

  askQuestion(eventId: string, input: { guestId?: string; token?: string; name?: string; email?: string; category: string; language?: string; question: string }): Promise<{ ok: boolean; requestId: string; message: string }> {
    return api.post(`/api/portal/${eventId}/question`, input, { auth: false });
  },

  requestAccessibility(eventId: string, input: { guestId?: string; token?: string; name?: string; email?: string; phone?: string; mobility?: string; seating?: string; sensory?: string; interpretationLanguage?: string; serviceAnimal?: string; dietaryAllergy?: string; caregiver?: string; contactPreference?: 'email' | 'phone' | 'text' | 'in_app'; notes?: string }): Promise<{ ok: boolean; requestId: string; message: string }> {
    return api.post(`/api/portal/${eventId}/accessibility-request`, input, { auth: false });
  },

  requestPrivacy(eventId: string, input: { guestId?: string; token?: string; name?: string; email?: string; requestType: 'update_contact' | 'delete_contact' | 'data_question' | 'consent_change'; message: string }): Promise<{ ok: boolean; requestId: string; message: string }> {
    return api.post(`/api/portal/${eventId}/privacy-request`, input, { auth: false });
  },

  saveReminderPreferences(eventId: string, input: { guestId: string; token?: string; emailOptIn?: boolean; smsOptIn?: boolean; confirmationPreference?: 'email' | 'sms' | 'both' | 'none'; reminderTypes?: Array<'rsvp' | 'schedule' | 'rain_plan' | 'shuttle' | 'directions' | 'day_before' | 'day_of'>; quietHoursStart?: string; quietHoursEnd?: string; language?: string; sendInfo?: 'schedule' | 'directions' }): Promise<{ ok: boolean; preferences: Record<string, any>; message: string; dispatchStatus: string; jobId?: string | null }> {
    return api.post(`/api/portal/${eventId}/reminder-preferences`, input, { auth: false });
  },

  dayOfHelp(eventId: string, input: { guestId?: string; token?: string; kind: 'running_late' | 'need_help'; name?: string; email?: string; message?: string }): Promise<{ ok: boolean; requestId: string; message: string }> {
    return api.post(`/api/portal/${eventId}/day-of-help`, input, { auth: false });
  },

  submitMemory(eventId: string, input: { guestId?: string; token?: string; name?: string; email?: string; photoUrl?: string; caption?: string; consent: boolean }): Promise<{ ok: boolean; requestId: string; moderationStatus: string; message: string }> {
    return api.post(`/api/portal/${eventId}/memory-submission`, input, { auth: false });
  },

  submitGuestFeedback(eventId: string, input: { guestId?: string; token?: string; name?: string; npsScore: number; comment?: string; consentToContact?: boolean }): Promise<{ ok: boolean; feedback: Record<string, any>; message: string }> {
    return api.post(`/api/portal/${eventId}/guest-feedback`, input, { auth: false });
  },

  resendLink(eventId: string, input: { email: string; name?: string }): Promise<{ ok: boolean; queued: boolean; message: string }> {
    return api.post(`/api/portal/${eventId}/resend-link`, input, { auth: false });
  },

  messages(eventId: string, params: { guest: string; token: string }): Promise<{ helpRequests: Array<Record<string, any>>; replies: Array<{ id: string; requestId: string; channel: 'email' | 'sms' | 'in_app'; body: string; dispatchStatus: string | null; sentByLabel: string; createdAt: string }>; tokenStatus: string; emptyState: string }> {
    return api.get(`/api/portal/${eventId}/messages?guest=${encodeURIComponent(params.guest)}&token=${encodeURIComponent(params.token)}`, { auth: false });
  },

  verifyPassword(eventId: string, password: string): Promise<{ ok: boolean }> {
    return api.post(`/api/portal/${eventId}/verify-password`, { password }, { auth: false });
  },

  /**
   * Submit an RSVP from the public portal.
   * Uses PortalRsvpInput (typed) instead of the generic RsvpInput.
   */
  submitRsvp(
    eventId: string,
    input: PortalRsvpInput,
  ): Promise<{ ok: boolean; rsvpId: string; confirmation?: { status: string; emailJobId?: string; smsJobId?: string } }> {
    return api.post(`/api/portal/${eventId}/rsvp`, input, { auth: false });
  },
};
