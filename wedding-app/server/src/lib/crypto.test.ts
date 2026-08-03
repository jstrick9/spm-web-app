import './../test/setup.js';
import { describe, it, expect } from 'vitest';
import { pbkdf2Sync } from 'node:crypto';
import { hashPassword, verifyPassword, needsRehash, hashToken, verifyToken, generateOpaqueToken, uuid } from './crypto.js';

describe('crypto', () => {
  it('hashPassword + verifyPassword round-trip', () => {
    const rec = hashPassword('correct horse battery staple');
    expect(rec.passwordHash).toBeTruthy();
    expect(rec.passwordSalt).toBeTruthy();
    expect(verifyPassword('correct horse battery staple', rec)).toBe(true);
    expect(verifyPassword('wrong', rec)).toBe(false);
  });

  it('uses the current OWASP-recommended PBKDF2 work factor', () => {
    const rec = hashPassword('workfactor');
    expect(rec.iterations).toBe(600_000);
    expect(needsRehash(rec)).toBe(false);
  });

  it('verifies current-factor hashes even when no iterations are recorded', () => {
    // Portal passwords etc. store only hash+salt; verification must still
    // succeed for hashes created at the current work factor.
    const rec = hashPassword('portal-password');
    expect(verifyPassword('portal-password', { passwordHash: rec.passwordHash, passwordSalt: rec.passwordSalt })).toBe(true);
    expect(verifyPassword('wrong', { passwordHash: rec.passwordHash, passwordSalt: rec.passwordSalt })).toBe(false);
  });

  it('verifies legacy 120k-iteration hashes and flags them for rehash', () => {
    // Simulate a pre-hardening record: derived with the legacy work factor
    // and no stored iteration count (NULL in the DB).
    const salt = Buffer.from('QUJDREVGR0hJSktMTU5PUA==', 'base64');
    const legacyHash = pbkdf2Sync('legacy-password', salt, 120_000, 32, 'sha256').toString('base64');
    expect(verifyPassword('legacy-password', { passwordHash: legacyHash, passwordSalt: salt.toString('base64') })).toBe(true);
    expect(verifyPassword('wrong', { passwordHash: legacyHash, passwordSalt: salt.toString('base64') })).toBe(false);
    expect(needsRehash({ iterations: null })).toBe(true);
    expect(needsRehash({ iterations: 120_000 })).toBe(true);
  });

  it('hashPassword produces different salt+hash each time', () => {
    const a = hashPassword('same');
    const b = hashPassword('same');
    expect(a.passwordSalt).not.toBe(b.passwordSalt);
    expect(a.passwordHash).not.toBe(b.passwordHash);
  });

  it('hashToken + verifyToken round-trip', () => {
    const token = generateOpaqueToken();
    const rec = hashToken(token);
    expect(verifyToken(token, rec)).toBe(true);
    expect(verifyToken('other', rec)).toBe(false);
  });

  it('uuid produces valid v4 strings', () => {
    const u = uuid();
    expect(u).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('generateOpaqueToken default is 24 bytes (32 char base64url)', () => {
    expect(generateOpaqueToken().length).toBe(32);
  });
});
