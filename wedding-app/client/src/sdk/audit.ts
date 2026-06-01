import { api } from './client.js';

export interface SdkAuditLog {
  id: string;
  organization_id: string | null;
  actor_user_id: string | null;
  actor_label: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  ip: string | null;
  details: string;
  created_at: string;
}

export const auditSdk = {
  list(orgId: string, opts: { limit?: number; action?: string } = {}): Promise<{ logs: SdkAuditLog[] }> {
    const q = new URLSearchParams();
    if (opts.limit) q.set('limit', String(opts.limit));
    if (opts.action) q.set('action', opts.action);
    const qs = q.toString();
    return api.get(`/api/orgs/${orgId}/audit${qs ? `?${qs}` : ''}`);
  },
};
