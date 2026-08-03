import './../test/setup.js';
import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { db } from '../db/database.js';
import { auditRepo } from '../db/repos/audit.js';
import { usersRepo } from '../db/repos/users.js';
import { orgsRepo } from '../db/repos/orgs.js';
import { hashPassword } from '../lib/crypto.js';
import { runAuditRetention, auditRetentionDays } from './retention.js';

let orgId: string;
let otherOrgId: string;

beforeAll(() => {
  const pwd = hashPassword('retention-test-password');
  const user = usersRepo.create({ email: 'retention@test.local', fullName: 'Retention', passwordHash: pwd.passwordHash, passwordSalt: pwd.passwordSalt, passwordIterations: pwd.iterations });
  orgId = orgsRepo.createWithOwner({ name: 'Retention Org', slug: `retention-${user.id.slice(0, 6)}`, ownerId: user.id });
  const otherUser = usersRepo.create({ email: 'retention-other@test.local', fullName: 'Retention Other', passwordHash: pwd.passwordHash, passwordSalt: pwd.passwordSalt, passwordIterations: pwd.iterations });
  otherOrgId = orgsRepo.createWithOwner({ name: 'Other Org', slug: `other-${otherUser.id.slice(0, 6)}`, ownerId: otherUser.id });
});

beforeEach(() => {
  try { db.prepare(`DELETE FROM audit_logs`).run(); } catch { /* noop */ }
  delete process.env.AUDIT_RETENTION_DAYS;
});

afterEach(() => {
  delete process.env.AUDIT_RETENTION_DAYS;
});

function insertOldRow(org: string | null, action: string, createdIso: string) {
  db.prepare(`INSERT INTO audit_logs (id, organization_id, action, details, created_at) VALUES (?, ?, ?, '{}', ?)`)
    .run(`audit-${Math.random().toString(36).slice(2)}`, org, action, createdIso);
}

describe('audit retention', () => {
  it('is report-only by default: no retention days means nothing is deleted', () => {
    expect(auditRetentionDays()).toBe(0);
    insertOldRow(orgId, 'event.update', '2020-01-01T00:00:00.000Z');
    const result = runAuditRetention();
    expect(result.enabled).toBe(false);
    const count = db.prepare(`SELECT COUNT(*) AS n FROM audit_logs`).get() as { n: number };
    expect(count.n).toBe(1);
  });

  it('deletes only rows older than the configured window when enabled', () => {
    process.env.AUDIT_RETENTION_DAYS = '365';
    insertOldRow(orgId, 'event.update', '2020-01-01T00:00:00.000Z');   // old → deleted
    insertOldRow(orgId, 'event.update', new Date().toISOString());      // fresh → kept
    insertOldRow(null, 'user.login.failed', '2020-01-01T00:00:00.000Z');  // org-less old → deleted

    const result = runAuditRetention();
    expect(result.enabled).toBe(true);
    expect(result.deletedRows).toBe(2);

    // Exactly the fresh event.update row survives (the 2020 rows are gone).
    const eventUpdates = db.prepare(`SELECT created_at FROM audit_logs WHERE action = 'event.update'`).all() as Array<{ created_at: string }>;
    expect(eventUpdates.length).toBe(1);
    expect(eventUpdates[0].created_at.startsWith('2020')).toBe(false);
    // The retention sweep itself is audited for the affected org.
    const retentionAudit = db.prepare(`SELECT COUNT(*) AS n FROM audit_logs WHERE action = 'system.audit_retention'`).get() as { n: number };
    expect(retentionAudit.n).toBe(1);
  });

  it('keeps recent rows across the cutoff boundary', () => {
    process.env.AUDIT_RETENTION_DAYS = '365';
    const recent = new Date(Date.now() - 100 * 86_400_000).toISOString();   // 100 days ago → kept
    const old = new Date(Date.now() - 400 * 86_400_000).toISOString();      // 400 days ago → deleted
    insertOldRow(orgId, 'org.branding.update', recent);
    insertOldRow(orgId, 'org.branding.update', old);
    const result = runAuditRetention();
    expect(result.deletedRows).toBe(1);
    const remaining = db.prepare(`SELECT COUNT(*) AS n FROM audit_logs WHERE action = 'org.branding.update'`).get() as { n: number };
    expect(remaining.n).toBe(1);
  });

  it('purgeBefore supports org-scoped deletion', () => {
    insertOldRow(orgId, 'event.update', '2020-01-01T00:00:00.000Z');
    insertOldRow(otherOrgId, 'event.update', '2020-01-01T00:00:00.000Z');
    const removed = auditRepo.purgeBefore('2021-01-01T00:00:00.000Z', { organizationId: orgId });
    expect(removed).toBe(1);
    const left = db.prepare(`SELECT COUNT(*) AS n FROM audit_logs`).get() as { n: number };
    expect(left.n).toBe(1);
  });
});
