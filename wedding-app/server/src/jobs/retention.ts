/**
 * Audit-log retention sweep.
 *
 * The default platform posture is REPORT-ONLY: nothing is deleted unless the
 * venue explicitly authorizes a retention policy by setting
 * AUDIT_RETENTION_DAYS (e.g. `365`). Setting it to 0 or leaving it unset
 * keeps the current report-only behavior forever.
 *
 * When enabled, the sweep runs once at boot and then every 24h:
 *   - deletes audit rows older than AUDIT_RETENTION_DAYS;
 *   - records one `system.audit_retention` audit row per affected org first
 *     (so the deletion itself is auditable);
 *   - logs the totals to stdout for ops monitoring.
 */
import { auditRepo } from '../db/repos/audit.js';
import { nowIso, toSqliteUtc } from '../lib/time.js';

export function auditRetentionDays(): number {
  const raw = Number(process.env.AUDIT_RETENTION_DAYS ?? 0);
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 0;
}

export function runAuditRetention(): { enabled: boolean; deletedRows: number; affectedOrgs: number } {
  const days = auditRetentionDays();
  if (days === 0) return { enabled: false, deletedRows: 0, affectedOrgs: 0 };

  // audit created_at is SQLite space format — an ISO cutoff would purge
  // same-day rows up to the end of the UTC day (see lib/time.ts).
  const cutoff = toSqliteUtc(new Date(Date.now() - days * 86_400_000));
  const affected = auditRepo.orgsWithRowsOlderThan(cutoff);

  for (const org of affected) {
    if (!org.organization_id) continue;
    auditRepo.log({
      organizationId: org.organization_id,
      action: 'system.audit_retention',
      details: { policyDays: days, deletedRows: org.rows, cutoff },
    });
  }

  let deletedRows = 0;
  for (const org of affected) {
    deletedRows += auditRepo.purgeBefore(cutoff, { organizationId: org.organization_id ?? undefined });
  }
  // Also purge rows with no org (e.g. failed-login events) if any.
  deletedRows += auditRepo.purgeBefore(cutoff);

  console.log(`[retention] audit sweep: deleted ${deletedRows} rows older than ${days}d across ${affected.length} org(s)`);
  return { enabled: true, deletedRows, affectedOrgs: affected.length };
}
