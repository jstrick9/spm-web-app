import { emailSmtpProvider } from './providers/email_smtp.js';
export const PROVIDERS = [
    emailSmtpProvider,
    // Calendly, Google Calendar, Outlook, Square, DocuSign, Twilio, Dropbox,
    // generic webhook — added in their respective weeks (see roadmap).
];
const _byId = new Map(PROVIDERS.map((p) => [p.id, p]));
export function getProvider(id) {
    return _byId.get(id);
}
export function listProviders() {
    return [...PROVIDERS];
}
// Test-only helpers. The framework's runtime treats the registry as
// immutable in production; tests may temporarily register a fake
// provider to verify the runtime's dispatch behavior.
export function _registerForTest(provider) {
    if (process.env.NODE_ENV !== 'test') {
        throw new Error('_registerForTest is only allowed in NODE_ENV=test');
    }
    _byId.set(provider.id, provider);
}
export function _unregisterForTest(providerId) {
    if (process.env.NODE_ENV !== 'test')
        return;
    _byId.delete(providerId);
}
//# sourceMappingURL=registry.js.map