/**
 * Intelligence SDK — vendor ratings, email templates,
 * payment links, and recommendations.
 */
import { api } from './client.js';

// ─── Vendor Ratings ─────────────────────────────────────
export interface SdkVendorRating {
  id: string; vendor_id: string; event_id: string;
  rating: number; quality_score: number | null;
  timeliness_score: number | null; communication_score: number | null;
  review: string | null; created_at: string;
}

export interface VendorRatingAggregate {
  avgRating: number; count: number;
  avgQuality: number; avgTimeliness: number; avgCommunication: number;
}

export const vendorRatingsSdk = {
  list(vendorId: string): Promise<{ ratings: SdkVendorRating[]; aggregate: VendorRatingAggregate }> {
    return api.get(`/api/vendors/${vendorId}/ratings`);
  },
  create(vendorId: string, input: {
    eventId: string; rating: number;
    qualityScore?: number; timelinessScore?: number;
    communicationScore?: number; review?: string;
  }): Promise<{ rating: SdkVendorRating }> {
    return api.post(`/api/vendors/${vendorId}/ratings`, input);
  },
};

// ─── Email Templates ────────────────────────────────────
export interface SdkEmailTemplate {
  id: string; name: string; subject: string;
  body_html: string; body_text: string; category: string;
  merge_fields: string; created_at: string;
}

export const emailTemplatesSdk = {
  list(orgId: string): Promise<{ templates: SdkEmailTemplate[] }> {
    return api.get(`/api/orgs/${orgId}/email-templates`);
  },
  create(orgId: string, input: {
    name: string; subject: string; bodyHtml: string;
    bodyText?: string; category?: string;
  }): Promise<{ template: SdkEmailTemplate }> {
    return api.post(`/api/orgs/${orgId}/email-templates`, input);
  },
  delete(id: string): Promise<void> {
    return api.delete(`/api/email-templates/${id}`);
  },
  preview(id: string): Promise<{ rendered: { subject: string; html: string; text: string } }> {
    return api.post(`/api/email-templates/${id}/preview`);
  },
};

// ─── Payment Links ──────────────────────────────────────
export interface SdkPaymentLink {
  id: string; event_id: string | null; contract_id: string | null;
  provider: string; amount_cents: number;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'refunded';
  payment_url: string | null; paid_at: string | null; created_at: string;
}

export const paymentLinksSdk = {
  list(eventId: string): Promise<{ payments: SdkPaymentLink[]; totals: { total: number; paid: number; pending: number } }> {
    return api.get(`/api/events/${eventId}/payments`);
  },
  create(eventId: string, input: {
    contractId?: string; provider?: string;
    amountCents: number; paymentUrl?: string;
  }): Promise<{ payment: SdkPaymentLink }> {
    return api.post(`/api/events/${eventId}/payments`, input);
  },
  updateStatus(id: string, status: SdkPaymentLink['status']): Promise<{ payment: SdkPaymentLink }> {
    return api.patch(`/api/payments/${id}/status`, { status });
  },
};

// ─── Recommendations ────────────────────────────────────
export interface EventRecommendations {
  budgetRange: { p25: number; median: number; p75: number; count: number };
  guestCountRange: { p25: number; median: number; p75: number };
  topVendorCategories: Array<{ category: string; count: number; avgRating: number }>;
  seasonalDemand: Array<{ month: number; monthName: string; count: number; percentage: number }>;
  avgTimelineItems: number;
  popularMealChoices: Array<{ choice: string; count: number }>;
  leadSourceEffectiveness: Array<{ source: string; totalLeads: number; converted: number; conversionRate: number }>;
}

export const recommendationsSdk = {
  get(orgId: string): Promise<{ recommendations: EventRecommendations }> {
    return api.get(`/api/orgs/${orgId}/recommendations`);
  },
};
