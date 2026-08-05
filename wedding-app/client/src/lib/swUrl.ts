/**
 * Sanitize a push-notification navigation target.
 *
 * Push payloads are server-authored, but defense-in-depth: a compromised or
 * misconfigured payload must never navigate the browser to an arbitrary
 * origin (open-redirect / phishing surface). Only same-origin paths and
 * in-app hash routes are allowed; anything else falls back to the app root.
 *
 * Pure function (no `self`/worker globals) so it is unit-testable.
 */
export function sanitizeNotificationUrl(
  raw: unknown,
  origin = typeof location !== 'undefined' ? location.origin : '',
): string {
  if (typeof raw !== 'string' || !raw) return '/';
  if (raw.startsWith('#')) return raw; // in-app hash route
  try {
    const u = new URL(raw, origin || 'https://local.invalid');
    if (u.origin === origin) {
      return u.pathname + u.search + u.hash;
    }
  } catch { /* malformed URL */ }
  return '/';
}
