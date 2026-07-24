import { generateOpaqueToken, hashToken, verifyToken } from './crypto.js';

/** Shared primitives for opaque external-access capabilities. Plaintext values
 * are returned only at issuance; persistence layers store hash/salt pairs. */
export function issueCapabilitySecret() {
  const token = generateOpaqueToken(32);
  const { hash, salt } = hashToken(token);
  return { token, hash, salt };
}
export function verifyCapabilitySecret(token: string, record: { token_hash: string; token_salt: string }): boolean {
  return verifyToken(token, { hash: record.token_hash, salt: record.token_salt });
}
export function expiresAtFromNow(ttlMs: number): string { return new Date(Date.now() + ttlMs).toISOString(); }
/** Never place a capability secret in logs, audits, exports, or error text. */
export function redactCapability(_token: string | null | undefined): string | null { return _token ? '[REDACTED]' : null; }
