/**
 * Stateless signed proof for the guest-portal password gate.
 *
 * The venue can require a password for the guest portal ("Require a
 * password" in the Portal settings). `verify-password` used to succeed but
 * nothing enforced the password anywhere — the portal info payload exposed
 * requiresPassword but returned full guest data regardless, so the toggle
 * was a false sense of security.
 *
 * On successful password verification the server issues a short-lived,
 * single-purpose HMAC proof (`<eventId>.<expiryEpochMs>.<signature>`).
 * Public portal endpoints accept it via ?pw=; the info route refuses the
 * guest payload without it.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

const PROOF_TTL_MS = 30 * 60 * 1000; // 30 minutes, refreshed on each unlock

function secret(): string {
  return process.env.JWT_SECRET ?? 'dev-secret-change-me-in-production';
}

function sign(payload: string): string {
  return createHmac('sha256', secret()).update(payload).digest('base64url');
}

export function issuePortalPasswordProof(eventId: string): string {
  const expiry = Date.now() + PROOF_TTL_MS;
  const payload = `${eventId}.${expiry}`;
  return `${payload}.${sign(payload)}`;
}

export function validPortalPasswordProof(token: string | undefined | null, eventId: string): boolean {
  if (!token) return false;
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  const [tokEvent, expiryStr, sig] = parts as [string, string, string];
  if (tokEvent !== eventId) return false;
  const expiry = Number(expiryStr);
  if (!Number.isFinite(expiry) || Date.now() > expiry) return false;
  const expected = sign(`${tokEvent}.${expiryStr}`);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
