import { api } from './client.js';

export type IntegrationStatus = 'pending' | 'connected' | 'disabled' | 'error' | 'revoked';
export type IntegrationKind = 'oauth' | 'api_key' | 'smtp' | 'webhook_only';

export interface SdkIntegrationProvider {
  id: string;
  name: string;
  category: string;
  description: string;
  iconKey?: string;
  docsUrl?: string;
  kind: IntegrationKind;
  capabilities: string[];
}

export interface SdkIntegration {
  id: string;
  organization_id: string;
  provider: string;
  status: IntegrationStatus;
  display_name: string | null;
  config: string;
  hasSecrets: boolean;
  last_error: string | null;
  last_synced_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface SdkIntegrationEvent {
  id: string;
  integration_id: string;
  organization_id: string;
  direction: 'inbound' | 'outbound';
  kind: string;
  status: 'ok' | 'error' | 'retry' | 'dropped';
  payload: string;
  error_message: string | null;
  related_type: string | null;
  related_id: string | null;
  created_at: string;
}

export const integrationsSdk = {
  providers(orgId: string): Promise<{ providers: SdkIntegrationProvider[] }> {
    return api.get(`/api/orgs/${orgId}/integrations/providers`);
  },

  list(orgId: string): Promise<{ integrations: SdkIntegration[] }> {
    return api.get(`/api/orgs/${orgId}/integrations`);
  },

  upsert(orgId: string, input: {
    provider: string;
    displayName?: string;
    config?: Record<string, unknown>;
    secrets?: Record<string, unknown>;
  }): Promise<{ integration: SdkIntegration }> {
    return api.post(`/api/orgs/${orgId}/integrations`, input);
  },

  test(orgId: string, provider: string): Promise<{ ok: boolean; integration: SdkIntegration; error?: string }> {
    return api.post(`/api/orgs/${orgId}/integrations/${provider}/test`);
  },

  update(id: string, patch: { displayName?: string; status?: 'connected' | 'disabled' }): Promise<{ integration: SdkIntegration }> {
    return api.patch(`/api/integrations/${id}`, patch);
  },

  delete(id: string): Promise<void> {
    return api.delete(`/api/integrations/${id}`);
  },

};
