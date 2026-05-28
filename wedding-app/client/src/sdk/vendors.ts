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

export const vendorsSdk = {
  portalInfo(vendorId: string) {
    return api.get(`/api/portal/vendors/${vendorId}/info`, { auth: false });
  },
  submitQuestionnaire(vendorId: string, payload: Record<string, any>) {
    return api.post(`/api/portal/vendors/${vendorId}/questionnaire`, payload, { auth: false });
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
};
