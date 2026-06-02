import { api } from './client.js';
import type { SdkGuest, SdkGuestCounts, SdkRsvp, SdkPortalInfo, SdkPortalConfig } from './types.js';

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

export const guestsSdk = {
  list(eventId: string): Promise<{ guests: SdkGuest[]; counts: SdkGuestCounts }> {
    return api.get(`/api/events/${eventId}/guests`);
  },

  listForOrg(orgId: string, filters: {
    search?: string;
    rsvpStatus?: string[];
    eventId?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<{ guests: (SdkGuest & { event_title: string })[]; total: number; counts: SdkGuestCounts }> {
    const q = new URLSearchParams();
    if (filters.search) q.set("search", filters.search);
    if (filters.rsvpStatus?.length) q.set("rsvpStatus", filters.rsvpStatus.join(","));
    if (filters.eventId) q.set("eventId", filters.eventId);
    if (filters.limit !== undefined) q.set("limit", String(filters.limit));
    if (filters.offset !== undefined) q.set("offset", String(filters.offset));
    const qs = q.toString();
    return api.get(`/api/orgs/${orgId}/guests${qs ? `?${qs}` : ""}`);
  },

  // ─── Guest identity resolution ────────────────────────
  duplicates(orgId: string): Promise<{ clusters: GuestDuplicateCluster[] }> {
    return api.get(`/api/orgs/${orgId}/guest-duplicates`);
  },
  merge(orgId: string, primaryId: string, duplicateIds: string[]): Promise<{ primary: SdkGuest; mergedCount: number }> {
    return api.post(`/api/orgs/${orgId}/guests/merge`, { primaryId, duplicateIds });
  },


  create(eventId: string, input: GuestInput): Promise<{ guest: SdkGuest }> {
    return api.post(`/api/events/${eventId}/guests`, input);
  },

  
  bulkCreate(eventId: string, mode: 'skip' | 'replace' | 'append', guests: GuestInput[]): Promise<{ inserted: number; updated: number; skipped: number }> {
    return api.post(`/api/events/${eventId}/guests/bulk`, { mode, guests });
  },

  update(guestId: string, patch: Partial<GuestInput>): Promise<{ guest: SdkGuest }> {
    return api.patch(`/api/guests/${guestId}`, patch);
  },

  delete(guestId: string): Promise<void> {
    return api.delete(`/api/guests/${guestId}`);
  },

  rotatePortalToken(guestId: string): Promise<{ token: string }> {
    return api.post(`/api/guests/${guestId}/portal-token`);
  },

  revokePortalToken(guestId: string): Promise<void> {
    return api.delete(`/api/guests/${guestId}/portal-token`);
  },

  getPortalConfig(eventId: string): Promise<{ config: SdkPortalConfig | undefined }> {
    return api.get(`/api/events/${eventId}/portal-config`);
  },
  
  updatePortalConfig(eventId: string, payload: {
    enabled: boolean;
    password?: string;
    clearPassword?: boolean;
    accessStartsAt?: string;
    accessEndsAt?: string;
    gracePeriodHours?: number;
    config?: Record<string, unknown>;
  }): Promise<{ config: SdkPortalConfig }> {
    return api.put(`/api/events/${eventId}/portal-config`, payload);
  },

};

export const rsvpSdk = {
  list(eventId: string): Promise<{ rsvps: SdkRsvp[] }> {
    return api.get(`/api/events/${eventId}/rsvps`);
  },
};

// ─── Public portal SDK (no auth) ───────────────────
export const portalSdk = {
  info(eventId: string): Promise<SdkPortalInfo> {
    return api.get(`/api/portal/${eventId}/info`, { auth: false });
  },

  verifyPassword(eventId: string, password: string): Promise<{ ok: boolean }> {
    return api.post(`/api/portal/${eventId}/verify-password`, { password }, { auth: false });
  },

  submitRsvp(eventId: string, input: RsvpInput): Promise<{ ok: boolean; rsvpId: string }> {
    return api.post(`/api/portal/${eventId}/rsvp`, input, { auth: false });
  },
};
