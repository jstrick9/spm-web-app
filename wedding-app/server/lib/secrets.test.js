import { beforeEach, describe, expect, it } from 'vitest';
import { canDecrypt, getMasterKey, openSecret, sealSecret, _resetMasterKey } from './secrets.js';
beforeEach(() => {
    _resetMasterKey();
    delete process.env.WEDDING_SECRETS_KEY;
    process.env.NODE_ENV = 'test'; // triggers deterministic test key
});
describe('secrets', () => {
    it('round-trips a JSON value', () => {
        const original = { accessToken: 'xyz', refreshToken: 'abc', expiresAt: 1234 };
        const sealed = sealSecret(original);
        expect(typeof sealed).toBe('string');
        expect(sealed).not.toContain('xyz'); // ciphertext is opaque
        expect(openSecret(sealed)).toEqual(original);
    });
    it('produces a different ciphertext each time (random IV)', () => {
        const v = { same: 'value' };
        const a = sealSecret(v);
        const b = sealSecret(v);
        expect(a).not.toBe(b);
        expect(openSecret(a)).toEqual(openSecret(b));
    });
    it('rejects a tampered ciphertext', () => {
        const sealed = sealSecret({ x: 1 });
        // Flip the last byte (part of the ciphertext)
        const buf = Buffer.from(sealed, 'base64');
        buf[buf.length - 1] ^= 0xff;
        const corrupted = buf.toString('base64');
        expect(() => openSecret(corrupted)).toThrow();
    });
    it('rejects a wrong master key', () => {
        const sealed = sealSecret({ x: 1 });
        process.env.WEDDING_SECRETS_KEY = 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
        _resetMasterKey();
        expect(() => openSecret(sealed)).toThrow();
    });
    it('canDecrypt returns false for corrupted data, true for valid', () => {
        const ok = sealSecret('hello');
        expect(canDecrypt(ok)).toBe(true);
        expect(canDecrypt('not even base64!')).toBe(false);
    });
    it('throws a clear error when key is missing in production', () => {
        delete process.env.WEDDING_SECRETS_KEY;
        process.env.NODE_ENV = 'production';
        _resetMasterKey();
        expect(() => getMasterKey()).toThrow(/WEDDING_SECRETS_KEY/);
        process.env.NODE_ENV = 'test';
    });
    it('accepts hex and base64 key formats', () => {
        // 32 bytes hex
        process.env.WEDDING_SECRETS_KEY = '00'.repeat(32);
        _resetMasterKey();
        expect(getMasterKey().length).toBe(32);
        // 32 bytes base64
        process.env.WEDDING_SECRETS_KEY = Buffer.alloc(32, 1).toString('base64');
        _resetMasterKey();
        expect(getMasterKey().length).toBe(32);
    });
    it('rejects a wrong-length key', () => {
        process.env.WEDDING_SECRETS_KEY = 'abc';
        _resetMasterKey();
        expect(() => getMasterKey()).toThrow(/32 bytes/);
    });
});
//# sourceMappingURL=secrets.test.js.map