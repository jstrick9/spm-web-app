import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { assertCan, can } from '../lib/rbac.js';
import { sealSecret } from '../lib/secrets.js';
import { integrationsRepo, auditRepo } from '../db/repos/index.js';
import { BadRequest, Forbidden, NotFound } from '../lib/errors.js';
import { getProvider, listProviders } from '../integrations/registry.js';
import { verifyIntegration } from '../integrations/runtime.js';
const upsertSchema = z.object({
    provider: z.string().min(1),
    displayName: z.string().max(120).optional(),
    config: z.record(z.unknown()).optional(),
    secrets: z.record(z.unknown()).optional(),
});
const patchSchema = z.object({
    displayName: z.string().max(120).optional(),
    status: z.enum(['connected', 'disabled']).optional(),
});
/** Strip any whiff of credentials from an integration row before returning to the client. */
function publicView(row) {
    if (!row)
        return null;
    const { secret_payload, webhook_secret, ...rest } = row;
    return { ...rest, hasSecrets: secret_payload !== null };
}
export async function integrationRoutes(app) {
    // ─── List available providers (catalog) ─────────────────
    app.get('/api/orgs/:orgId/integrations/providers', { preHandler: requireAuth }, async (req) => {
        const { orgId } = req.params;
        assertCan(req.auth.memberships, { organizationId: orgId }, 'org.settings.manage');
        return {
            providers: listProviders().map((p) => ({
                id: p.id,
                name: p.name,
                category: p.category,
                description: p.description,
                iconKey: p.iconKey,
                docsUrl: p.docsUrl,
                kind: p.kind,
                capabilities: p.capabilities,
            })),
        };
    });
    // ─── List this org's integrations ──────────────────────
    app.get('/api/orgs/:orgId/integrations', { preHandler: requireAuth }, async (req) => {
        const { orgId } = req.params;
        if (!can(req.auth.memberships, { organizationId: orgId }, 'org.view')) {
            throw Forbidden();
        }
        const rows = integrationsRepo.listForOrg(orgId);
        return { integrations: rows.map(publicView) };
    });
    // ─── Create / update (api_key + smtp kinds; OAuth is separate) ──
    app.post('/api/orgs/:orgId/integrations', { preHandler: requireAuth }, async (req, reply) => {
        const { orgId } = req.params;
        assertCan(req.auth.memberships, { organizationId: orgId }, 'org.settings.manage');
        const parsed = upsertSchema.safeParse(req.body);
        if (!parsed.success)
            throw BadRequest('invalid-input', parsed.error.issues);
        const { provider, displayName, config, secrets } = parsed.data;
        const provDef = getProvider(provider);
        if (!provDef)
            throw BadRequest('unknown-provider', { provider });
        if (provDef.kind === 'oauth') {
            // OAuth providers must go through the /oauth/start flow, not this endpoint.
            throw BadRequest('use-oauth-flow', { provider });
        }
        // Validate config + secrets shape against the provider's schemas
        const cfgParse = provDef.configSchema.safeParse(config ?? {});
        if (!cfgParse.success) {
            throw BadRequest('invalid-config', cfgParse.error.issues);
        }
        const secParse = provDef.secretSchema.safeParse(secrets ?? {});
        if (!secParse.success) {
            throw BadRequest('invalid-secrets', secParse.error.issues);
        }
        const sealed = sealSecret(secParse.data);
        const row = integrationsRepo.upsert({
            organizationId: orgId,
            provider,
            displayName,
            config: cfgParse.data,
            secretPayload: sealed,
            status: 'pending',
            createdBy: req.auth.userId,
        });
        // Run verify() — if it succeeds, status flips to 'connected'.
        try {
            await verifyIntegration(row.id);
        }
        catch (e) {
            // verify already updated status to 'error' with the message
            auditRepo.log({
                organizationId: orgId, actorUserId: req.auth.userId, actorLabel: req.auth.email,
                action: 'integration.verify_failed', targetType: 'integration', targetId: row.id,
                ip: req.ip, details: { provider, error: e.message },
            });
            const refreshed = integrationsRepo.findById(row.id);
            return reply.code(201).send({ integration: publicView(refreshed) });
        }
        auditRepo.log({
            organizationId: orgId, actorUserId: req.auth.userId, actorLabel: req.auth.email,
            action: 'integration.connected', targetType: 'integration', targetId: row.id,
            ip: req.ip, details: { provider },
        });
        return reply.code(201).send({ integration: publicView(integrationsRepo.findById(row.id)) });
    });
    // ─── Test connection ───────────────────────────────────
    app.post('/api/orgs/:orgId/integrations/:provider/test', { preHandler: requireAuth }, async (req, reply) => {
        const { orgId, provider } = req.params;
        assertCan(req.auth.memberships, { organizationId: orgId }, 'org.settings.manage');
        const row = integrationsRepo.findByOrgProvider(orgId, provider);
        if (!row)
            throw NotFound('integration-not-found');
        try {
            await verifyIntegration(row.id);
            return { ok: true, integration: publicView(integrationsRepo.findById(row.id)) };
        }
        catch (e) {
            return reply.code(400).send({
                ok: false,
                error: e.message,
                integration: publicView(integrationsRepo.findById(row.id)),
            });
        }
    });
    // ─── Patch (rename / disable) ──────────────────────────
    app.patch('/api/integrations/:id', { preHandler: requireAuth }, async (req) => {
        const { id } = req.params;
        const row = integrationsRepo.findById(id);
        if (!row)
            throw NotFound('integration-not-found');
        assertCan(req.auth.memberships, { organizationId: row.organization_id }, 'org.settings.manage');
        const parsed = patchSchema.safeParse(req.body);
        if (!parsed.success)
            throw BadRequest('invalid-input', parsed.error.issues);
        integrationsRepo.upsert({
            organizationId: row.organization_id,
            provider: row.provider,
            displayName: parsed.data.displayName,
        });
        if (parsed.data.status) {
            integrationsRepo.setStatus(id, parsed.data.status);
        }
        return { integration: publicView(integrationsRepo.findById(id)) };
    });
    // ─── Delete ────────────────────────────────────────────
    app.delete('/api/integrations/:id', { preHandler: requireAuth }, async (req, reply) => {
        const { id } = req.params;
        const row = integrationsRepo.findById(id);
        if (!row)
            throw NotFound('integration-not-found');
        assertCan(req.auth.memberships, { organizationId: row.organization_id }, 'org.settings.manage');
        integrationsRepo.delete(id);
        auditRepo.log({
            organizationId: row.organization_id, actorUserId: req.auth.userId,
            actorLabel: req.auth.email, action: 'integration.deleted',
            targetType: 'integration', targetId: id, ip: req.ip,
            details: { provider: row.provider },
        });
        return reply.code(204).send();
    });
    // ─── Audit / event log ─────────────────────────────────
    app.get('/api/integrations/:id/events', { preHandler: requireAuth }, async (req) => {
        const { id } = req.params;
        const row = integrationsRepo.findById(id);
        if (!row)
            throw NotFound('integration-not-found');
        if (!can(req.auth.memberships, { organizationId: row.organization_id }, 'audit.view')) {
            throw Forbidden();
        }
        return { events: integrationsRepo.listEvents(id, { limit: 200 }) };
    });
}
//# sourceMappingURL=integrations.js.map