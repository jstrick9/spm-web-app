/**
 * Guests SDK — replaces/extends the existing sdk/guests.ts.
 *
 * Adds:
 *   getDuplicates(orgId) — GET /api/orgs/:orgId/guest-duplicates
 *   merge(orgId, primaryId, duplicateIds) — POST /api/orgs/:orgId/guests/merge
 *
 * DuplicateCluster type mirrors server/src/db/repos/guestIdentity.ts
 * so the client has full type safety without any `any` cast.
 */
import { api } from './client.js';

// ── Existing guest types (preserved) ─────────────────────────────────────

export interface SdkGuest {
  id: string;
  event_id: string;
  organization_id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  party_name: string | null;
  rsvp_status: 'pending' | 'attending' | 'declined' | 'maybe';
  dietary_restrictions: string | null;
  accessibility_notes: string | null;
  table_assignment: string | null;
  seat_assignment: string | null;
  room_assignment: string | null;
  plus_one_allowed: boolean;
  allow_portal_access: boolean;
  created_at: string;
}

export interface SdkRsvpCounts {
  pending: number;
  attending: number;
  declined: number;
  maybe: number;
  total: number;
}

// ── Guest identity types ──────────────────────────────────────────────────

export type MatchSignal = 'email' | 'phone' | 'name';

export interface DuplicateMember {
  id: string;
  eventId: string;
  eventTitle: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  rsvpStatus: string;
  createdAt: string;
}

export interface DuplicateCluster {
  key: string;
  signals: MatchSignal[];
  confidence: 'high' | 'medium';
  members: DuplicateMember[];
  hasInEventDuplicate: boolean;
}

export interface GuestDuplicatesResponse {
  clusters: DuplicateCluster[];
}

export interface GuestMergeResponse {
  primary: SdkGuest;
  mergedCount: number;
}

// ── SDK object ────────────────────────────────────────────────────────────

export const guestsSdk = {
  // ── Existing methods (unchanged) ────────────────────────────────────────

  listForEvent(eventId: string): Promise<{
    guests: SdkGuest[];
    counts: SdkRsvpCounts;
    layout: unknown;
  }> {
    return api.get(`/api/events/${eventId}/guests`);
  },

  listForOrg(
    orgId: string,
    opts: {
      search?: string;
      rsvpStatus?: string;
      eventId?: string;
      limit?: number;
      offset?: number;
    } = {},
  ): Promise<{ guests: SdkGuest[]; total: number; counts: SdkRsvpCounts }> {
    const qs = new URLSearchParams();
    if (opts.search) qs.set('search', opts.search);
    if (opts.rsvpStatus) qs.set('rsvpStatus', opts.rsvpStatus);
    if (opts.eventId) qs.set('eventId', opts.eventId);
    if (opts.limit != null) qs.set('limit', String(opts.limit));
    if (opts.offset != null) qs.set('offset', String(opts.offset));
    const q = qs.toString();
    return api.get(`/api/orgs/${orgId}/guests${q ? `?${q}` : ''}`);
  },

  create(
    eventId: string,
    input: Partial<Omit<SdkGuest, 'id' | 'event_id' | 'organization_id' | 'created_at'>>,
  ): Promise<{ guest: SdkGuest }> {
    return api.post(`/api/events/${eventId}/guests`, input);
  },

  update(
    guestId: string,
    input: Partial<Omit<SdkGuest, 'id' | 'event_id' | 'organization_id' | 'created_at'>>,
  ): Promise<{ guest: SdkGuest }> {
    return api.patch(`/api/guests/${guestId}`, input);
  },

  delete(guestId: string): Promise<void> {
    return api.delete(`/api/guests/${guestId}`);
  },

  bulkCreate(
    eventId: string,
    guests: Array<Partial<Omit<SdkGuest, 'id' | 'event_id' | 'organization_id' | 'created_at'>>>,
  ): Promise<{ created: number; failed: number; errors: string[] }> {
    return api.post(`/api/events/${eventId}/guests/bulk`, { guests });
  },

  importCsv(eventId: string, rows: string[][]): Promise<{ created: number; errors: string[] }> {
    return api.post(`/api/events/${eventId}/guests/import`, { rows });
  },

  // ── Guest identity / merge (new) ────────────────────────────────────────

  /**
   * Returns all duplicate guest clusters across an org's events.
   * Clusters are grouped by the strongest shared signal.
   * Cache at 10 min — union-find over all org guests is expensive.
   */
  getDuplicates(orgId: string): Promise<GuestDuplicatesResponse> {
    return api.get(`/api/orgs/${orgId}/guest-duplicates`);
  },

  /**
   * Merge duplicate guest records into a single primary.
   * Human-confirmed — never called automatically.
   *
   * Server:
   *  1. Validates all IDs belong to the org.
   *  2. Backfills empty contact fields on primary from duplicates.
   *  3. Soft-deletes duplicates (deleted_at set).
   *  4. Writes audit log entry.
   *
   * @param orgId        - Org that owns the guests (RBAC scope)
   * @param primaryId    - Guest record to keep
   * @param duplicateIds - Records to merge into primary and soft-delete
   */
  merge(orgId: string, primaryId: string, duplicateIds: string[]): Promise<GuestMergeResponse> {
    return api.post(`/api/orgs/${orgId}/guests/merge`, { primaryId, duplicateIds });
  },
};
