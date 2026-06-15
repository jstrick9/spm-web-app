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
  update(id: string, patch: Partial<{ name: string; subject: string; bodyHtml: string; bodyText: string; category: string }>): Promise<{ template: SdkEmailTemplate }> {
    return api.patch(`/api/email-templates/${id}`, patch);
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
  metadata?: any;
}

export const paymentLinksSdk = {
  list(eventId: string): Promise<{ payments: SdkPaymentLink[]; totals: { total: number; paid: number; pending: number } }> {
    return api.get(`/api/events/${eventId}/payments`);
  },
  create(eventId: string, input: {
    contractId?: string; provider?: string;
    amountCents: number; paymentUrl?: string;
    metadata?: Record<string, any>;
  }): Promise<{ payment: SdkPaymentLink }> {
    return api.post(`/api/events/${eventId}/payments`, input);
  },
  updateStatus(id: string, status: SdkPaymentLink['status'], patch: { metadata?: Record<string, any>; reconciliationNote?: string; partialPaidCents?: number; refundedCents?: number } = {}): Promise<{ payment: SdkPaymentLink }> {
    return api.patch(`/api/payments/${id}/status`, { status, ...patch });
  },
  /**
   * Create a real hosted checkout (Stripe/Square) for a payment link and
   * return its URL. Requires a connected payment integration for the org.
   */
  checkout(id: string): Promise<{ checkoutUrl: string; payment: SdkPaymentLink }> {
    return api.post(`/api/payments/${id}/checkout`, {});
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

// ─── Predictive forecast ────────────────────────────────
export interface ForecastMonthPoint {
  ym: string; label: string; bookings: number; revenueCents: number;
}
export interface ForecastProjectionPoint extends ForecastMonthPoint {
  projected: true; seasonalIndex: number;
}
export interface RevenueForecast {
  history: ForecastMonthPoint[];
  projection: ForecastProjectionPoint[];
  trend: { direction: 'up' | 'down' | 'flat'; monthlySlopeCents: number; growthPct: number };
  totals: {
    trailingRevenueCents: number; projectedRevenueCents: number;
    trailingBookings: number; projectedBookings: number;
  };
  pipeline: { openEvents: number; openRevenueCents: number };
  meta: { monthsOfHistory: number; horizonMonths: number; confidence: 'low' | 'medium' | 'high' };
}

export type HealthActionPriority = 'critical' | 'high' | 'medium' | 'low';
export type HealthActionSource = 'risk' | 'forecast' | 'vendor_reliability' | 'guest_identity' | 'rsvp_lag' | 'timeline_completeness' | 'contracts' | 'payments';

export interface HealthCommandAction {
  id: string;
  priority: HealthActionPriority;
  source: HealthActionSource;
  title: string;
  detail: string;
  href: string;
  eventId?: string;
  eventTitle?: string;
  impact: string;
  confidence: 'high' | 'medium' | 'low';
  relatedSignals: string[];
  thresholdExplanation?: string;
  fixCta?: string;
  state?: {
    status: 'open' | 'acknowledged' | 'snoozed' | 'resolved';
    snoozedUntil: string | null;
    assignedTo: string | null;
    note: string | null;
    updatedAt: string;
  };
}

export interface HealthCommandCenter {
  summary: {
    openEvents: number;
    flaggedEvents: number;
    criticalActions: number;
    highActions: number;
    mediumActions: number;
    lowActions: number;
    avgHealthScore: number | null;
    forecastConfidence: 'high' | 'medium' | 'low';
    projectedRevenueCents: number;
    pipelineRevenueCents: number;
    lowReliabilityVendors: number;
    guestDuplicateClusters: number;
    rsvpLagEvents: number;
    timelineIncompleteEvents: number;
  };
  actions: HealthCommandAction[];
  resolvedActions?: Array<{ actionId: string; status: string; note: string | null; updatedAt: string }>;
}

export const healthCommandSdk = {
  get(orgId: string): Promise<{ commandCenter: HealthCommandCenter }> {
    return api.get(`/api/orgs/${orgId}/health-command-center`);
  },
  updateActionState(orgId: string, actionId: string, input: {
    status: 'open' | 'acknowledged' | 'snoozed' | 'resolved';
    snoozedUntil?: string | null;
    assignedTo?: string | null;
    note?: string | null;
  }): Promise<{ state: any }> {
    return api.patch(`/api/orgs/${orgId}/health-command-center/actions/${encodeURIComponent(actionId)}`, input);
  },
};

export const forecastSdk = {
  get(orgId: string, opts: { history?: number; horizon?: number } = {}): Promise<{ forecast: RevenueForecast }> {
    const qs = new URLSearchParams();
    if (opts.history) qs.set('history', String(opts.history));
    if (opts.horizon) qs.set('horizon', String(opts.horizon));
    const q = qs.toString();
    return api.get(`/api/orgs/${orgId}/forecast${q ? `?${q}` : ''}`);
  },
};

// ─── Vendor reliability scoring + smart matching ────────
export type VendorTier = 'top_rated' | 'trusted' | 'promising' | 'unrated';

export interface VendorScore {
  vendorId: string;
  name: string;
  category: string;
  isPreferred: boolean;
  ratingCount: number;
  avgRating: number;
  avgQuality: number;
  avgTimeliness: number;
  avgCommunication: number;
  reliabilityScore: number;        // 0–100
  tier: VendorTier;
  typicalContractCents: number | null;
}

export interface VendorMatch extends VendorScore {
  fitScore: number;
  budgetFit: 'under' | 'within' | 'over' | 'unknown';
  matchReasons: string[];
}

export const vendorScoringSdk = {
  scores(orgId: string): Promise<{ scores: VendorScore[] }> {
    return api.get(`/api/orgs/${orgId}/vendor-scores`);
  },
  matches(eventId: string, opts: { category?: string; limit?: number } = {}): Promise<{ matches: VendorMatch[] }> {
    const qs = new URLSearchParams();
    if (opts.category) qs.set('category', opts.category);
    if (opts.limit) qs.set('limit', String(opts.limit));
    const q = qs.toString();
    return api.get(`/api/events/${eventId}/vendor-matches${q ? `?${q}` : ''}`);
  },
};

// ─── Anomaly & risk alerts ──────────────────────────────
export type RiskSeverity = 'critical' | 'warning' | 'info';

export interface RiskAlert {
  id: string;
  kind: string;
  severity: RiskSeverity;
  title: string;
  detail: string;
  href: string;
}

export interface EventRisk {
  eventId: string;
  eventTitle: string;
  startDate: string | null;
  daysUntil: number | null;
  healthScore: number;
  alerts: RiskAlert[];
}

export const riskSdk = {
  forOrg(orgId: string): Promise<{ events: EventRisk[] }> {
    return api.get(`/api/orgs/${orgId}/risk-alerts`);
  },
  forEvent(eventId: string): Promise<{ risk: EventRisk | undefined }> {
    return api.get(`/api/events/${eventId}/risk-alerts`);
  },
};
