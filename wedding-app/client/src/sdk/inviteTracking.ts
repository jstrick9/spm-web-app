import { api } from './client.js';

export type InviteStatus = 'not_sent' | 'sent' | 'opened' | 'bounced';

export interface SdkInviteTracking {
  id: string;
  event_id: string;
  guest_id: string;
  status: InviteStatus;
  sent_at: string | null;
  opened_at: string | null;
}

export const inviteTrackingSdk = {
  list(eventId: string): Promise<{
    tracking: SdkInviteTracking[];
    statusMap: Record<string, InviteStatus>;
    counts: { notSent: number; sent: number; opened: number; bounced: number };
  }> {
    return api.get(`/api/events/${eventId}/invite-tracking`);
  },

  bulkSend(eventId: string): Promise<{ sent: number }> {
    return api.post(`/api/events/${eventId}/invite-tracking/send`);
  },

  updateStatus(eventId: string, guestId: string, status: InviteStatus): Promise<{ tracking: SdkInviteTracking }> {
    return api.patch(`/api/events/${eventId}/invite-tracking/${guestId}`, { status });
  },
};
