import { api } from './client.js';

export interface SdkContract {
  id: string;
  organization_id: string;
  event_id: string;
  title: string;
  status: 'draft' | 'sent' | 'signed' | 'expired';
  recipient_name: string;
  recipient_email: string | null;
  amount_cents: number | null;
  content: string;
  sent_at: string | null;
  signed_at: string | null;
  signature: string | null;
  created_at: string;
}

export const contractsSdk = {
  list(eventId: string): Promise<{ contracts: SdkContract[] }> {
    return api.get(`/api/events/${eventId}/contracts`);
  },
  create(eventId: string, input: {
    title: string; recipientName: string; recipientEmail?: string;
    amountCents?: number; content?: string;
  }): Promise<{ contract: SdkContract }> {
    return api.post(`/api/events/${eventId}/contracts`, input);
  },
  update(id: string, patch: Partial<{ title: string; recipientName: string; amountCents: number; content: string }>): Promise<{ contract: SdkContract }> {
    return api.patch(`/api/contracts/${id}`, patch);
  },
  send(id: string): Promise<{ contract: SdkContract }> {
    return api.post(`/api/contracts/${id}/send`);
  },
  sign(id: string, signature: string): Promise<{ contract: SdkContract }> {
    return api.post(`/api/contracts/${id}/sign`, { signature });
  },
  delete(id: string): Promise<void> {
    return api.delete(`/api/contracts/${id}`);
  },
};
