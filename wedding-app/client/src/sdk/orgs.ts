import { api } from './client.js';
import type { SdkOrg } from './types.js';

export const orgsSdk = {
  list(): Promise<{ organizations: SdkOrg[] }> {
    return api.get('/api/orgs');
  },

  get(orgId: string): Promise<{ organization: SdkOrg }> {
    return api.get(`/api/orgs/${orgId}`);
  },

  updateBranding(orgId: string, branding: Record<string, unknown>): Promise<{ branding: Record<string, unknown> }> {
    return api.put(`/api/orgs/${orgId}/branding`, branding);
  },
};
