import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { can } from '../lib/rbac.js';
import { decorRepo } from '../db/repos/index.js';
import { BadRequest, Forbidden, NotFound } from '../lib/errors.js';

export async function decorRoutes(app: FastifyInstance) {
  // ─── Items ─────────────────────────────────────────────
  app.get('/api/orgs/:orgId/decor/items', { preHandler: requireAuth }, async (req) => {
    const { orgId } = req.params as { orgId: string };
    if (!can(req.auth!.memberships, { organizationId: orgId }, 'decor.view')) throw Forbidden();
    return { items: decorRepo.listItems(orgId) };
  });

  app.post('/api/orgs/:orgId/decor/items', { preHandler: requireAuth }, async (req, reply) => {
    const { orgId } = req.params as { orgId: string };
    if (!can(req.auth!.memberships, { organizationId: orgId }, 'decor.manage')) throw Forbidden();
    const parsed = z.object({
      categoryId: z.string().optional(),
      name: z.string().min(1).max(200),
      spec: z.record(z.unknown()).optional(),
      imagePath: z.string().optional(),
      visible: z.boolean().optional(),
    }).safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    return reply.code(201).send({ item: decorRepo.createItem(orgId, parsed.data) });
  });

  app.patch('/api/decor/items/:id', { preHandler: requireAuth }, async (req) => {
    const { id } = req.params as { id: string };
    const parsed = z.object({
      categoryId: z.string().nullable().optional(),
      name: z.string().optional(),
      spec: z.record(z.unknown()).optional(),
      imagePath: z.string().nullable().optional(),
      visible: z.boolean().optional(),
    }).safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    const updated = decorRepo.updateItem(id, parsed.data);
    if (!updated) throw NotFound();
    return { item: updated };
  });

  app.delete('/api/decor/items/:id', { preHandler: requireAuth }, async (req, reply) => {
    decorRepo.deleteItem((req.params as { id: string }).id);
    return reply.code(204).send();
  });

  // ─── Categories ────────────────────────────────────────
  app.get('/api/orgs/:orgId/decor/categories', { preHandler: requireAuth }, async (req) => {
    const { orgId } = req.params as { orgId: string };
    if (!can(req.auth!.memberships, { organizationId: orgId }, 'decor.view')) throw Forbidden();
    return { categories: decorRepo.listCategories(orgId) };
  });

  app.post('/api/orgs/:orgId/decor/categories', { preHandler: requireAuth }, async (req, reply) => {
    const { orgId } = req.params as { orgId: string };
    if (!can(req.auth!.memberships, { organizationId: orgId }, 'decor.manage')) throw Forbidden();
    const parsed = z.object({
      name: z.string().min(1).max(120),
      icon: z.string().max(40).optional(),
      sortOrder: z.number().int().optional(),
    }).safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    return reply.code(201).send({ category: decorRepo.createCategory(orgId, parsed.data) });
  });

  app.delete('/api/decor/categories/:id', { preHandler: requireAuth }, async (req, reply) => {
    decorRepo.deleteCategory((req.params as { id: string }).id);
    return reply.code(204).send();
  });

  // ─── Arrangements ──────────────────────────────────────
  app.get('/api/orgs/:orgId/decor/arrangements', { preHandler: requireAuth }, async (req) => {
    const { orgId } = req.params as { orgId: string };
    if (!can(req.auth!.memberships, { organizationId: orgId }, 'decor.view')) throw Forbidden();
    return { arrangements: decorRepo.listArrangements(orgId) };
  });

  app.put('/api/orgs/:orgId/decor/arrangements', { preHandler: requireAuth }, async (req) => {
    const { orgId } = req.params as { orgId: string };
    if (!can(req.auth!.memberships, { organizationId: orgId }, 'decor.design')) throw Forbidden();
    const parsed = z.object({
      id:      z.string().optional(),
      name:    z.string().min(1).max(200),
      payload: z.record(z.unknown()),
    }).safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    return { arrangement: decorRepo.upsertArrangement(orgId, { ...parsed.data, createdBy: req.auth!.userId }) };
  });

  app.delete('/api/decor/arrangements/:id', { preHandler: requireAuth }, async (req, reply) => {
    decorRepo.deleteArrangement((req.params as { id: string }).id);
    return reply.code(204).send();
  });

  // ─── Packages ──────────────────────────────────────────
  app.get('/api/orgs/:orgId/decor/packages', { preHandler: requireAuth }, async (req) => {
    const { orgId } = req.params as { orgId: string };
    if (!can(req.auth!.memberships, { organizationId: orgId }, 'decor.view')) throw Forbidden();
    return { packages: decorRepo.listPackages(orgId) };
  });

  app.put('/api/orgs/:orgId/decor/packages', { preHandler: requireAuth }, async (req) => {
    const { orgId } = req.params as { orgId: string };
    if (!can(req.auth!.memberships, { organizationId: orgId }, 'decor.manage')) throw Forbidden();
    const parsed = z.object({
      id:           z.string().optional(),
      name:         z.string().min(1).max(200),
      style:        z.string().optional(),
      description:  z.string().optional(),
      arrangements: z.array(z.unknown()),
    }).safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    return { package: decorRepo.upsertPackage(orgId, parsed.data) };
  });

  app.delete('/api/decor/packages/:id', { preHandler: requireAuth }, async (req, reply) => {
    decorRepo.deletePackage((req.params as { id: string }).id);
    return reply.code(204).send();
  });
}
