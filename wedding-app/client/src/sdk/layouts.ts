import { api } from './client.js';
import type { SdkLayout } from './types.js';

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
  save(layoutId: string, payload: Record<string, unknown>, opts: { changeDescription?: string; expectedRevision?: number } = {}): Promise<{ layout: SdkLayout }> {
    return api.post(`/api/layouts/${layoutId}/save`, { payload, ...opts });
  },
  listVersions(layoutId: string) {
    return api.get(`/api/layouts/${layoutId}/versions`);
  },
  delete(layoutId: string): Promise<void> {
    return api.delete(`/api/layouts/${layoutId}`);
  },
};
