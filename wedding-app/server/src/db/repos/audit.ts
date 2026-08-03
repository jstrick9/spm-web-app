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

  /**
   * Retention: delete audit rows created before `beforeIso` (ISO-8601 or
   * SQLite datetime string). Returns the number of deleted rows. Only called
   * when the venue has explicitly authorized a retention policy (the
   * AUDIT_RETENTION_DAYS env var); the default platform posture is
   * report-only — nothing is ever deleted automatically.
   */
  purgeBefore(beforeIso: string, opts: { organizationId?: string } = {}): number {
    let sql = `DELETE FROM audit_logs WHERE created_at < ?`;
    const params: unknown[] = [beforeIso];
    if (opts.organizationId) { sql += ` AND organization_id = ?`; params.push(opts.organizationId); }
    return db.prepare(sql).run(...params).changes;
  },

  /** Distinct orgs with audit rows older than `beforeIso` (for retention reporting). */
  orgsWithRowsOlderThan(beforeIso: string): Array<{ organization_id: string | null; rows: number }> {
    return db.prepare(
      `SELECT organization_id, COUNT(*) AS rows FROM audit_logs WHERE created_at < ? GROUP BY organization_id`
    ).all(beforeIso) as Array<{ organization_id: string | null; rows: number }>;
  },
};
