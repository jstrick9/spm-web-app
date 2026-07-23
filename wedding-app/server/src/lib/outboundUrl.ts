import { isIP } from 'node:net';

/**
 * Baseline SSRF guard for administrator-configured outbound webhook targets.
 * Hostnames are deliberately allowed (Zapier, Make, etc.); private and local
 * IP literals and local-only names are never valid delivery targets.
 *
 * DNS answers can change after validation, so deployments that permit
 * arbitrary untrusted webhook configuration should additionally enforce
 * egress filtering at the network layer.
 */
export function isSafeOutboundUrl(value: string): boolean {
  let url: URL;
  try { url = new URL(value); } catch { return false; }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return false;
  if (url.username || url.password) return false;

  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) return false;
  const version = isIP(host);
  if (version === 4) {
    const parts = host.split('.').map(Number);
    const [a, b] = parts;
    return !(a === 0 || a === 10 || a === 127 || a === 169 && b === 254 ||
      a === 172 && b >= 16 && b <= 31 || a === 192 && b === 168 || a === 100 && b >= 64 && b <= 127);
  }
  if (version === 6) {
    return !(host === '::1' || host.startsWith('fc') || host.startsWith('fd') || host.startsWith('fe80'));
  }
  return true;
}
