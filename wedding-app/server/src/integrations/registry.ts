/**
 * Integration registry — the catalog of every external service the platform
 * knows how to talk to.
 *
 * Adding a new integration is:
 *   1. Implement IntegrationProvider in src/integrations/providers/<id>.ts
 *   2. Add it to PROVIDERS below
 *   3. (Optional) UI ships automatically because the Integrations admin
 *      tab reads from this registry
 *
 * Each provider declares:
 *   - kind         — connection style: oauth | api_key | smtp | webhook_only
 *   - capabilities — what THIS provider can do (send_email, poll_events, etc.)
 *   - configSchema — zod schema for the non-secret config (e.g. SMTP host)
 *   - secretSchema — zod schema for the secrets (e.g. SMTP password)
 *   - actions      — typed methods the framework calls (e.g. sendEmail)
 *   - webhookHandler — if the provider POSTs us notifications
 *   - poll         — if we should periodically sync (returns next-after timestamp)
 *
 * This file is intentionally tiny — the actual provider implementations
 * live in src/integrations/providers/*.ts. The registry is just glue.
 */
import type { IntegrationProvider } from './types.js';
import { emailSmtpProvider } from './providers/email_smtp.js';

export const PROVIDERS: ReadonlyArray<IntegrationProvider> = [
  emailSmtpProvider,
  // Calendly, Google Calendar, Outlook, Square, DocuSign, Twilio, Dropbox,
  // generic webhook — added in their respective weeks (see roadmap).
];

const _byId = new Map<string, IntegrationProvider>(PROVIDERS.map((p) => [p.id, p]));

export function getProvider(id: string): IntegrationProvider | undefined {
  return _byId.get(id);
}

export function listProviders(): IntegrationProvider[] {
  return [...PROVIDERS];
}

// Re-export the type for consumers
export type { IntegrationProvider };

// Test-only helpers. The framework's runtime treats the registry as
// immutable in production; tests may temporarily register a fake
// provider to verify the runtime's dispatch behavior.
export function _registerForTest(provider: IntegrationProvider): void {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('_registerForTest is only allowed in NODE_ENV=test');
  }
  _byId.set(provider.id, provider);
}
export function _unregisterForTest(providerId: string): void {
  if (process.env.NODE_ENV !== 'test') return;
  _byId.delete(providerId);
}
