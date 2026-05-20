/**
 * Password hashing & verification using PBKDF2-SHA256.
 *
 * Intentionally matches the parameters used by the front-end's
 * src/utils/auth.ts (120 000 iterations, 16-byte salt, 256-bit derived key)
 * so the same hashes are valid across both stacks during migration.
 */
import {
  pbkdf2Sync,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from 'node:crypto';

const ITERATIONS  = 120_000;
const KEY_LENGTH  = 32;          // 256 bits
const SALT_LENGTH = 16;
const DIGEST      = 'sha256';

export interface PasswordRecord {
  passwordHash: string;          // base64
  passwordSalt: string;          // base64
  passwordAlgorithm: 'pbkdf2-sha256';
  passwordUpdatedAt: string;     // ISO
}

export function hashPassword(password: string): PasswordRecord {
  const saltBuf = randomBytes(SALT_LENGTH);
  const hashBuf = pbkdf2Sync(password, saltBuf, ITERATIONS, KEY_LENGTH, DIGEST);
  return {
    passwordHash: hashBuf.toString('base64'),
    passwordSalt: saltBuf.toString('base64'),
    passwordAlgorithm: 'pbkdf2-sha256',
    passwordUpdatedAt: new Date().toISOString(),
  };
}

export function verifyPassword(
  password: string,
  record: { passwordHash: string; passwordSalt: string },
): boolean {
  const saltBuf = Buffer.from(record.passwordSalt, 'base64');
  const expected = Buffer.from(record.passwordHash, 'base64');
  const actual = pbkdf2Sync(password, saltBuf, ITERATIONS, KEY_LENGTH, DIGEST);
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

/** UUID v4. Use everywhere we need an id (mirrors Postgres `gen_random_uuid()`). */
export function uuid(): string {
  return randomUUID();
}

/** Opaque random token for guest portal links — URL-safe base64. */
export function generateGuestToken(): string {
  return randomBytes(24).toString('base64url');
}
