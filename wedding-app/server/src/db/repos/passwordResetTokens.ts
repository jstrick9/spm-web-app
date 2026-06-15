import { db } from '../database.js';
import { generateOpaqueToken, hashToken, uuid, verifyToken } from '../../lib/crypto.js';

export interface PasswordResetTokenRow {
  id: string;
  user_id: string;
  token_hash: string;
  token_salt: string;
  expires_at: string;
  used_at: string | null;
  created_at: string;
}

export const passwordResetTokensRepo = {
  create(userId: string, ttlMs = 60 * 60 * 1000): { token: string; expiresAt: string; row: PasswordResetTokenRow } {
    const id = uuid();
    const secret = generateOpaqueToken(32);
    const token = `${id}.${secret}`;
    const hashed = hashToken(secret);
    const expiresAt = new Date(Date.now() + ttlMs).toISOString();

    const tx = db.transaction(() => {
      // Only one currently usable reset token per user. Older reset links stop
      // working as soon as a newer one is requested.
      db.prepare(
        `UPDATE password_reset_tokens
         SET used_at = datetime('now')
         WHERE user_id = ? AND used_at IS NULL AND expires_at > datetime('now')`
      ).run(userId);
      db.prepare(
        `INSERT INTO password_reset_tokens (id, user_id, token_hash, token_salt, expires_at)
         VALUES (?, ?, ?, ?, ?)`
      ).run(id, userId, hashed.hash, hashed.salt, expiresAt);
    });
    tx();

    return { token, expiresAt, row: this.findById(id)! };
  },

  findById(id: string): PasswordResetTokenRow | undefined {
    return db.prepare(`SELECT * FROM password_reset_tokens WHERE id = ?`).get(id) as PasswordResetTokenRow | undefined;
  },

  findValidByToken(token: string): PasswordResetTokenRow | undefined {
    const [id, secret] = token.split('.', 2);
    if (!id || !secret) return undefined;
    const row = db.prepare(
      `SELECT * FROM password_reset_tokens
       WHERE id = ? AND used_at IS NULL AND expires_at > datetime('now')`
    ).get(id) as PasswordResetTokenRow | undefined;
    if (!row) return undefined;
    return verifyToken(secret, { hash: row.token_hash, salt: row.token_salt }) ? row : undefined;
  },

  markUsed(id: string): void {
    db.prepare(`UPDATE password_reset_tokens SET used_at = datetime('now') WHERE id = ?`).run(id);
  },
};
