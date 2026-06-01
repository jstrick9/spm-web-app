import { db } from '../database.js';
import { uuid } from '../../lib/crypto.js';

export interface UserRow {
  id: string;
  email: string;
  full_name: string;
  password_hash: string;
  password_salt: string;
  session_version: number;
  status: 'invited' | 'active' | 'suspended' | 'disabled';
  failed_login_count: number;
  locked_until: string | null;
  avatar_path: string | null;
  phone: string | null;
  created_at: string;
}

export const usersRepo = {
  findByEmail(email: string): UserRow | undefined {
    return db
      .prepare(`SELECT * FROM users WHERE email = ? COLLATE NOCASE`)
      .get(email) as UserRow | undefined;
  },

  findById(id: string): UserRow | undefined {
    return db.prepare(`SELECT * FROM users WHERE id = ?`).get(id) as
      | UserRow
      | undefined;
  },

  create(input: {
    email: string;
    fullName: string;
    passwordHash: string;
    passwordSalt: string;
  }): UserRow {
    const id = uuid();
    db.prepare(
      `INSERT INTO users (id, email, full_name, password_hash, password_salt)
       VALUES (?, ?, ?, ?, ?)`
    ).run(id, input.email, input.fullName, input.passwordHash, input.passwordSalt);
    return this.findById(id)!;
  },

  recordFailedLogin(userId: string, lockMs = 30_000, maxFailures = 5): void {
    const u = this.findById(userId);
    if (!u) return;
    const next = u.failed_login_count + 1;
    const lockedUntil = next >= maxFailures
      ? new Date(Date.now() + lockMs).toISOString()
      : u.locked_until;
    db.prepare(
      `UPDATE users SET failed_login_count = ?, locked_until = ?, updated_at = datetime('now')
       WHERE id = ?`
    ).run(next, lockedUntil, userId);
  },

  clearFailedLogin(userId: string): void {
    db.prepare(
      `UPDATE users SET failed_login_count = 0, locked_until = NULL, updated_at = datetime('now')
       WHERE id = ?`
    ).run(userId);
  },

  isLocked(user: UserRow): boolean {
    return Boolean(user.locked_until && new Date(user.locked_until).getTime() > Date.now());
  },

  updateProfile(userId: string, patch: { fullName?: string; phone?: string; avatarPath?: string | null }) {
    const fields: string[] = [];
    const values: unknown[] = [];
    if (patch.fullName  !== undefined) { fields.push('full_name = ?');   values.push(patch.fullName); }
    if (patch.phone     !== undefined) { fields.push('phone = ?');       values.push(patch.phone); }
    if (patch.avatarPath!== undefined) { fields.push('avatar_path = ?'); values.push(patch.avatarPath); }
    if (fields.length === 0) return;
    values.push(userId);
    db.prepare(
      `UPDATE users SET ${fields.join(', ')}, updated_at = datetime('now') WHERE id = ?`
    ).run(...values);
  },

  /** Change password — hashes + stores + bumps session version. */
  changePassword(userId: string, newHash: string, newSalt: string): void {
    db.prepare(
      `UPDATE users SET password_hash = ?, password_salt = ?,
       password_updated_at = datetime('now'), session_version = session_version + 1,
       updated_at = datetime('now') WHERE id = ?`
    ).run(newHash, newSalt, userId);
  },

  /** Bump session version → invalidates all existing JWTs for this user. */
  invalidateSessions(userId: string): void {
    db.prepare(
      `UPDATE users SET session_version = session_version + 1, updated_at = datetime('now') WHERE id = ?`
    ).run(userId);
  },
};
