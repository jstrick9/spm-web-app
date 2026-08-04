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

export interface FinancialLegalOpsState {
  escalations: Array<{ id: string; source_type: string; source_id: string | null; severity: 'info' | 'warning' | 'blocked'; status: string; label: string; detail: string | null; created_at: string }>;
  goNoGoFlags: Array<{ id: string; source_type: string; source_id: string | null; severity: 'warning' | 'blocked'; status: string; label: string; detail: string | null; created_at: string }>;
  obligationExtracts: Array<{ id: string; contract_id: string; obligation_key: string; label: string; excerpt: string | null; confidence: 'low' | 'medium' | 'high'; status: string }>;
  paymentDueRisk: { overdue: number; dueSoon: number; pendingCents: number };
}

export const contractsSdk = {
  list(eventId: string): Promise<{ contracts: SdkContract[] }> {
    return api.get(`/api/events/${eventId}/contracts`);
  },
  financialLegal(eventId: string): Promise<{ financialLegal: FinancialLegalOpsState }> {
    return api.get(`/api/events/${eventId}/financial-legal`);
  },
  createFinancialLegalEscalation(eventId: string, input: { sourceType?: 'contract' | 'payment' | 'legal' | 'manual'; sourceId?: string; severity?: 'info' | 'warning' | 'blocked'; label: string; detail?: string; createGoNoGoFlag?: boolean }) {
    return api.post(`/api/events/${eventId}/financial-legal/escalations`, input);
  },
  createGoNoGoFlag(eventId: string, input: { sourceType?: 'contract' | 'payment' | 'legal' | 'manual'; sourceId?: string; severity?: 'warning' | 'blocked'; label: string; detail?: string }) {
    return api.post(`/api/events/${eventId}/financial-legal/go-no-go-flags`, input);
  },
  approveGoNoGoFlag(eventId: string, flagId: string) {
    return api.post(`/api/events/${eventId}/financial-legal/go-no-go-flags/${flagId}/approve`, {});
  },
  resolveGoNoGoFlag(eventId: string, flagId: string) {
    return api.post(`/api/events/${eventId}/financial-legal/go-no-go-flags/${flagId}/resolve`, {});
  },
  decideObligation(contractId: string, obligationId: string, status: 'approved' | 'dismissed') {
    return api.post(`/api/contracts/${contractId}/obligations/${obligationId}`, { status });
  },
  extractObligations(id: string) {
    return api.post(`/api/contracts/${id}/extract-obligations`, {});
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
