import { db } from '../database.js';
import { uuid } from '../../lib/crypto.js';
import { stringifyJson } from '../../lib/json.js';

export interface AuditLogRow {
  id: string;
  organization_id: string | null;
  actor_user_id: string | null;
  actor_label: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  ip: string | null;
  user_agent: string | null;
  details: string;
  created_at: string;
}

export const auditRepo = {
  log(input: {
    organizationId?: string;
    actorUserId?: string;
    actorLabel?: string;
    action: string;
    targetType?: string;
    targetId?: string;
    ip?: string;
    userAgent?: string;
    details?: Record<string, unknown>;
  }): void {
    db.prepare(
      `INSERT INTO audit_logs
         (id, organization_id, actor_user_id, actor_label, action, target_type, target_id, ip, user_agent, details)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      uuid(),
      input.organizationId ?? null,
      input.actorUserId ?? null,
      input.actorLabel ?? null,
      input.action,
      input.targetType ?? null,
      input.targetId ?? null,
      input.ip ?? null,
      input.userAgent ?? null,
      stringifyJson(input.details ?? {}),
    );
  },

  listForOrg(orgId: string, opts: { limit?: number; action?: string } = {}): AuditLogRow[] {
    let sql = `SELECT * FROM audit_logs WHERE organization_id = ?`;
    const params: unknown[] = [orgId];
    if (opts.action) { sql += ` AND action = ?`; params.push(opts.action); }
    sql += ` ORDER BY created_at DESC LIMIT ?`;
    params.push(opts.limit ?? 500);
    return db.prepare(sql).all(...params) as AuditLogRow[];
  },
};
