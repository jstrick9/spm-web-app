import { api } from './client.js';
import type { SdkGuest, SdkGuestCounts, SdkRsvp, SdkPortalInfo } from './types.js';

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

  create(eventId: string, input: GuestInput): Promise<{ guest: SdkGuest }> {
    return api.post(`/api/events/${eventId}/guests`, input);
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
