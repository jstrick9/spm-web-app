import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

function privateAddress(address: string): boolean {
  if (isIP(address) === 4) { const [a,b] = address.split('.').map(Number); return a === 0 || a === 10 || a === 127 || a === 169 && b === 254 || a === 172 && b >= 16 && b <= 31 || a === 192 && b === 168 || a === 100 && b >= 64 && b <= 127; }
  const lower=address.toLowerCase(); return lower === '::1' || lower.startsWith('fc') || lower.startsWith('fd') || lower.startsWith('fe80');
}
/** Reject DNS targets that resolve to private/link-local ranges before delivery. */
export async function assertPublicWebhookTarget(rawUrl: string): Promise<void> {
  const host = new URL(rawUrl).hostname.replace(/^\[|\]$/g, '');
  const addresses = isIP(host) ? [{ address: host }] : await lookup(host, { all: true, verbatim: true });
  if (!addresses.length || addresses.some((entry) => privateAddress(entry.address))) throw new Error('webhook target resolves to a private address');
}
