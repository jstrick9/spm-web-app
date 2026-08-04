import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { can } from '../lib/rbac.js';
import { auditRepo } from '../db/repos/index.js';
import { BadRequest, Forbidden } from '../lib/errors.js';

const auditQuerySchema = z.object({
  limit: z.string().regex(/^\d+$/).transform(Number).refine((n) => n >= 1 && n <= 1000, { message: 'limit-out-of-range' }).optional(),
  action: z.string().max(120).optional(),
  before: z.string().max(64).optional(),
  after: z.string().max(64).optional(),
  actorEmail: z.string().max(254).optional(),
});

export async function auditRoutes(app: FastifyInstance) {
  // PA-05: validated limit + action/before/after/actorEmail filters + paging.
  app.get('/api/orgs/:orgId/audit', { preHandler: requireAuth }, async (req) => {
    const { orgId } = req.params as { orgId: string };
    const parsed = auditQuerySchema.safeParse(req.query);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    if (!can(req.auth!.memberships, { organizationId: orgId }, 'audit.view')) throw Forbidden();
    const { limit = 200, action, before, after, actorEmail } = parsed.data;
    const logs = auditRepo.listForOrg(orgId, { limit, action, before, after, actorEmail });
    return {
      logs,
      total: auditRepo.countForOrg(orgId, { action, before, after, actorEmail }),
      limit,
      nextBefore: logs.length === limit ? (logs[logs.length - 1] as { created_at: string }).created_at : undefined,
    };
  });
}
