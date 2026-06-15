/**
 * Platform config SDK — wraps the GET/PUT endpoints from
 * server/src/routes/platformConfig.ts.
 *
 *   const { config } = await sdk.platformConfig.getOrg(orgId);
 *   await sdk.platformConfig.putOrg(orgId, { theme: { brand: '10 20 30' } });
 */
import { api } from './client.js';
import type { PartialPlatformConfig } from '../config/schema.js';

export interface AdminChangeRequest {
  id: string;
  organization_id: string;
  requested_by: string | null;
  title: string;
  area: string;
  reason: string | null;
  status: 'open' | 'approved' | 'rejected' | 'resolved';
  response_note: string | null;
  created_at: string;
  updated_at: string;
}

export const platformConfigSdk = {
  getOrg(orgId: string): Promise<{ config: PartialPlatformConfig }> {
    return api.get(`/api/orgs/${orgId}/config`);
  },
  putOrg(orgId: string, cfg: PartialPlatformConfig): Promise<{ config: PartialPlatformConfig }> {
    return api.put(`/api/orgs/${orgId}/config`, cfg);
  },
  listAdminChangeRequests(orgId: string): Promise<{ requests: AdminChangeRequest[] }> {
    return api.get(`/api/orgs/${orgId}/admin-change-requests`);
  },
  createAdminChangeRequest(orgId: string, input: { title: string; area?: string; reason?: string }): Promise<{ request: AdminChangeRequest }> {
    return api.post(`/api/orgs/${orgId}/admin-change-requests`, input);
  },
  updateAdminChangeRequest(orgId: string, id: string, input: { status?: AdminChangeRequest['status']; responseNote?: string | null }): Promise<{ request: AdminChangeRequest }> {
    return api.patch(`/api/orgs/${orgId}/admin-change-requests/${id}`, input);
  },

  getEvent(eventId: string): Promise<{ config: PartialPlatformConfig }> {
    return api.get(`/api/events/${eventId}/config`);
  },
  putEvent(eventId: string, cfg: PartialPlatformConfig): Promise<{ config: PartialPlatformConfig }> {
    return api.put(`/api/events/${eventId}/config`, cfg);
  },

  getUserPreferences(): Promise<{ config: PartialPlatformConfig }> {
    return api.get('/api/users/me/preferences');
  },
  putUserPreferences(cfg: PartialPlatformConfig): Promise<{ config: PartialPlatformConfig }> {
    return api.put('/api/users/me/preferences', cfg);
  },
};
