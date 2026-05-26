import { api } from './client.js';
import type { SdkTimelineItem } from './types.js';

export interface TimelineInput {
  title: string;
  category?: string;
  startsAt: string;
  endsAt?: string;
  durationMin?: number;
  location?: string;
  notes?: string;
  vendorId?: string;
  assignedTo?: string;
  metadata?: Record<string, unknown>;
}

export const timelineSdk = {
  list(eventId: string): Promise<{ items: SdkTimelineItem[] }> {
    return api.get(`/api/events/${eventId}/timeline`);
  },
  create(eventId: string, input: TimelineInput): Promise<{ item: SdkTimelineItem }> {
    return api.post(`/api/events/${eventId}/timeline`, input);
  },
  update(itemId: string, patch: Partial<TimelineInput & { completed: boolean }>): Promise<{ item: SdkTimelineItem }> {
    return api.patch(`/api/timeline/${itemId}`, patch);
  },
  delete(itemId: string): Promise<void> {
    return api.delete(`/api/timeline/${itemId}`);
  },
};
