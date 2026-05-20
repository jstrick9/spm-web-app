import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { can } from '../lib/rbac.js';
import { catalogRepo, type CatalogKind, auditRepo } from '../db/repos/index.js';
import { BadRequest, Forbidden, NotFound } from '../lib/errors.js';

const KIND_RE = /^(table|fixture|chair|wall_style|linen|guideline|spacing|template)$/;

const itemSchema = z.object({
  name:      z.string().min(1).max(200),
  spec:      z.record(z.unknown()).optional(),
  visible:   z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

const replaceSchema = z.object({
  items: z.array(z.object({
    id:        z.string().optional(),
    name:      z.string().min(1).max(200),
    spec:      z.record(z.unknown()).optional(),
    visible:   z.boolean().optional(),
    sortOrder: z.number().int().optional(),
  })),
});

export async function catalogRoutes(app: FastifyInstance) {
  app.get('/api/orgs/:orgId/catalog/:kind', { preHandler: requireAuth }, async (req) => {
    const { orgId, kind } = req.params as { orgId: string; kind: string };
    if (!KIND_RE.test(kind)) throw BadRequest('invalid-kind');
    if (!can(req.auth!.memberships, { organizationId: orgId }, 'catalog.view')) throw Forbidden();
    return { items: catalogRepo.listForOrg(orgId, kind as CatalogKind) };
  });

  app.post('/api/orgs/:orgId/catalog/:kind', { preHandler: requireAuth }, async (req, reply) => {
    const { orgId, kind } = req.params as { orgId: string; kind: string };
    if (!KIND_RE.test(kind)) throw BadRequest('invalid-kind');
    if (!can(req.auth!.memberships, { organizationId: orgId }, 'catalog.manage')) throw Forbidden();
    const parsed = itemSchema.safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    const item = catalogRepo.create(orgId, { kind: kind as CatalogKind, ...parsed.data });
    auditRepo.log({
      organizationId: orgId, actorUserId: req.auth!.userId, actorLabel: req.auth!.email,
      action: 'catalog.create', targetType: kind, targetId: item.id, ip: req.ip,
    });
    return reply.code(201).send({ item });
  });

  app.put('/api/orgs/:orgId/catalog/:kind', { preHandler: requireAuth }, async (req) => {
    // Bulk replace - used by admin "save all" flows.
    const { orgId, kind } = req.params as { orgId: string; kind: string };
    if (!KIND_RE.test(kind)) throw BadRequest('invalid-kind');
    if (!can(req.auth!.memberships, { organizationId: orgId }, 'catalog.manage')) throw Forbidden();
    const parsed = replaceSchema.safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    const items = catalogRepo.replaceAll(orgId, kind as CatalogKind, parsed.data.items);
    auditRepo.log({
      organizationId: orgId, actorUserId: req.auth!.userId, actorLabel: req.auth!.email,
      action: 'catalog.replace_all', targetType: kind, ip: req.ip,
      details: { count: items.length },
    });
    return { items };
  });

  app.patch('/api/catalog/:id', { preHandler: requireAuth }, async (req) => {
    const { id } = req.params as { id: string };
    const item = catalogRepo.findById(id);
    if (!item) throw NotFound();
    if (!can(req.auth!.memberships, { organizationId: item.organizationId }, 'catalog.manage')) throw Forbidden();
    const parsed = itemSchema.partial().safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    return { item: catalogRepo.update(id, parsed.data) };
  });

  app.delete('/api/catalog/:id', { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const item = catalogRepo.findById(id);
    if (!item) throw NotFound();
    if (!can(req.auth!.memberships, { organizationId: item.organizationId }, 'catalog.manage')) throw Forbidden();
    catalogRepo.delete(id);
    return reply.code(204).send();
  });
}
