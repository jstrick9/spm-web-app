import './test/setup.js';
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { db } from './db/database.js';
import { buildApp } from './index.js';
import type { FastifyInstance } from 'fastify';
import { nowIso, toSqliteUtc, isoToSqliteUtc } from './lib/time.js';
import { teamInvitationsRepo, webhooksRepo, auditRepo, jobsRepo } from './db/repos/index.js';
import { passwordResetTokensRepo } from './db/repos/passwordResetTokens.js';

/**
 * TIMESTAMP-HYGIENE REGRESSION TESTS
 *
 * Root cause under test: some columns are written with ISO-8601 strings
 * ("2026-08-04T01:00:00.000Z") while the comparison uses SQLite's
 * datetime('now') (space format "2026-08-04 01:00:00"). String comparison
 * then treats EVERY ISO string as newer than every space string on the
 * same day ('T' > ' '), which meant:
 *   - expiry checks (password reset / invites / packets / capabilities)
 *     stayed valid until UTC midnight instead of expiring on time;
 *   - webhook retries due "now" weren't claimed until the next UTC day;
 *   - audit time-range filters dropped all same-day rows;
 *   - audit retention purged up to 24h too much per run.
 * Each test below pins the FIXED behavior; the old code fails it.
 */

let app: FastifyInstance;
beforeAll(async () => { app = await buildApp(); await app.ready(); });

beforeEach(() => {
  for (const t of [
    'push_subscriptions', 'sse_events', 'audit_logs', 'webhook_deliveries', 'webhooks',
    'job_queue', 'password_reset_tokens', 'team_invitations', 'layout_setup_packets',
    'asset_capabilities', 'timeline_reminders', 'events', 'organization_memberships',
    'organizations', 'users',
  ]) {
    try { db.prepare(`DELETE FROM ${t}`).run(); } catch { /* ok */ }
  }
});

async function register(email = `ts-${Math.random().toString(36).slice(2)}@x.com`) {
  const r = await app.inject({
    method: 'POST', url: '/api/auth/register',
    payload: { email, password: 'testpass123', fullName: 'TS Tester', orgName: 'TSOrg' },
    headers: { 'content-type': 'application/json' },
  });
  return { token: r.json().token, userId: r.json().user.id, orgId: r.json().organizationId, email };
}

/** Insert an audit row with a SQLite space-format created_at (like the real default). */
function addAuditRow(orgId: string, action: string, sqliteExpr: string) {
  db.prepare(
    `INSERT INTO audit_logs (id, organization_id, actor_label, action, details, created_at)
     VALUES (?, ?, 'system', ?, '{}', ${sqliteExpr})`,
  ).run(`audit-${Math.random().toString(36).slice(2)}`, orgId, action);
}

describe('timestamp hygiene (ISO vs datetime("now") string comparisons)', () => {
  it('password reset tokens expire at their ISO expiry time, not UTC midnight', async () => {
    const u = await register();
    const created = passwordResetTokensRepo.create(u.userId, 30 * 60 * 1000);
    // Valid right now
    expect(passwordResetTokensRepo.findValidByToken(created.token)).toBeTruthy();

    // Backdate to 2 hours ago — SAME UTC day as now. Old code compared the
    // ISO string against datetime('now') and kept the token valid until
    // midnight; the fixed code must treat it as expired.
    const twoHoursAgo = new Date(Date.now() - 2 * 3_600_000).toISOString();
    db.prepare(`UPDATE password_reset_tokens SET expires_at = ? WHERE id = ?`).run(twoHoursAgo, created.row.id);
    expect(passwordResetTokensRepo.findValidByToken(created.token)).toBeUndefined();
  });

  it('team invitations expire at their ISO expiry time, not UTC midnight', async () => {
    const u = await register();
    const inv = teamInvitationsRepo.create({
      organizationId: u.orgId,
      email: 'invitee@x.com',
      roleId: 'sys_planner',
      invitedBy: u.userId,
      ttlMs: 7 * 24 * 3_600_000,
    });
    expect(teamInvitationsRepo.findValidByToken(inv.token)).toBeTruthy();
    db.prepare(`UPDATE team_invitations SET expires_at = ? WHERE id = ?`)
      .run(new Date(Date.now() - 3_600_000).toISOString(), inv.row.id);
    expect(teamInvitationsRepo.findValidByToken(inv.token)).toBeUndefined();
  });

  it('webhook retries scheduled "now" are claimed immediately (same UTC day)', async () => {
    const u = await register();
    const hook = webhooksRepo.create({
      organizationId: u.orgId, url: 'https://example.com/hook', createdBy: u.userId,
    });
    const deliveryId = `del-${Math.random().toString(36).slice(2)}`;
    // next_retry_at is written in ISO by the dispatcher; 5 seconds ago =
    // due now. Old code compared against datetime('now') and skipped every
    // same-day ISO value, delaying retries up to 24h.
    db.prepare(
      `INSERT INTO webhook_deliveries (id, webhook_id, event_type, payload, status, next_retry_at, attempt_count)
       VALUES (?, ?, 'event.test', '{}', 'failed', ?, 1)`,
    ).run(deliveryId, hook.id, new Date(Date.now() - 5_000).toISOString());

    const due = webhooksRepo.claimDueRetries(10);
    expect(due.some((d) => d.id === deliveryId)).toBe(true);
  });

  it('audit time-range filters include same-day rows when the after param is ISO', async () => {
    const u = await register();
    const oneHourAgo = `datetime('now', '-1 hour')`;
    const threeHoursAgo = `datetime('now', '-3 hours')`;
    addAuditRow(u.orgId, 'test.recent', oneHourAgo);
    addAuditRow(u.orgId, 'test.old', threeHoursAgo);

    const afterIso = new Date(Date.now() - 2 * 3_600_000).toISOString();
    const logs = auditRepo.listForOrg(u.orgId, { after: afterIso });
    // (register() writes its own audit rows at "now" — they're included;
    // the point is that the 3-hours-ago row must NOT be.)
    expect(logs.some((l) => l.action === 'test.recent')).toBe(true);
    expect(logs.some((l) => l.action === 'test.old')).toBe(false);
  });

  it('audit retention purge respects the exact cutoff hour (ISO cutoff)', async () => {
    const u = await register();
    // Row from 2 hours ago — NEWER than the 4h cutoff → must survive.
    addAuditRow(u.orgId, 'test.keep', `datetime('now', '-2 hours')`);
    // Row from 6 hours ago — OLDER than the 4h cutoff → must be purged.
    addAuditRow(u.orgId, 'test.drop', `datetime('now', '-6 hours')`);

    const cutoffIso = new Date(Date.now() - 4 * 3_600_000).toISOString();
    const deleted = auditRepo.purgeBefore(cutoffIso, { organizationId: u.orgId });
    expect(deleted).toBe(1);
    const remaining = auditRepo.listForOrg(u.orgId, {});
    expect(remaining.some((l) => l.action === 'test.keep')).toBe(true);
    expect(remaining.some((l) => l.action === 'test.drop')).toBe(false);
  });

  it('job queue stores ISO run_at and claims due jobs immediately', async () => {
    const u = await register();
    const job = jobsRepo.enqueue({ kind: 'test.noop', organizationId: u.orgId });
    // Written format must be ISO (not datetime('now') space format).
    expect(job.run_at).toMatch(/T.*Z$/);
    const claimed = jobsRepo.claimNext('worker-1');
    expect(claimed?.id).toBe(job.id);
  });

  it('timeline reminders are stored as canonical ISO regardless of input format', async () => {
    const u = await register();
    const evt = await app.inject({
      method: 'POST', url: '/api/events',
      payload: { organizationId: u.orgId, title: 'TS Wedding' },
      headers: { authorization: `Bearer ${u.token}`, 'content-type': 'application/json' },
    });
    const eventId = evt.json().event.id;
    const res = await app.inject({
      method: 'POST', url: `/api/events/${eventId}/timeline-ops/reminder`,
      payload: { remindAt: '2026-09-01 14:00', audience: 'venue_staff' },
      headers: { authorization: `Bearer ${u.token}`, 'content-type': 'application/json' },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().reminder.remind_at).toMatch(/T.*Z$/);
  });

  it('isoToSqliteUtc converts ISO for comparisons against space-format columns', () => {
    expect(isoToSqliteUtc('2026-09-01T14:30:00.000Z')).toBe('2026-09-01 14:30:00');
  });
});

// keep unused import referenced (toSqliteUtc used in real retention code)
void toSqliteUtc;
void nowIso;
