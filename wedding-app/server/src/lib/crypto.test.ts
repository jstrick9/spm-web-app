import './../test/setup.js';
import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword, hashToken, verifyToken, generateOpaqueToken, uuid } from './crypto.js';

describe('crypto', () => {
  it('hashPassword + verifyPassword round-trip', () => {
    const rec = hashPassword('correct horse battery staple');
    expect(rec.passwordHash).toBeTruthy();
    expect(rec.passwordSalt).toBeTruthy();
    expect(verifyPassword('correct horse battery staple', rec)).toBe(true);
    expect(verifyPassword('wrong', rec)).toBe(false);
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
