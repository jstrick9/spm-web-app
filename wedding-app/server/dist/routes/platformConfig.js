import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { assertCan, can } from '../lib/rbac.js';
import { db } from '../db/database.js';
import { eventsRepo, orgsRepo, auditRepo } from '../db/repos/index.js';
import { parseJson, stringifyJson } from '../lib/json.js';
import { BadRequest, Forbidden, NotFound } from '../lib/errors.js';
// Max payload size: 64 KB. PlatformConfig should be ~5-10 KB for most
// installs; 64 KB is plenty of slack and prevents abuse.
const MAX_CONFIG_BYTES = 64 * 1024;
const configBodySchema = z.record(z.unknown());
function validateSize(body) {
    const serialized = JSON.stringify(body);
    if (serialized.length > MAX_CONFIG_BYTES) {
        throw BadRequest('config-too-large', { maxBytes: MAX_CONFIG_BYTES });
    }
}
export async function platformConfigRoutes(app) {
    // ─── Org-level ──────────────────────────────────────────
    app.get('/api/orgs/:orgId/config', { preHandler: requireAuth }, async (req) => {
        const { orgId } = req.params;
        if (!can(req.auth.memberships, { organizationId: orgId }, 'org.view')) {
            throw Forbidden();
        }
        const org = orgsRepo.findById(orgId);
        if (!org)
            throw NotFound('org-not-found');
        const settings = parseJson(org.settings, {});
        return { config: settings.platformConfig ?? {} };
    });
    app.put('/api/orgs/:orgId/config', { preHandler: requireAuth }, async (req) => {
        const { orgId } = req.params;
        // Only roles.manage (owner + admin by default) can change org-wide config.
        assertCan(req.auth.memberships, { organizationId: orgId }, 'roles.manage');
        const parsed = configBodySchema.safeParse(req.body);
        if (!parsed.success)
            throw BadRequest('invalid-input', parsed.error.issues);
        validateSize(parsed.data);
        const org = orgsRepo.findById(orgId);
        if (!org)
            throw NotFound('org-not-found');
        const settings = parseJson(org.settings, {});
        settings.platformConfig = parsed.data;
        orgsRepo.updateSettings(orgId, settings);
        auditRepo.log({
            organizationId: orgId, actorUserId: req.auth.userId, actorLabel: req.auth.email,
            action: 'org.config.update', targetType: 'org', targetId: orgId, ip: req.ip,
            details: { sections: Object.keys(parsed.data) },
        });
        return { config: parsed.data };
    });
    // ─── Event-level ────────────────────────────────────────
    app.get('/api/events/:eventId/config', { preHandler: requireAuth }, async (req) => {
        const { eventId } = req.params;
        const orgMap = eventsRepo.orgMapForUser(req.auth.userId);
        if (!can(req.auth.memberships, { eventId }, 'events.view', orgMap))
            throw Forbidden();
        const event = eventsRepo.findById(eventId);
        if (!event)
            throw NotFound('event-not-found');
        const metadata = parseJson(event.metadata, {});
        return { config: metadata.platformConfig ?? {} };
    });
    app.put('/api/events/:eventId/config', { preHandler: requireAuth }, async (req) => {
        const { eventId } = req.params;
        const event = eventsRepo.findById(eventId);
        if (!event)
            throw NotFound('event-not-found');
        // Anyone who can edit the event can override its theme/widgets
        assertCan(req.auth.memberships, { organizationId: event.organization_id }, 'events.edit');
        const parsed = configBodySchema.safeParse(req.body);
        if (!parsed.success)
            throw BadRequest('invalid-input', parsed.error.issues);
        validateSize(parsed.data);
        const metadata = parseJson(event.metadata, {});
        metadata.platformConfig = parsed.data;
        eventsRepo.update(eventId, { metadata });
        auditRepo.log({
            organizationId: event.organization_id, actorUserId: req.auth.userId,
            actorLabel: req.auth.email, action: 'event.config.update',
            targetType: 'event', targetId: eventId, ip: req.ip,
        });
        return { config: parsed.data };
    });
    // ─── User-level ─────────────────────────────────────────
    app.get('/api/users/me/preferences', { preHandler: requireAuth }, async (req) => {
        const row = db.prepare(`SELECT preferences FROM users WHERE id = ?`)
            .get(req.auth.userId);
        const prefs = parseJson(row?.preferences ?? '{}', {});
        return { config: prefs.platformConfig ?? {} };
    });
    app.put('/api/users/me/preferences', { preHandler: requireAuth }, async (req) => {
        const parsed = configBodySchema.safeParse(req.body);
        if (!parsed.success)
            throw BadRequest('invalid-input', parsed.error.issues);
        validateSize(parsed.data);
        const row = db.prepare(`SELECT preferences FROM users WHERE id = ?`)
            .get(req.auth.userId);
        const prefs = parseJson(row?.preferences ?? '{}', {});
        prefs.platformConfig = parsed.data;
        db.prepare(`UPDATE users SET preferences = ?, updated_at = datetime('now') WHERE id = ?`)
            .run(stringifyJson(prefs), req.auth.userId);
        return { config: parsed.data };
    });
}
//# sourceMappingURL=platformConfig.js.map