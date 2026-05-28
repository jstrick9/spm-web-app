import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { can } from '../lib/rbac.js';
import { auditRepo, eventsRepo, layoutsRepo } from '../db/repos/index.js';
import { BadRequest, Forbidden, NotFound, HttpError } from '../lib/errors.js';

const createSchema = z.object({
  organizationId: z.string().min(1),
  eventId:        z.string().optional(),
  venueId:        z.string().optional(),
  name:           z.string().min(1).max(200),
  visibility:     z.enum(['private','event','venue','public']).optional(),
  payload:        z.record(z.unknown()),
  isTemplate:     z.boolean().optional(),
});

const saveSchema = z.object({
  payload:           z.record(z.unknown()),
  changeDescription: z.string().max(2000).optional(),
  expectedRevision:  z.number().int().min(1).optional(),
  approvalStatus:    z.enum(['draft','pending','approved','rejected']).optional(),
});

export async function layoutRoutes(app: FastifyInstance) {
  app.get('/api/orgs/:orgId/layouts', { preHandler: requireAuth }, async (req) => {
    const { orgId } = req.params as { orgId: string };
    const { eventId, template } = req.query as { eventId?: string; template?: string };
    if (!can(req.auth!.memberships, { organizationId: orgId }, 'layouts.view')) throw Forbidden();
    return {
      layouts: layoutsRepo.listForOrg(orgId, {
        eventId, isTemplate: template === 'true' ? true : template === 'false' ? false : undefined,
      }),
    };
  });

  app.post('/api/layouts', { preHandler: requireAuth }, async (req, reply) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    if (!can(req.auth!.memberships, { organizationId: parsed.data.organizationId }, 'layouts.create')) throw Forbidden();
    const layout = layoutsRepo.create({
      organizationId: parsed.data.organizationId,
      eventId: parsed.data.eventId,
      venueId: parsed.data.venueId,
      name: parsed.data.name,
      visibility: parsed.data.visibility,
      payload: parsed.data.payload,
      isTemplate: parsed.data.isTemplate,
      createdBy: req.auth!.userId,
    });
    auditRepo.log({
      organizationId: parsed.data.organizationId, actorUserId: req.auth!.userId,
      actorLabel: req.auth!.email, action: 'layout.create',
      targetType: 'layout', targetId: layout.id, ip: req.ip,
    });
    return reply.code(201).send({ layout });
  });

  app.get('/api/layouts/:id', { preHandler: requireAuth }, async (req) => {
    const { id } = req.params as { id: string };
    const layout = layoutsRepo.findById(id);
    if (!layout) throw NotFound();
    const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
    if (!can(req.auth!.memberships, { organizationId: layout.organization_id }, 'layouts.view', orgMap)) throw Forbidden();
    return { layout };
  });

  app.post('/api/layouts/:id/save', { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const layout = layoutsRepo.findById(id);
    if (!layout) throw NotFound();
    if (!can(req.auth!.memberships, { organizationId: layout.organization_id }, 'layouts.edit')) throw Forbidden();
    const parsed = saveSchema.safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    try {
      const saved = layoutsRepo.saveRevision({
        layoutId: id,
        payload: parsed.data.payload,
        updatedBy: req.auth!.userId,
        changeDescription: parsed.data.changeDescription,
        expectedRevision: parsed.data.expectedRevision,
        approvalStatus: parsed.data.approvalStatus,
      });
      return { layout: saved };
    } catch (err) {
      if ((err as { code?: string }).code === 'revision-conflict') {
        throw new HttpError(409, 'revision-conflict', undefined, {
          currentRevision: layoutsRepo.findById(id)?.revision,
        });
      }
      throw err;
    }
  });

  app.get('/api/layouts/:id/versions', { preHandler: requireAuth }, async (req) => {
    const { id } = req.params as { id: string };
    const layout = layoutsRepo.findById(id);
    if (!layout) throw NotFound();
    if (!can(req.auth!.memberships, { organizationId: layout.organization_id }, 'layouts.view')) throw Forbidden();
    return { versions: layoutsRepo.listVersions(id) };
  });

  app.delete('/api/layouts/:id', { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const layout = layoutsRepo.findById(id);
    if (!layout) throw NotFound();
    if (!can(req.auth!.memberships, { organizationId: layout.organization_id }, 'layouts.delete')) throw Forbidden();
    layoutsRepo.delete(id);
    return reply.code(204).send();
  });
}
