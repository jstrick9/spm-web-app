import { api } from './client.js';

export interface SdkWebhook {
  id: string;
  organization_id: string;
  url: string;
  secret: string;
  event_types: string; // JSON array
  is_active: number;
  description: string | null;
  last_triggered: string | null;
  last_status: number | null;
  failure_count: number;
  created_at: string;
}

export interface SdkWebhookDelivery {
  id: string;
  webhook_id: string;
  event_type: string;
  payload: string;
  status: number | null;
  response: string | null;
  duration_ms: number | null;
  error: string | null;
  created_at: string;
}

export const webhooksSdk = {
  list(orgId: string): Promise<{ webhooks: SdkWebhook[] }> {
    return api.get(`/api/orgs/${orgId}/webhooks`);
  },

  create(orgId: string, input: {
    url: string;
    secret?: string;
    eventTypes?: string[];
    description?: string;
  }): Promise<{ webhook: SdkWebhook }> {
    return api.post(`/api/orgs/${orgId}/webhooks`, input);
  },

  update(id: string, patch: {
    url?: string;
    secret?: string;
    eventTypes?: string[];
    isActive?: boolean;
    description?: string;
  }): Promise<{ webhook: SdkWebhook }> {
    return api.patch(`/api/webhooks/${id}`, patch);
  },

  delete(id: string): Promise<void> {
    return api.delete(`/api/webhooks/${id}`);
  },

  deliveries(id: string): Promise<{ deliveries: SdkWebhookDelivery[] }> {
    return api.get(`/api/webhooks/${id}/deliveries`);
  },

  test(id: string): Promise<{ ok: boolean; message: string }> {
    return api.post(`/api/webhooks/${id}/test`);
  },
};
