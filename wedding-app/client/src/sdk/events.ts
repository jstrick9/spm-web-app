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
}

export type UpdateEventInput = Partial<Omit<CreateEventInput, 'organizationId'>>;

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

  update(eventId: string, patch: UpdateEventInput): Promise<{ event: SdkEvent }> {
    return api.patch(`/api/events/${eventId}`, patch);
  },

  delete(eventId: string): Promise<void> {
    return api.delete(`/api/events/${eventId}`);
  },

  listSubEvents(eventId: string) {
    return api.get(`/api/events/${eventId}/sub-events`);
  },

  createSubEvent(eventId: string, input: { title: string; startsAt: string; endsAt?: string; venueId?: string; inviteOnly?: boolean }) {
    return api.post(`/api/events/${eventId}/sub-events`, input);
  },
};
