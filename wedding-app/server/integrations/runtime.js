/**
 * Integration runtime — call provider actions safely.
 *
 *   const result = await runAction({
 *     integrationId: '...',
 *     actionId: 'sendEmail',
 *     input: { to: 'foo@bar.com', subject: 'Hi', text: 'Hello' },
 *   });
 *
 * Responsibilities:
 *   - Load the integration row + decrypt secrets via sealSecret()
 *   - Validate input against the action's zod schema
 *   - Run the action; catch + classify errors
 *   - Write an integration_event for the audit log
 *   - Update integration.status on persistent auth failures (so the
 *     admin UI can show "needs reconnecting")
 */
import { integrationsRepo } from '../db/repos/integrations.js';
import { openSecret } from '../lib/secrets.js';
import { parseJson } from '../lib/json.js';
import { getProvider } from './registry.js';
export class IntegrationError extends Error {
    code;
    constructor(code, message) {
        super(message);
        this.code = code;
        this.name = 'IntegrationError';
    }
}
/**
 * Build the live context (decrypted secrets + parsed config). Used by
 * runAction, verify, poll, and webhook handlers.
 */
function loadContext(integrationId) {
    const row = integrationsRepo.findById(integrationId);
    if (!row)
        throw new IntegrationError('integration-not-found', `No integration ${integrationId}`);
    if (row.status === 'disabled' || row.status === 'revoked') {
        throw new IntegrationError('integration-disabled', `Integration ${integrationId} is ${row.status}`);
    }
    const config = parseJson(row.config, {});
    const secrets = row.secret_payload ? openSecret(row.secret_payload) : {};
    return {
        providerId: row.provider,
        ctx: {
            secrets,
            config,
            integrationId: row.id,
            organizationId: row.organization_id,
        },
    };
}
/** Run a typed provider action by id. */
export async function runAction(input) {
    const { ctx, providerId } = loadContext(input.integrationId);
    const provider = getProvider(providerId);
    if (!provider) {
        throw new IntegrationError('provider-not-registered', `Provider ${providerId} not registered`);
    }
    const action = provider.actions.find((a) => a.id === input.actionId);
    if (!action) {
        throw new IntegrationError('unknown-action', `Provider ${providerId} has no action ${input.actionId}`);
    }
    // Validate input
    const parsed = action.inputSchema.safeParse(input.input);
    if (!parsed.success) {
        throw new IntegrationError('invalid-input', parsed.error.issues.map((i) => i.message).join('; '));
    }
    try {
        const out = await action.run(ctx, parsed.data);
        integrationsRepo.logEvent({
            integrationId: ctx.integrationId,
            organizationId: ctx.organizationId,
            direction: 'outbound',
            kind: `${providerId}.${input.actionId}`,
            status: 'ok',
            relatedType: input.relatedType,
            relatedId: input.relatedId,
        });
        return out;
    }
    catch (err) {
        const msg = err.message;
        integrationsRepo.logEvent({
            integrationId: ctx.integrationId,
            organizationId: ctx.organizationId,
            direction: 'outbound',
            kind: `${providerId}.${input.actionId}`,
            status: 'error',
            errorMessage: msg,
            relatedType: input.relatedType,
            relatedId: input.relatedId,
        });
        // If the error looks like auth failure, mark integration as error
        if (/auth|unauthor|forbidden|invalid_grant|expired/i.test(msg)) {
            integrationsRepo.setStatus(ctx.integrationId, 'error', msg);
        }
        throw err;
    }
}
/** Verify a freshly-connected integration. Throws on failure. */
export async function verifyIntegration(integrationId) {
    const { ctx, providerId } = loadContext(integrationId);
    const provider = getProvider(providerId);
    if (!provider)
        throw new IntegrationError('provider-not-registered', providerId);
    try {
        await provider.verify(ctx);
        integrationsRepo.setStatus(integrationId, 'connected', null);
        integrationsRepo.markSynced(integrationId);
        integrationsRepo.logEvent({
            integrationId, organizationId: ctx.organizationId,
            direction: 'outbound', kind: `${providerId}.verify`, status: 'ok',
        });
    }
    catch (err) {
        const msg = err.message;
        integrationsRepo.setStatus(integrationId, 'error', msg);
        integrationsRepo.logEvent({
            integrationId, organizationId: ctx.organizationId,
            direction: 'outbound', kind: `${providerId}.verify`, status: 'error', errorMessage: msg,
        });
        throw err;
    }
}
/** Helper: find an integration for an org+provider; throws if not connected. */
export function requireConnected(orgId, providerId) {
    const row = integrationsRepo.findByOrgProvider(orgId, providerId);
    if (!row)
        throw new IntegrationError('not-connected', `No ${providerId} integration for org ${orgId}`);
    if (row.status !== 'connected') {
        throw new IntegrationError('not-connected', `${providerId} integration is ${row.status}`);
    }
    return row;
}
//# sourceMappingURL=runtime.js.map