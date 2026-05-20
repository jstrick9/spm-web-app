import type { User } from '../types';
import { STORAGE_KEYS } from '../constants/storageKeys';

const SESSION_STORAGE_KEY = STORAGE_KEYS.SESSION_V2;
const LEGACY_SESSION_STORAGE_KEY = STORAGE_KEYS.SESSION_LEGACY;
const PASSWORD_ITERATIONS = 120000;
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const GUEST_SESSION_TTL_MS = 2 * 60 * 60 * 1000;
const MAX_FAILED_LOGINS = 5;
const LOGIN_LOCK_MS = 30 * 1000;
export const MAX_RESET_ATTEMPTS = 5;

export interface StoredSession {
  v: 2;
  userId: string;
  issuedAt: string;
  expiresAt: string;
  isGuest: boolean;
  sessionVersion: number;
}

export type AuthUser = User & {
  password?: string;
  passwordHash?: string;
  passwordSalt?: string;
  passwordAlgorithm?: 'pbkdf2-sha256';
  passwordUpdatedAt?: string;
  sessionVersion?: number;
  failedLoginCount?: number;
  lockedUntil?: string;
  userStatus?: 'invited' | 'pending' | 'active' | 'suspended' | 'disabled';
};

function getCrypto(): Crypto {
  if (!globalThis.crypto || !globalThis.crypto.subtle) {
    throw new Error('Web Crypto API is not available in this environment.');
  }

  return globalThis.crypto;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;

  let result = 0;
  for (let i = 0; i < a.length; i += 1) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}

async function deriveHash(secret: string, saltBase64: string): Promise<string> {
  const cryptoApi = getCrypto();
  const encoder = new TextEncoder();

  const keyMaterial = await cryptoApi.subtle.importKey(
    'raw',
    encoder.encode(secret) as BufferSource,
    'PBKDF2',
    false,
    ['deriveBits'],
  );

  const derivedBits = await cryptoApi.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: base64ToBytes(saltBase64) as BufferSource,
      iterations: PASSWORD_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    256,
  );

  return bytesToBase64(new Uint8Array(derivedBits));
}

function parseLegacySession(): StoredSession | null {
  const raw = localStorage.getItem(LEGACY_SESSION_STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as {
      userId?: string;
      expiry?: number;
      isGuest?: boolean;
    };

    if (!parsed.userId || typeof parsed.expiry !== 'number') {
      return null;
    }

    if (parsed.expiry <= Date.now()) {
      return null;
    }

    return {
      v: 2,
      userId: parsed.userId,
      issuedAt: new Date().toISOString(),
      expiresAt: new Date(parsed.expiry).toISOString(),
      isGuest: Boolean(parsed.isGuest),
      sessionVersion: 1,
    };
  } catch {
    return null;
  }
}

export async function createPasswordRecord(
  password: string,
): Promise<
  Pick<
    AuthUser,
    'passwordHash' | 'passwordSalt' | 'passwordAlgorithm' | 'passwordUpdatedAt'
  >
> {
  const cryptoApi = getCrypto();
  const salt = cryptoApi.getRandomValues(new Uint8Array(16));
  const passwordSalt = bytesToBase64(salt);
  const passwordHash = await deriveHash(password, passwordSalt);

  return {
    passwordHash,
    passwordSalt,
    passwordAlgorithm: 'pbkdf2-sha256',
    passwordUpdatedAt: new Date().toISOString(),
  };
}

export async function verifyPassword(
  user: AuthUser,
  password: string,
): Promise<boolean> {
  if (user.passwordHash && user.passwordSalt) {
    const derived = await deriveHash(password, user.passwordSalt);
    return timingSafeEqual(derived, user.passwordHash);
  }

  // Legacy plaintext fallback - log warning and migrate
  if (user.password && user.password === password) {
    console.warn(
      `[SECURITY] User "${user.username}" authenticated with legacy plaintext password. ` +
      `Password will be migrated to hashed format immediately after successful login when using local auth.`
    );
    return true;
  }

  return false;
}

export function needsPasswordMigration(user: AuthUser): boolean {
  return Boolean(user.password) && !user.passwordHash;
}

export function canUserAuthenticate(user: AuthUser): boolean {
  if (user.isActive === false) return false;
  if (user.userStatus === 'suspended' || user.userStatus === 'disabled') {
    return false;
  }
  return true;
}

export function isUserLocked(user: AuthUser): boolean {
  return Boolean(user.lockedUntil && new Date(user.lockedUntil).getTime() > Date.now());
}

export function createSession(user: AuthUser, isGuest = false): StoredSession {
  const now = Date.now();

  return {
    v: 2,
    userId: user.id,
    issuedAt: new Date(now).toISOString(),
    expiresAt: new Date(
      now + (isGuest ? GUEST_SESSION_TTL_MS : SESSION_TTL_MS),
    ).toISOString(),
    isGuest,
    sessionVersion: user.sessionVersion ?? 1,
  };
}

export function saveSession(session: StoredSession): void {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  localStorage.removeItem(LEGACY_SESSION_STORAGE_KEY);
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_STORAGE_KEY);
  localStorage.removeItem(LEGACY_SESSION_STORAGE_KEY);
}

export function loadSession(): StoredSession | null {
  const raw = localStorage.getItem(SESSION_STORAGE_KEY);

  if (raw) {
    try {
      const parsed = JSON.parse(raw) as StoredSession;
      if (!parsed?.userId || !parsed?.expiresAt) return null;
      if (new Date(parsed.expiresAt).getTime() <= Date.now()) return null;
      return parsed;
    } catch {
      return null;
    }
  }

  return parseLegacySession();
}

export function isSessionValidForUser(
  session: StoredSession,
  user: AuthUser,
): boolean {
  if (session.userId !== user.id) return false;
  if (new Date(session.expiresAt).getTime() <= Date.now()) return false;
  if ((user.sessionVersion ?? 1) !== session.sessionVersion) return false;
  if (!canUserAuthenticate(user)) return false;
  return true;
}

export async function createSecretRecord(
  secret: string,
): Promise<{ hash: string; salt: string }> {
  const cryptoApi = getCrypto();
  const salt = cryptoApi.getRandomValues(new Uint8Array(16));
  const saltBase64 = bytesToBase64(salt);
  const hash = await deriveHash(secret, saltBase64);

  return { hash, salt: saltBase64 };
}

export async function verifySecret(
  secret: string,
  record: { hash: string; salt: string },
): Promise<boolean> {
  const derived = await deriveHash(secret, record.salt);
  return timingSafeEqual(derived, record.hash);
}

export function recordFailedLogin(user: AuthUser): AuthUser {
  const nextFailedCount = (user.failedLoginCount ?? 0) + 1;

  return {
    ...user,
    failedLoginCount: nextFailedCount,
    lockedUntil:
      nextFailedCount >= MAX_FAILED_LOGINS
        ? new Date(Date.now() + LOGIN_LOCK_MS).toISOString()
        : user.lockedUntil,
    updatedAt: new Date().toISOString(),
  };
}

export function clearFailedLoginState(user: AuthUser): AuthUser {
  return {
    ...user,
    failedLoginCount: 0,
    lockedUntil: undefined,
    lastLogin: new Date().toISOString(),
    loginCount: (user.loginCount ?? 0) + 1,
    updatedAt: new Date().toISOString(),
  };
}