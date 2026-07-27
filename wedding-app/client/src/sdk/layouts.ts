import { api } from './client.js';
import type { SdkLayout } from './types.js';

export type LayoutFloorWalkStatus = 'pending' | 'verified' | 'issue';
export type LayoutPacketAudience = 'setup_crew' | 'vendors' | 'planner' | 'fire_marshal';

export interface LayoutOpsState {
  floorWalkChecks: Array<{ id: string; check_id: string; status: LayoutFloorWalkStatus; note: string | null; verified_at: string | null }>;
  varianceEvidence: Array<{ id: string; note: string; photo_url: string | null; status: 'open' | 'resolved'; created_at: string }>;
  rainPlan: { id: string; active: 0 | 1; note: string | null; activated_at: string } | null;
  vendorZoneInspections: Array<{ id: string; vendor_id: string | null; status: LayoutFloorWalkStatus; zone_label: string | null; note: string | null }>;
  setupPackets: Array<{ id: string; token: string; audience: LayoutPacketAudience; updated_at: string }>;
}

export const layoutsSdk = {
  list(orgId: string, opts: { eventId?: string; template?: boolean } = {}): Promise<{ layouts: SdkLayout[] }> {
    const q = new URLSearchParams();
    if (opts.eventId !== undefined) q.set('eventId', opts.eventId);
    if (opts.template !== undefined) q.set('template', String(opts.template));
    const qs = q.toString();
    return api.get(`/api/orgs/${orgId}/layouts${qs ? `?${qs}` : ''}`);
  },
  get(layoutId: string): Promise<{ layout: SdkLayout }> {
    return api.get(`/api/layouts/${layoutId}`);
  },
  create(input: {
    organizationId: string;
    eventId?: string;
    venueId?: string;
    name: string;
    visibility?: SdkLayout['visibility'];
    payload: Record<string, unknown>;
    isTemplate?: boolean;
  }): Promise<{ layout: SdkLayout }> {
    return api.post('/api/layouts', input);
  },
  save(layoutId: string, payload: Record<string, unknown>, opts: { changeDescription?: string; expectedRevision?: number; approvalStatus?: string } = {}): Promise<{ layout: SdkLayout }> {
    return api.post(`/api/layouts/${layoutId}/save`, { payload, ...opts });
  },
  listVersions(layoutId: string) {
    return api.get(`/api/layouts/${layoutId}/versions`);
  },
  ops(layoutId: string): Promise<{ ops: LayoutOpsState }> {
    return api.get(`/api/layouts/${layoutId}/ops`);
  },
  setFloorWalkCheck(layoutId: string, input: { checkId: string; status: LayoutFloorWalkStatus; note?: string }) {
    return api.post(`/api/layouts/${layoutId}/floor-walk-checks`, input);
  },
  addVarianceEvidence(layoutId: string, input: { note: string; photoDataUri?: string; photoUrl?: string }) {
    return api.post(`/api/layouts/${layoutId}/variance-evidence`, input);
  },
  setRainPlan(layoutId: string, input: { active: boolean; note?: string }) {
    return api.post(`/api/layouts/${layoutId}/rain-plan`, input);
  },
  setVendorZoneInspection(layoutId: string, input: { vendorId?: string; status: LayoutFloorWalkStatus; zoneLabel?: string; note?: string }) {
    return api.post(`/api/layouts/${layoutId}/vendor-zone-inspections`, input);
  },
  createSetupPacket(layoutId: string, input: { audience?: LayoutPacketAudience; payload?: Record<string, unknown>; expiresAt?: string } = {}): Promise<{ packet: { token: string; audience: LayoutPacketAudience }; publicUrl: string }> {
    return api.post(`/api/layouts/${layoutId}/setup-packet`, input);
  },
  collaboration(layoutId: string): Promise<{ comments: any[]; reviews: any[] }> { return api.get(`/api/layouts/${layoutId}/collaboration`); },
  addComment(layoutId: string, input: { body: string; target?: Record<string, unknown> }) { return api.post(`/api/layouts/${layoutId}/comments`, input); },
  requestReview(layoutId: string) { return api.post(`/api/layouts/${layoutId}/review-request`); },
  decideReview(layoutId: string, reviewId: string, input: { decision: 'approved'|'changes_requested'|'rejected'; note?: string }) { return api.post(`/api/layouts/${layoutId}/reviews/${reviewId}/decision`, input); },
  delete(layoutId: string): Promise<void> {
    return api.delete(`/api/layouts/${layoutId}`);
  },
};
