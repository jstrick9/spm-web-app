import { beforeEach, describe, expect, it } from 'vitest';
import type { User } from '../types';
import {
  canUserAuthenticate,
  clearFailedLoginState,
  clearSession,
  createPasswordRecord,
  createSecretRecord,
  createSession,
  isSessionValidForUser,
  isUserLocked,
  loadSession,
  needsPasswordMigration,
  recordFailedLogin,
  saveSession,
  verifyPassword,
  verifySecret,
} from './auth';

function createUser(overrides: Partial<User> = {}): User {
  return {
    id: 'u1',
    username: 'jane',
    password: '',
    role: 'basic',
    name: 'Jane Doe',
    isActive: true,
    createdAt: new Date().toISOString(),
    ...overrides,
  } as User;
}

describe('auth utils', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('creates and verifies hashed passwords', async () => {
    const record = await createPasswordRecord('Secret123!');
    const user = createUser(record as Partial<User>);

    await expect(verifyPassword(user as any, 'Secret123!')).resolves.toBe(true);
    await expect(verifyPassword(user as any, 'wrong-password')).resolves.toBe(false);
  });

  it('supports legacy plaintext password verification', async () => {
    const user = createUser({ password: 'legacy-pass' });

    await expect(verifyPassword(user as any, 'legacy-pass')).resolves.toBe(true);
    await expect(verifyPassword(user as any, 'wrong')).resolves.toBe(false);
  });

  it('detects when a legacy password needs migration', () => {
    expect(needsPasswordMigration(createUser({ password: 'legacy-pass' }) as any)).toBe(
      true,
    );
    expect(
      needsPasswordMigration(
        createUser({
          password: '',
          ...({
            passwordHash: 'hash',
            passwordSalt: 'salt',
          } as Partial<User>),
        }) as any,
      ),
    ).toBe(false);
  });

  it('blocks suspended, disabled, and inactive users', () => {
    expect(canUserAuthenticate(createUser() as any)).toBe(true);
    expect(canUserAuthenticate(createUser({ isActive: false }) as any)).toBe(false);
    expect(
      canUserAuthenticate(
        createUser({ ...( { userStatus: 'suspended' } as Partial<User>) }) as any,
      ),
    ).toBe(false);
    expect(
      canUserAuthenticate(
        createUser({ ...( { userStatus: 'disabled' } as Partial<User>) }) as any,
      ),
    ).toBe(false);
  });

  it('detects active lockouts', () => {
    expect(isUserLocked(createUser() as any)).toBe(false);
    expect(
      isUserLocked(
        createUser({
          ...( {
            lockedUntil: new Date(Date.now() + 60_000).toISOString(),
          } as Partial<User>),
        }) as any,
      ),
    ).toBe(true);
  });

  it('validates sessions against expiry and sessionVersion', () => {
    const user = createUser({
      ...( { sessionVersion: 2 } as Partial<User>),
    }) as any;

    const validSession = createSession(user, false);

    expect(isSessionValidForUser(validSession, user)).toBe(true);

    expect(
      isSessionValidForUser({ ...validSession, sessionVersion: 1 }, user),
    ).toBe(false);

    expect(
      isSessionValidForUser(
        {
          ...validSession,
          expiresAt: new Date(Date.now() - 1000).toISOString(),
        },
        user,
      ),
    ).toBe(false);
  });

  it('creates and verifies generic secrets', async () => {
    const record = await createSecretRecord('654321');

    await expect(verifySecret('654321', record)).resolves.toBe(true);
    await expect(verifySecret('123456', record)).resolves.toBe(false);
  });

  it('records and clears failed login state', () => {
    const base = createUser() as any;
    const failed = recordFailedLogin(base);

    expect(failed.failedLoginCount).toBe(1);

    const cleared = clearFailedLoginState(failed);
    expect(cleared.failedLoginCount).toBe(0);
    expect(cleared.lockedUntil).toBeUndefined();
    expect(cleared.loginCount).toBe(1);
  });

  it('saves and loads v2 sessions', () => {
    const session = createSession(createUser() as any, false);
    saveSession(session);

    const loaded = loadSession();
    expect(loaded).not.toBeNull();
    expect(loaded?.v).toBe(2);
    expect(loaded?.userId).toBe('u1');
  });

  it('loads legacy sessions when v2 session is absent', () => {
    localStorage.setItem(
      'spm_session',
      JSON.stringify({
        userId: 'legacy-user',
        expiry: Date.now() + 60_000,
        isGuest: false,
      }),
    );

    const loaded = loadSession();
    expect(loaded).not.toBeNull();
    expect(loaded?.v).toBe(2);
    expect(loaded?.userId).toBe('legacy-user');
  });

  it('clears both legacy and v2 session keys', () => {
    localStorage.setItem(
      'spm_session',
      JSON.stringify({
        userId: 'legacy-user',
        expiry: Date.now() + 60_000,
        isGuest: false,
      }),
    );
    saveSession(createSession(createUser() as any, false));

    clearSession();

    expect(localStorage.getItem('spm_session')).toBeNull();
    expect(localStorage.getItem('spm_session_v2')).toBeNull();
  });
});