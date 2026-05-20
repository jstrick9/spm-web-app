import { db } from '../database.js';
import { uuid } from '../../lib/crypto.js';
export const usersRepo = {
    findByEmail(email) {
        return db
            .prepare(`SELECT * FROM users WHERE email = ? COLLATE NOCASE`)
            .get(email);
    },
    findById(id) {
        return db.prepare(`SELECT * FROM users WHERE id = ?`).get(id);
    },
    create(input) {
        const id = uuid();
        db.prepare(`INSERT INTO users (id, email, full_name, password_hash, password_salt)
       VALUES (?, ?, ?, ?, ?)`).run(id, input.email, input.fullName, input.passwordHash, input.passwordSalt);
        return this.findById(id);
    },
    recordFailedLogin(userId, lockMs = 30_000, maxFailures = 5) {
        const u = this.findById(userId);
        if (!u)
            return;
        const next = u.failed_login_count + 1;
        const lockedUntil = next >= maxFailures
            ? new Date(Date.now() + lockMs).toISOString()
            : u.locked_until;
        db.prepare(`UPDATE users SET failed_login_count = ?, locked_until = ?, updated_at = datetime('now')
       WHERE id = ?`).run(next, lockedUntil, userId);
    },
    clearFailedLogin(userId) {
        db.prepare(`UPDATE users SET failed_login_count = 0, locked_until = NULL, updated_at = datetime('now')
       WHERE id = ?`).run(userId);
    },
    isLocked(user) {
        return Boolean(user.locked_until && new Date(user.locked_until).getTime() > Date.now());
    },
    updateProfile(userId, patch) {
        const fields = [];
        const values = [];
        if (patch.fullName !== undefined) {
            fields.push('full_name = ?');
            values.push(patch.fullName);
        }
        if (patch.phone !== undefined) {
            fields.push('phone = ?');
            values.push(patch.phone);
        }
        if (patch.avatarPath !== undefined) {
            fields.push('avatar_path = ?');
            values.push(patch.avatarPath);
        }
        if (fields.length === 0)
            return;
        values.push(userId);
        db.prepare(`UPDATE users SET ${fields.join(', ')}, updated_at = datetime('now') WHERE id = ?`).run(...values);
    },
    /** Bump session version → invalidates all existing JWTs for this user. */
    invalidateSessions(userId) {
        db.prepare(`UPDATE users SET session_version = session_version + 1, updated_at = datetime('now') WHERE id = ?`).run(userId);
    },
};
//# sourceMappingURL=users.js.map