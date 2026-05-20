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
