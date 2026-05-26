/**
 * Secrets encryption — for integration credentials (OAuth tokens, API keys,
 * SMTP passwords) before they hit the database.
 *
 * Cipher:    AES-256-GCM (authenticated encryption, no padding oracle)
 * Key:       32-byte master key from $WEDDING_SECRETS_KEY (hex or base64)
 * IV:        12-byte random per-message
 * Tag:       16-byte GCM auth tag
 * Wire:      base64(version | iv | ciphertext | tag)
 *
 * Why AES-GCM not libsodium?
 *   - libsodium is a ~600KB native dep; AES-GCM is built into Node's crypto
 *     module with no compile step
 *   - AES-256-GCM with a random IV is exactly as secure as XChaCha20-Poly1305
 *     for our threat model (single-tenant master key, low-cardinality writes)
 *   - One less native dependency = simpler Docker image, easier Windows install
 *
 * Threat model:
 *   - Protects against: DB file dump, dev grabbing a backup, malicious read
 *     access to disk
 *   - Does NOT protect against: an attacker who gets BOTH the DB file AND
 *     the master key (e.g. full server compromise). For that you'd need an
 *     HSM, which is overkill for self-hosted single-tenant.
 *
 * Master key management:
 *   - Set WEDDING_SECRETS_KEY in your .env file (64 hex chars or 44 base64 chars)
 *   - Generate with: openssl rand -hex 32
 *   - If you rotate the master key, run scripts/rotate-secrets.sh (re-encrypts
 *     every existing secret_payload). The schema_version doesn't need to bump.
 *   - LOSING THE KEY = losing every integration credential. Same as losing
 *     a database backup encryption key. Back it up the same way.
 */
import {
  createCipheriv, createDecipheriv, randomBytes,
} from 'node:crypto';

const ALG = 'aes-256-gcm';
const VERSION = 1;             // bump only if cipher changes
const KEY_LEN = 32;            // 256 bits
const IV_LEN  = 12;            // GCM standard
const TAG_LEN = 16;            // GCM auth tag

let cachedKey: Buffer | null = null;

function parseKey(raw: string): Buffer {
  // Accept hex or base64 (length disambiguates)
  if (/^[0-9a-fA-F]+$/.test(raw) && raw.length === 64) {
    return Buffer.from(raw, 'hex');
  }
  // Base64 (44 chars padded, 43 unpadded for 32 bytes)
  if (/^[A-Za-z0-9+/=_-]+$/.test(raw)) {
    const buf = Buffer.from(raw.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
    if (buf.length === KEY_LEN) return buf;
  }
  throw new Error(
    `WEDDING_SECRETS_KEY must be 32 bytes (64 hex chars or 44 base64 chars). ` +
    `Generate one with: openssl rand -hex 32`
  );
}

/**
 * Returns the master key (cached). Throws if WEDDING_SECRETS_KEY is unset.
 * In NODE_ENV=test, we auto-generate a deterministic key so tests run
 * without env setup.
 */
export function getMasterKey(): Buffer {
  if (cachedKey) return cachedKey;
  let raw = process.env.WEDDING_SECRETS_KEY;
  if (!raw) {
    if (process.env.NODE_ENV === 'test') {
      // Deterministic per-process test key (not for production)
      raw = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    } else {
      throw new Error(
        'WEDDING_SECRETS_KEY is not set. Generate one with `openssl rand -hex 32` ' +
        'and add WEDDING_SECRETS_KEY=… to your .env file before starting the server.'
      );
    }
  }
  cachedKey = parseKey(raw);
  return cachedKey;
}

/** For tests: clear the cache so changes to env are picked up. */
export function _resetMasterKey(): void {
  cachedKey = null;
}

/**
 * Encrypt a JSON-serializable value into an opaque base64 string suitable
 * for storage in `secret_payload`.
 *
 *   const payload = sealSecret({ accessToken: 'xyz', refreshToken: 'abc' });
 *   db.run(`UPDATE integrations SET secret_payload = ? WHERE id = ?`, payload, id);
 */
export function sealSecret(value: unknown): string {
  const key = getMasterKey();
  const iv = randomBytes(IV_LEN);
  const plaintext = Buffer.from(JSON.stringify(value), 'utf8');
  const cipher = createCipheriv(ALG, key, iv);
  const enc = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Format: [version(1)] | [iv(12)] | [tag(16)] | [ciphertext]
  return Buffer.concat([Buffer.from([VERSION]), iv, tag, enc]).toString('base64');
}

/**
 * Decrypt a previously-sealed secret. Throws if:
 *   - the master key is wrong (tampered or rotated without re-encryption)
 *   - the ciphertext was modified (GCM auth tag mismatch)
 *   - the format version isn't recognized
 */
export function openSecret<T = unknown>(sealed: string): T {
  const key = getMasterKey();
  const buf = Buffer.from(sealed, 'base64');
  if (buf.length < 1 + IV_LEN + TAG_LEN) {
    throw new Error('sealed secret is malformed');
  }
  const version = buf[0];
  if (version !== VERSION) {
    throw new Error(`unsupported sealed-secret version ${version}`);
  }
  const iv = buf.subarray(1, 1 + IV_LEN);
  const tag = buf.subarray(1 + IV_LEN, 1 + IV_LEN + TAG_LEN);
  const enc = buf.subarray(1 + IV_LEN + TAG_LEN);
  const decipher = createDecipheriv(ALG, key, iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(enc), decipher.final()]);
  return JSON.parse(dec.toString('utf8')) as T;
}

/**
 * Verify a sealed secret round-trips without exposing its value.
 * Useful in health checks and key-rotation pre-flight.
 */
export function canDecrypt(sealed: string): boolean {
  try { openSecret(sealed); return true; } catch { return false; }
}
