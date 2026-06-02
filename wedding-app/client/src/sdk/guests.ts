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
  info(eventId: string): Promise<PortalInfoResponse> {
    return api.get(`/api/portal/${eventId}/info`, { auth: false });
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
  ): Promise<{ ok: boolean; rsvpId: string }> {
    return api.post(`/api/portal/${eventId}/rsvp`, input, { auth: false });
  },
};
