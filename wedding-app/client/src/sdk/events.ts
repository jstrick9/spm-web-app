import { api } from './client.js';
import type { SdkEvent, SdkEventStatus } from './types.js';

export interface CreateEventInput {
  organizationId: string;
  title: string;
  status?: SdkEventStatus;
  startDate?: string;
  endDate?: string;
  guestCount?: number;
  budgetCents?: number;
  primaryContactUserId?: string;
  leadSource?: string;
  rsvpDeadline?: string;
  venueId?: string;
  metadata?: Record<string, any>;
}

export type UpdateEventInput = Partial<Omit<CreateEventInput, 'organizationId'>> & {
  metadata?: Record<string, any>;
};

export interface EventListFilters {
  status?: Array<SdkEvent['status']>;
  search?: string;
  startsAfter?: string;
  startsBefore?: string;
  limit?: number;
  offset?: number;
}

export interface EventStatusCounts {
  lead: number; hold: number; booked: number; planning: number;
  final_review: number;
  completed: number; cancelled: number; lost: number;
}

export const eventsSdk = {
  list(orgId: string, filters: EventListFilters = {}): Promise<{ events: SdkEvent[]; counts: EventStatusCounts }> {
    const q = new URLSearchParams();
    if (filters.status?.length) q.set('status', filters.status.join(','));
    if (filters.search)         q.set('search', filters.search);
    if (filters.startsAfter)    q.set('startsAfter', filters.startsAfter);
    if (filters.startsBefore)   q.set('startsBefore', filters.startsBefore);
    if (filters.limit !== undefined)  q.set('limit',  String(filters.limit));
    if (filters.offset !== undefined) q.set('offset', String(filters.offset));
    const qs = q.toString();
    return api.get(`/api/orgs/${orgId}/events${qs ? `?${qs}` : ''}`);
  },

  get(eventId: string): Promise<{ event: SdkEvent }> {
    return api.get(`/api/events/${eventId}`);
  },

  create(input: CreateEventInput): Promise<{ event: SdkEvent }> {
    return api.post('/api/events', input);
  },

  transitionStage(eventId: string, status: SdkEvent['status']): Promise<{ event: SdkEvent }> { return api.post(`/api/events/${eventId}/stage`, { status }); },
  finalReview(eventId: string): Promise<{ finalReview: { ready: boolean; checks: Array<{ key: string; label: string; complete: boolean }> } }> { return api.get(`/api/events/${eventId}/final-review`); },
  setFinalReviewCheck(eventId: string, key: 'confirmed_guest_count' | 'staffing_readiness' | 'inventory_readiness' | 'accessibility_checks' | 'rain_plan_checks', complete: boolean): Promise<{ event: SdkEvent; finalReview: { ready: boolean; checks: Array<{ key: string; label: string; complete: boolean }> } }> { return api.post(`/api/events/${eventId}/final-review/checks`, { key, complete }); },
  finalReviewChangeRequests(eventId: string): Promise<{ requests: Array<{ id: string; requested_role: string; detail: string; status: string; manager_note: string | null; created_at: string }> }> { return api.get(`/api/events/${eventId}/final-review/change-requests`); },
  requestFinalReviewChange(eventId: string, detail: string): Promise<{ request: Record<string, unknown> }> { return api.post(`/api/events/${eventId}/final-review/change-requests`, { detail }); },
  decideFinalReviewChange(eventId: string, requestId: string, status: 'accepted' | 'declined' | 'resolved', managerNote?: string): Promise<{ request: Record<string, unknown> }> { return api.patch(`/api/events/${eventId}/final-review/change-requests/${requestId}`, { status, managerNote }); },
  update(eventId: string, patch: UpdateEventInput): Promise<{ event: SdkEvent }> {
    return api.patch(`/api/events/${eventId}`, patch);
  },

  delete(eventId: string): Promise<void> {
    return api.delete(`/api/events/${eventId}`);
  },

  duplicate(eventId: string): Promise<{ event: SdkEvent }> {
    return api.post(`/api/events/${eventId}/duplicate`);
  },


  listSubEvents(eventId: string) {
    return api.get(`/api/events/${eventId}/sub-events`);
  },

  createSubEvent(eventId: string, input: { title: string; startsAt: string; endsAt?: string; venueId?: string; inviteOnly?: boolean; metadata?: Record<string, unknown> }) {
    return api.post(`/api/events/${eventId}/sub-events`, input);
  },

  updateSubEvent(subEventId: string, input: Partial<{ title: string; startsAt: string; endsAt: string | null; venueId: string | null; inviteOnly: boolean; metadata: Record<string, unknown> }>) {
    return api.patch(`/api/sub-events/${subEventId}`, input);
  },
};
