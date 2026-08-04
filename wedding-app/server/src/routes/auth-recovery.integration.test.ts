/**
 * Regression tests for the login 500 hotfix ("Sign-in failed 500
 * internal-error" on pre-0049 databases).
 *
 * Root cause: databases created before migration 0049 lack the
 * users.password_iterations column. The latest login code verifies the
 * legacy 120k-work-factor hash fine, then the rehash-on-login upgrade ran
 * `UPDATE users SET password_iterations = ?`, which threw
 * "no such column: password_iterations" → generic 500.
 *
 * Fixes under test:
 *   1. buildApp() now applies pending migrations on boot (idempotent) →
 *      a stale schema is healed automatically on restart.
 *   2. The rehash-on-login upgrade is non-fatal: if it cannot persist
 *      (read-only DB, disk full, exotic drift), login still succeeds and the
 *      failure is audited as `user.password.rehash.failed`.
 *   3. Legacy-work-factor hashes keep verifying until the upgrade lands.
 */
import './../test/setup.js';
import { describe, it, expect } from 'vitest';
import { pbkdf2Sync, randomBytes } from 'node:crypto';
import { db } from '../db/database.js';
import { buildApp } from '../index.js';
import { usersRepo } from '../db/repos/index.js';

const LEGACY_ITERATIONS = 120_000;
const CURRENT_ITERATIONS = 600_000;

/** Insert a user whose password is a legacy 120k PBKDF2 hash. */
function createLegacyPasswordUser(email: string, password: string) {
  const salt = randomBytes(16);
  const hash = pbkdf2Sync(password, salt, LEGACY_ITERATIONS, 32, 'sha256');
  usersRepo.create({
    email,
    fullName: 'Legacy User',
    passwordHash: hash.toString('base64'),
    passwordSalt: salt.toString('base64'),
  });
  const u = usersRepo.findByEmail(email)!;
  // Ensure the stored hash really is the legacy factor (create() would have
  // hashed with the current factor if we'd passed a plain password).
  db.prepare('UPDATE users SET password_hash = ?, password_salt = ? WHERE id = ?')
    .run(hash.toString('base64'), salt.toString('base64'), u.id);
  return u;
}

/** Simulate a database created before migration 0049. */
function simulatePre0049Schema() {
  db.exec('ALTER TABLE users DROP COLUMN password_iterations');
  db.prepare('DELETE FROM schema_version WHERE version = 49').run();
}

function auditActionsFor(userId: string): string[] {
  return (db.prepare('SELECT action FROM audit_logs WHERE actor_user_id = ?').all(userId) as Array<{ action: string }>)
    .map((r) => r.action);
}

describe('Login recovery: legacy (pre-0049) databases', () => {
  it('boot-time migration heals a pre-0049 schema and login rehashes the password', async () => {
    const user = createLegacyPasswordUser('legacy-heal@demo.local', 'wedding123');
    simulatePre0049Schema();
    // Sanity: the schema is genuinely broken for the old code path.
    expect(() => usersRepo.upgradePasswordHash(user.id, 'x', 'x', CURRENT_ITERATIONS))
      .toThrow(/no such column: password_iterations/);

    // Boot the app: buildApp() must apply the pending 0049 migration.
    const app = await buildApp();
    const res = await app.inject({
      method: 'POST', url: '/api/auth/login',
      payload: { email: 'legacy-heal@demo.local', password: 'wedding123' },
      headers: { 'content-type': 'application/json' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().token).toBeTruthy();

    // Schema healed + hash upgraded to the current work factor.
    const cols = (db.prepare('PRAGMA table_info(users)').all() as Array<{ name: string }>).map((c) => c.name);
    expect(cols).toContain('password_iterations');
    expect(usersRepo.findByEmail('legacy-heal@demo.local')!.password_iterations).toBe(CURRENT_ITERATIONS);

    const actions = auditActionsFor(user.id);
    expect(actions).toContain('user.login');
    expect(actions).toContain('user.password.rehashed');
  });

  it('a failed rehash upgrade never blocks a valid login (fail open, audited)', async () => {
    const user = createLegacyPasswordUser('legacy-ro@demo.local', 'wedding123');
    const app = await buildApp(); // schema up to date → boot migration is a no-op
    // Simulate drift that cannot be healed at this instant (e.g. read-only
    // filesystem, or a schema the runner can't repair): drop the column while
    // leaving schema_version intact so boot migration skips it.
    db.exec('ALTER TABLE users DROP COLUMN password_iterations');

    const res = await app.inject({
      method: 'POST', url: '/api/auth/login',
      payload: { email: 'legacy-ro@demo.local', password: 'wedding123' },
      headers: { 'content-type': 'application/json' },
    });
    expect(res.statusCode).toBe(200); // NOT 500
    expect(res.json().token).toBeTruthy();
    expect(auditActionsFor(user.id)).toContain('user.password.rehash.failed');

    // Wrong password still fails cleanly on the drifted schema.
    const bad = await app.inject({
      method: 'POST', url: '/api/auth/login',
      payload: { email: 'legacy-ro@demo.local', password: 'wrong-password' },
      headers: { 'content-type': 'application/json' },
    });
    expect(bad.statusCode).toBe(401);

    // Restore the column so this file leaves the shared DB consistent.
    db.exec('ALTER TABLE users ADD COLUMN password_iterations INTEGER');
  });

  it('legacy-work-factor hashes verify at the route level until upgraded', async () => {
    const user = createLegacyPasswordUser('legacy-verify@demo.local', 'wedding123');
    const app = await buildApp();

    const ok = await app.inject({
      method: 'POST', url: '/api/auth/login',
      payload: { email: 'legacy-verify@demo.local', password: 'wedding123' },
      headers: { 'content-type': 'application/json' },
    });
    expect(ok.statusCode).toBe(200);
    expect(usersRepo.findByEmail('legacy-verify@demo.local')!.password_iterations).toBe(CURRENT_ITERATIONS);
    expect(auditActionsFor(user.id)).toContain('user.password.rehashed');

    const bad = await app.inject({
      method: 'POST', url: '/api/auth/login',
      payload: { email: 'legacy-verify@demo.local', password: 'nope-nope-nope' },
      headers: { 'content-type': 'application/json' },
    });
    expect(bad.statusCode).toBe(401);
  });
});
