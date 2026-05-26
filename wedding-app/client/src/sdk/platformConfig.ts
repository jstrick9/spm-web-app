/**
 * Platform config SDK — wraps the GET/PUT endpoints from
 * server/src/routes/platformConfig.ts.
 *
 *   const { config } = await sdk.platformConfig.getOrg(orgId);
 *   await sdk.platformConfig.putOrg(orgId, { theme: { brand: '10 20 30' } });
 */
import { api } from './client.js';
import type { PartialPlatformConfig } from '../config/schema.js';

export const platformConfigSdk = {
  getOrg(orgId: string): Promise<{ config: PartialPlatformConfig }> {
    return api.get(`/api/orgs/${orgId}/config`);
  },
  putOrg(orgId: string, cfg: PartialPlatformConfig): Promise<{ config: PartialPlatformConfig }> {
    return api.put(`/api/orgs/${orgId}/config`, cfg);
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
