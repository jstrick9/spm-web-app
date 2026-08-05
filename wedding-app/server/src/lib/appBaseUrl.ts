/**
 * appPublicBaseUrl — single source of truth for the public origin used to
 * build emailed magic links (RSVP, password reset, team invites, portal
 * invites).
 *
 * Order of precedence: PUBLIC_APP_URL → BASE_URL → http://localhost:5173
 * (dev fallback). In production a localhost origin means every emailed
 * link points at the wrong place — we log one loud warning (once per
 * process) so the misconfiguration is visible in the server logs instead
 * of silently shipping broken links.
 */
let warned = false;

export function appPublicBaseUrl(): string {
  const raw = (process.env.PUBLIC_APP_URL || process.env.BASE_URL || '').trim();
  if (/^https?:\/\/[^/]+/i.test(raw)) {
    const url = raw.replace(/\/+$/, '');
    if (process.env.NODE_ENV === 'production' && !warned && /localhost|127\.0\.0\.1|0\.0\.0\.0/i.test(url)) {
      warned = true;
      console.warn('[appPublicBaseUrl] WARNING: magic links will point at localhost — set BASE_URL/PUBLIC_APP_URL to the real deployment origin.');
    }
    return url;
  }
  return 'http://localhost:5173';
}
