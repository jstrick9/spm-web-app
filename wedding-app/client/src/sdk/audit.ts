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
  list(orgId: string, opts: { limit?: number; action?: string; before?: string; after?: string; actorEmail?: string } = {}): Promise<{ logs: SdkAuditLog[]; total: number; limit: number; nextBefore?: string }> {
    const q = new URLSearchParams();
    if (opts.limit) q.set('limit', String(opts.limit));
    if (opts.action) q.set('action', opts.action);
    if (opts.before) q.set('before', opts.before);
    if (opts.after) q.set('after', opts.after);
    if (opts.actorEmail) q.set('actorEmail', opts.actorEmail);
    const qs = q.toString();
    return api.get(`/api/orgs/${orgId}/audit${qs ? `?${qs}` : ''}`);
  },
};
