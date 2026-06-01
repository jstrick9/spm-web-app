import { api } from './client.js';

export type CheckInStatus = 'expected' | 'arrived' | 'setup' | 'completed' | 'departed' | 'late';

export interface SdkCheckIn {
  id: string;
  event_id: string;
  vendor_id: string;
  status: CheckInStatus;
  checked_in_at: string | null;
  notes: string | null;
}

export const checkinsSdk = {
  list(eventId: string): Promise<{
    checkins: SdkCheckIn[];
    statusMap: Record<string, CheckInStatus>;
    counts: { expected: number; arrived: number; completed: number; departed: number };
  }> {
    return api.get(`/api/events/${eventId}/checkins`);
  },

  update(eventId: string, vendorId: string, status: CheckInStatus, notes?: string): Promise<{ checkin: SdkCheckIn }> {
    return api.post(`/api/events/${eventId}/checkins`, { vendorId, status, notes });
  },
};
