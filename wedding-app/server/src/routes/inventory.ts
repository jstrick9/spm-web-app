import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { can } from '../lib/rbac.js';
import { inventoryRepo } from '../db/repos/inventory.js';
import { BadRequest, Forbidden, NotFound } from '../lib/errors.js';

const itemSchema = z.object({
  sku: z.string().max(50).optional(),
  name: z.string().min(1).max(200),
  category: z.enum(['chair','linen','centerpiece','av','lighting','tableware','other']).optional(),
  totalCount: z.number().int().min(0).optional(),
  availableCount: z.number().int().min(0).optional(),
  condition: z.enum(['good','fair','poor','maintenance']).optional(),
  ownerType: z.enum(['venue','vendor_rental']).optional(),
  notes: z.string().max(2000).optional(),
});

export async function inventoryRoutes(app: FastifyInstance) {
  app.get('/api/orgs/:orgId/inventory', { preHandler: requireAuth }, async (req) => {
    const { orgId } = req.params as { orgId: string };
    if (!can(req.auth!.memberships, { organizationId: orgId }, 'inventory.view')) throw Forbidden();
    return {
      items: inventoryRepo.listForOrg(orgId),
      stats: inventoryRepo.stats(orgId),
    };
  });

  app.post('/api/orgs/:orgId/inventory', { preHandler: requireAuth }, async (req, reply) => {
    const { orgId } = req.params as { orgId: string };
    if (!can(req.auth!.memberships, { organizationId: orgId }, 'inventory.manage')) throw Forbidden();
    const parsed = itemSchema.safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    const item = inventoryRepo.create(orgId, { ...parsed.data, createdBy: req.auth!.userId });
    return reply.code(201).send({ item });
  });

  app.patch('/api/inventory/:id', { preHandler: requireAuth }, async (req) => {
    const { id } = req.params as { id: string };
    const item = inventoryRepo.findById(id);
    if (!item) throw NotFound();
    if (!can(req.auth!.memberships, { organizationId: item.organization_id }, 'inventory.manage')) throw Forbidden();
    const parsed = itemSchema.partial().safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    return { item: inventoryRepo.update(id, parsed.data) };
  });

  app.delete('/api/inventory/:id', { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const item = inventoryRepo.findById(id);
    if (!item) throw NotFound();
    if (!can(req.auth!.memberships, { organizationId: item.organization_id }, 'inventory.manage')) throw Forbidden();
    inventoryRepo.delete(id);
    return reply.code(204).send();
  });
}
