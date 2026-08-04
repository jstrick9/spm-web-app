/**
 * Platform Config routes — persistence for the client-side PlatformConfig.
 *
 *   GET  /api/orgs/:orgId/config         → org-level config (any member)
 *   PUT  /api/orgs/:orgId/config         → write org-level config (roles.manage)
 *   GET  /api/events/:eventId/config     → event-level config (event members)
 *   PUT  /api/events/:eventId/config     → write event-level config (events.edit)
 *   GET  /api/users/me/preferences       → user-level config (the requesting user)
 *   PUT  /api/users/me/preferences       → write user-level config
 *
 * Storage strategy (no schema migration needed):
 *   - org config        → organizations.settings.platformConfig
 *   - event config      → events.metadata.platformConfig
 *   - user preferences  → users.preferences.platformConfig
 *
 * Validation: we accept any JSON object; the CLIENT validates the schema
 * before sending. The server does shape-agnostic storage + size limits.
 * (We don't want to bundle zod on the server just for this, and the client
 * is the only writer.)
 */
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { assertCan, can } from '../lib/rbac.js';
import { db } from '../db/database.js';
import { eventsRepo, orgsRepo, auditRepo, adminChangeRequestsRepo } from '../db/repos/index.js';
import { parseJson, stringifyJson } from '../lib/json.js';
import { BadRequest, Forbidden, NotFound } from '../lib/errors.js';
import { saveDataUri, publicFilePath } from '../lib/fileStorage.js';
import { createReadStream, existsSync } from 'node:fs';

// Max payload size: 64 KB. PlatformConfig should be ~5-10 KB for most
// installs; 64 KB is plenty of slack and prevents abuse.
const MAX_CONFIG_BYTES = 64 * 1024;

const configBodySchema = z.record(z.unknown());
const adminChangeRequestSchema = z.object({
  title: z.string().min(1).max(300),
  area: z.string().min(1).max(80).optional(),
  reason: z.string().max(4000).optional(),
});
const adminChangeRequestUpdateSchema = z.object({
  status: z.enum(['open','approved','rejected','resolved']).optional(),
  responseNote: z.string().max(4000).nullable().optional(),
});

function validateSize(body: unknown): void {
  const serialized = JSON.stringify(body);
  if (serialized.length > MAX_CONFIG_BYTES) {
    throw BadRequest('config-too-large', { maxBytes: MAX_CONFIG_BYTES });
  }
}

export async function platformConfigRoutes(app: FastifyInstance) {
  // ─── Org-level ──────────────────────────────────────────
  app.get('/api/orgs/:orgId/config', { preHandler: requireAuth }, async (req) => {
    const { orgId } = req.params as { orgId: string };
    if (!can(req.auth!.memberships, { organizationId: orgId }, 'org.view')) {
      throw Forbidden();
    }
    const org = orgsRepo.findById(orgId);
    if (!org) throw NotFound('org-not-found');
    const settings = parseJson<Record<string, unknown>>(org.settings, {});
    return { config: (settings.platformConfig as Record<string, unknown>) ?? {} };
  });

  app.put('/api/orgs/:orgId/config', { preHandler: requireAuth }, async (req) => {
    const { orgId } = req.params as { orgId: string };
    // Only roles.manage (owner + admin by default) can change org-wide config.
    assertCan(req.auth!.memberships, { organizationId: orgId }, 'roles.manage');

    const parsed = configBodySchema.safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    validateSize(parsed.data);

    const org = orgsRepo.findById(orgId);
    if (!org) throw NotFound('org-not-found');

    const settings = parseJson<Record<string, unknown>>(org.settings, {});
    settings.platformConfig = parsed.data;
    orgsRepo.updateSettings(orgId, settings);

    auditRepo.log({
      organizationId: orgId, actorUserId: req.auth!.userId, actorLabel: req.auth!.email,
      action: 'org.config.update', targetType: 'org', targetId: orgId, ip: req.ip,
      details: { sections: Object.keys(parsed.data) },
    });

    return { config: parsed.data };
  });

  app.get('/api/public/orgs/:orgId/logo', async (req, reply) => {
    const { orgId } = req.params as { orgId: string };
    const org = orgsRepo.findById(orgId);
    if (!org) throw NotFound('org-not-found');
    const settings = parseJson<Record<string, unknown>>(org.settings, {});
    const branding = ((settings.platformConfig as Record<string, any> | undefined)?.branding ?? {}) as Record<string, any>;
    const source = typeof branding.logoStorageUrl === 'string' ? branding.logoStorageUrl : branding.logoUrl;
    if (typeof source !== 'string' || !source) throw NotFound('logo-not-found');
    const path = publicFilePath(source);
    if (!path) return reply.redirect(source);
    if (!existsSync(path)) throw NotFound('logo-file-not-found');
    reply.header('Cache-Control', 'public, max-age=300');
    return reply.send(createReadStream(path));
  });

  app.post('/api/orgs/:orgId/config/logo', { preHandler: requireAuth, bodyLimit: 12 * 1024 * 1024 }, async (req) => {
    const { orgId } = req.params as { orgId: string };
    assertCan(req.auth!.memberships, { organizationId: orgId }, 'roles.manage');
    const dataUri = (req.body as { dataUri?: unknown })?.dataUri;
    if (typeof dataUri !== 'string') throw BadRequest('logo-required');
    const logoStorageUrl = saveDataUri(dataUri, `org_logo_${orgId}`);
    const logoUrl = `/api/public/orgs/${orgId}/logo`;
    const org = orgsRepo.findById(orgId);
    if (!org) throw NotFound('org-not-found');
    const settings = parseJson<Record<string, unknown>>(org.settings, {});
    const config = (settings.platformConfig as Record<string, any>) ?? {};
    settings.platformConfig = { ...config, branding: { ...(config.branding ?? {}), logoUrl, logoStorageUrl } };
    orgsRepo.updateSettings(orgId, settings);
    return { logoUrl, config: settings.platformConfig };
  });

  app.get('/api/orgs/:orgId/admin-change-requests', { preHandler: requireAuth }, async (req) => {
    const { orgId } = req.params as { orgId: string };
    if (!can(req.auth!.memberships, { organizationId: orgId }, 'org.view')) throw Forbidden();
    return { requests: adminChangeRequestsRepo.listForOrg(orgId) };
  });

  app.post('/api/orgs/:orgId/admin-change-requests', { preHandler: requireAuth }, async (req, reply) => {
    const { orgId } = req.params as { orgId: string };
    if (!can(req.auth!.memberships, { organizationId: orgId }, 'org.view')) throw Forbidden();
    const parsed = adminChangeRequestSchema.safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    const request = adminChangeRequestsRepo.create({ orgId, requestedBy: req.auth!.userId, ...parsed.data });
    auditRepo.log({ organizationId: orgId, actorUserId: req.auth!.userId, actorLabel: req.auth!.email, action: 'admin_change.request.create', targetType: 'admin_change_request', targetId: request.id, ip: req.ip, details: parsed.data });
    return reply.code(201).send({ request });
  });

  app.patch('/api/orgs/:orgId/admin-change-requests/:id', { preHandler: requireAuth }, async (req) => {
    const { orgId, id } = req.params as { orgId: string; id: string };
    assertCan(req.auth!.memberships, { organizationId: orgId }, 'roles.manage');
    const parsed = adminChangeRequestUpdateSchema.safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    const request = adminChangeRequestsRepo.update(id, parsed.data);
    if (!request || request.organization_id !== orgId) throw NotFound('request-not-found');
    auditRepo.log({ organizationId: orgId, actorUserId: req.auth!.userId, actorLabel: req.auth!.email, action: 'admin_change.request.update', targetType: 'admin_change_request', targetId: id, ip: req.ip, details: parsed.data });
    return { request };
  });

  // ─── Event-level ────────────────────────────────────────
  app.get('/api/events/:eventId/config', { preHandler: requireAuth }, async (req) => {
    const { eventId } = req.params as { eventId: string };
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'events.view', orgMap)) throw Forbidden();
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound('event-not-found');
    const metadata = parseJson<Record<string, unknown>>(event.metadata, {});
    return { config: (metadata.platformConfig as Record<string, unknown>) ?? {} };
  });

  app.put('/api/events/:eventId/config', { preHandler: requireAuth }, async (req) => {
    const { eventId } = req.params as { eventId: string };
    const event = eventsRepo.findById(eventId);
    if (!event) throw NotFound('event-not-found');
    // PA-07: event-scoped editors (planner etc.) must be able to override the
    // event theme — use the eventId scope + orgMap, not org-level.
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { eventId }, 'events.edit', orgMap)) throw Forbidden();

    const parsed = configBodySchema.safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    validateSize(parsed.data);

    const metadata = parseJson<Record<string, unknown>>(event.metadata, {});
    metadata.platformConfig = parsed.data;
    eventsRepo.update(eventId, { metadata });

    auditRepo.log({
      organizationId: event.organization_id, actorUserId: req.auth!.userId,
      actorLabel: req.auth!.email, action: 'event.config.update',
      targetType: 'event', targetId: eventId, ip: req.ip,
    });

    return { config: parsed.data };
  });

  // ─── User-level ─────────────────────────────────────────
  app.get('/api/users/me/preferences', { preHandler: requireAuth }, async (req) => {
    const row = db.prepare(`SELECT preferences FROM users WHERE id = ?`)
      .get(req.auth!.userId) as { preferences: string } | undefined;
    const prefs = parseJson<Record<string, unknown>>(row?.preferences ?? '{}', {});
    return { config: (prefs.platformConfig as Record<string, unknown>) ?? {} };
  });

  app.put('/api/users/me/preferences', { preHandler: requireAuth }, async (req) => {
    const parsed = configBodySchema.safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    validateSize(parsed.data);

    const row = db.prepare(`SELECT preferences FROM users WHERE id = ?`)
      .get(req.auth!.userId) as { preferences: string } | undefined;
    const prefs = parseJson<Record<string, unknown>>(row?.preferences ?? '{}', {});
    prefs.platformConfig = parsed.data;

    db.prepare(`UPDATE users SET preferences = ?, updated_at = datetime('now') WHERE id = ?`)
      .run(stringifyJson(prefs), req.auth!.userId);

    return { config: parsed.data };
  });
}
