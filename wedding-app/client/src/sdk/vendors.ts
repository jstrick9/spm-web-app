import { api } from './client.js';
import type { SdkVendor } from './types.js';

export interface VendorInput {
  name: string;
  category?: string;
  contactName?: string;
  email?: string;
  phone?: string;
  websiteUrl?: string;
  contractAmountCents?: number;
  isPreferred?: boolean;
  notes?: string;
  metadata?: Record<string, unknown>;
  eventId?: string | null;
}

export interface VendorPortalTokenSummary {
  id: string;
  vendor_id: string;
  expires_at: string;
  revoked_at: string | null;
  last_used_at: string | null;
  created_at: string;
  is_active: number;
}

export const vendorsSdk = {
  portalInfo(vendorId: string, token: string) {
    return api.get(`/api/portal/vendors/${vendorId}/info?token=${encodeURIComponent(token)}`, { auth: false });
  },
  submitQuestionnaire(vendorId: string, payload: Record<string, any>, token: string) {
    return api.post(`/api/portal/vendors/${vendorId}/questionnaire`, { ...payload, token }, { auth: false });
  },
  portalGetMessages(vendorId: string, token: string): Promise<{ messages: any[] }> {
    return api.get(`/api/portal/vendors/${vendorId}/messages?token=${encodeURIComponent(token)}`, { auth: false });
  },
  portalSendMessage(vendorId: string, body: string, token: string): Promise<{ message: any }> {
    return api.post(`/api/portal/vendors/${vendorId}/messages`, { body, token }, { auth: false });
  },
  createPortalToken(vendorId: string, input: { expiresInDays?: number } = {}): Promise<{ token: string; tokenId: string; expiresAt: string }> {
    return api.post(`/api/vendors/${vendorId}/portal-token`, input);
  },
  revokePortalToken(vendorId: string): Promise<void> {
    return api.delete(`/api/vendors/${vendorId}/portal-token`);
  },
  listPortalTokens(orgId: string): Promise<{ tokens: VendorPortalTokenSummary[] }> {
    return api.get(`/api/orgs/${orgId}/vendor-portal-tokens`);
  },
  sendPortalInvite(vendorId: string, input: { expiresInDays?: number; message?: string } = {}): Promise<{ ok: boolean; expiresAt: string; delivery: { channel: string; queued: boolean; url: string }; token?: string }> {
    return api.post(`/api/vendors/${vendorId}/portal-invite`, input);
  },
  uploadCoi(vendorId: string, token: string, input: { fileName: string; mimeType: string; dataUri: string; expiresAt?: string }): Promise<{ ok: boolean; url: string; vendor: any }> {
    return api.post(`/api/portal/vendors/${vendorId}/coi-upload`, { ...input, token }, { auth: false });
  },
  list(orgId: string, opts: { eventId?: string } = {}): Promise<{ vendors: SdkVendor[] }> {
    const qs = opts.eventId ? `?eventId=${encodeURIComponent(opts.eventId)}` : '';
    return api.get(`/api/orgs/${orgId}/vendors${qs}`);
  },
  create(orgId: string, input: VendorInput): Promise<{ vendor: SdkVendor }> {
    return api.post(`/api/orgs/${orgId}/vendors`, input);
  },
  update(vendorId: string, patch: Partial<VendorInput>): Promise<{ vendor: SdkVendor }> {
    return api.patch(`/api/vendors/${vendorId}`, patch);
  },
  delete(vendorId: string): Promise<void> {
    return api.delete(`/api/vendors/${vendorId}`);
  },
  listPayments(vendorId: string) {
    return api.get(`/api/vendors/${vendorId}/payments`);
  },
  addPayment(vendorId: string, input: { amountCents: number; paidAt: string; method?: string; notes?: string }) {
    return api.post(`/api/vendors/${vendorId}/payments`, input);
  },
  deletePayment(vendorId: string, paymentId: string): Promise<void> {
    return api.delete(`/api/vendors/${vendorId}/payments/${paymentId}`);
  },
  reviewCoi(vendorId: string, input: { status: 'approved' | 'changes_requested'; note?: string }): Promise<{ vendor: SdkVendor }> {
    return api.post(`/api/vendors/${vendorId}/coi-review`, input);
  },
};
