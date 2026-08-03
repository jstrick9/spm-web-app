/**
 * Password hashing & verification using PBKDF2-SHA256.
 *
 * Parameters match the original front-end's src/utils/auth.ts so password
 * records are interchangeable across stacks during any future migration.
 */
import {
  pbkdf2Sync,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from 'node:crypto';

const LEGACY_ITERATIONS = 120_000;   // hashes created before the 2026-08 hardening
const CURRENT_ITERATIONS = 600_000;  // OWASP-recommended PBKDF2-SHA256 work factor
const ITERATIONS = CURRENT_ITERATIONS;
const KEY_LENGTH  = 32;          // 256 bits
const SALT_LENGTH = 16;
const DIGEST      = 'sha256';

export interface PasswordRecord {
  passwordHash: string;          // base64
  passwordSalt: string;          // base64
  passwordAlgorithm: 'pbkdf2-sha256';
  passwordUpdatedAt: string;     // ISO
  /** Iterations used to derive this hash (stored per record). */
  iterations: number;
}

export function hashPassword(password: string): PasswordRecord {
  const saltBuf = randomBytes(SALT_LENGTH);
  const hashBuf = pbkdf2Sync(password, saltBuf, ITERATIONS, KEY_LENGTH, DIGEST);
  return {
    passwordHash: hashBuf.toString('base64'),
    passwordSalt: saltBuf.toString('base64'),
    passwordAlgorithm: 'pbkdf2-sha256',
    passwordUpdatedAt: new Date().toISOString(),
    iterations: ITERATIONS,
  };
}

export function verifyPassword(
  password: string,
  record: { passwordHash: string; passwordSalt: string; iterations?: number },
): boolean {
  const saltBuf = Buffer.from(record.passwordSalt, 'base64');
  const expected = Buffer.from(record.passwordHash, 'base64');
  if (record.iterations !== undefined) {
    // Exact work factor is known (user rows store password_iterations).
    const actual = pbkdf2Sync(password, saltBuf, record.iterations, KEY_LENGTH, DIGEST);
    if (actual.length !== expected.length) return false;
    return timingSafeEqual(actual, expected);
  }
  // No iteration count recorded (legacy user rows, portal passwords): try the
  // legacy work factor first (pre-hardening hashes), then the current factor
  // (hashes created after the hardening that simply don't persist iterations).
  const legacy = pbkdf2Sync(password, saltBuf, LEGACY_ITERATIONS, KEY_LENGTH, DIGEST);
  if (legacy.length === expected.length && timingSafeEqual(legacy, expected)) return true;
  const current = pbkdf2Sync(password, saltBuf, CURRENT_ITERATIONS, KEY_LENGTH, DIGEST);
  if (current.length !== expected.length) return false;
  return timingSafeEqual(current, expected);
}

export function needsRehash(record: { iterations?: number | null }): boolean {
  return (record.iterations ?? LEGACY_ITERATIONS) !== CURRENT_ITERATIONS;
}

export function uuid(): string {
  return randomUUID();
}

export function generateOpaqueToken(byteLength = 24): string {
  return randomBytes(byteLength).toString('base64url');
}

/** Hash an opaque token (e.g. guest portal token) for storage. */
export function hashToken(token: string): { hash: string; salt: string } {
  const salt = randomBytes(SALT_LENGTH);
  const hash = pbkdf2Sync(token, salt, 10_000, KEY_LENGTH, DIGEST);
  return {
    hash: hash.toString('base64'),
    salt: salt.toString('base64'),
  };
}

export function verifyToken(token: string, record: { hash: string; salt: string }): boolean {
  const salt = Buffer.from(record.salt, 'base64');
  const expected = Buffer.from(record.hash, 'base64');
  const actual = pbkdf2Sync(token, salt, 10_000, KEY_LENGTH, DIGEST);
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}
