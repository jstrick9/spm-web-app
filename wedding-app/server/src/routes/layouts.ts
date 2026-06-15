import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { can } from '../lib/rbac.js';
import { auditRepo, eventsRepo, layoutOpsRepo, layoutsRepo } from '../db/repos/index.js';
import { saveDataUri } from '../lib/fileStorage.js';
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

const floorWalkSchema = z.object({
  checkId: z.string().min(1).max(80),
  status: z.enum(['pending', 'verified', 'issue']),
  note: z.string().max(2000).optional(),
});
const varianceEvidenceSchema = z.object({
  note: z.string().min(1).max(4000),
  photoDataUri: z.string().optional(),
  photoUrl: z.string().optional(),
});
const rainPlanSchema = z.object({
  active: z.boolean(),
  note: z.string().max(2000).optional(),
});
const vendorInspectionSchema = z.object({
  vendorId: z.string().optional(),
  status: z.enum(['pending', 'verified', 'issue']),
  zoneLabel: z.string().max(200).optional(),
  note: z.string().max(2000).optional(),
});
const setupPacketSchema = z.object({
  audience: z.enum(['setup_crew', 'vendors', 'planner', 'fire_marshal']).default('setup_crew'),
  payload: z.record(z.unknown()).optional(),
  expiresAt: z.string().optional(),
});

function requireLayoutAccess(layoutId: string, memberships: any[], permission: 'layouts.view' | 'layouts.edit') {
  const layout = layoutsRepo.findById(layoutId);
  if (!layout) throw NotFound();
  if (!can(memberships, { organizationId: layout.organization_id }, permission)) throw Forbidden();
  return layout;
}

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

  app.get('/api/layouts/:id/ops', { preHandler: requireAuth }, async (req) => {
    const { id } = req.params as { id: string };
    requireLayoutAccess(id, req.auth!.memberships, 'layouts.view');
    return { ops: layoutOpsRepo.listForLayout(id) };
  });

  app.post('/api/layouts/:id/floor-walk-checks', { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const layout = requireLayoutAccess(id, req.auth!.memberships, 'layouts.edit');
    const parsed = floorWalkSchema.safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    const check = layoutOpsRepo.setFloorWalkCheck({
      orgId: layout.organization_id,
      eventId: layout.event_id,
      layoutId: id,
      checkId: parsed.data.checkId,
      status: parsed.data.status,
      note: parsed.data.note,
      actorId: req.auth!.userId,
    });
    return reply.code(201).send({ check });
  });

  app.post('/api/layouts/:id/variance-evidence', { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const layout = requireLayoutAccess(id, req.auth!.memberships, 'layouts.edit');
    const parsed = varianceEvidenceSchema.safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    const photoUrl = parsed.data.photoDataUri ? saveDataUri(parsed.data.photoDataUri, `layout_variance_${id}`) : parsed.data.photoUrl;
    const evidence = layoutOpsRepo.addVarianceEvidence({
      orgId: layout.organization_id,
      eventId: layout.event_id,
      layoutId: id,
      note: parsed.data.note,
      photoUrl,
      actorId: req.auth!.userId,
    });
    return reply.code(201).send({ evidence });
  });

  app.post('/api/layouts/:id/rain-plan', { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const layout = requireLayoutAccess(id, req.auth!.memberships, 'layouts.edit');
    const parsed = rainPlanSchema.safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    const activation = layoutOpsRepo.activateRainPlan({
      orgId: layout.organization_id,
      eventId: layout.event_id,
      layoutId: id,
      active: parsed.data.active,
      note: parsed.data.note,
      actorId: req.auth!.userId,
    });
    return reply.code(201).send({ activation });
  });

  app.post('/api/layouts/:id/vendor-zone-inspections', { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const layout = requireLayoutAccess(id, req.auth!.memberships, 'layouts.edit');
    const parsed = vendorInspectionSchema.safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    const inspection = layoutOpsRepo.setVendorZoneInspection({
      orgId: layout.organization_id,
      eventId: layout.event_id,
      layoutId: id,
      vendorId: parsed.data.vendorId,
      status: parsed.data.status,
      zoneLabel: parsed.data.zoneLabel,
      note: parsed.data.note,
      actorId: req.auth!.userId,
    });
    return reply.code(201).send({ inspection });
  });

  app.post('/api/layouts/:id/setup-packet', { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const layout = requireLayoutAccess(id, req.auth!.memberships, 'layouts.view');
    const parsed = setupPacketSchema.safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    const packet = layoutOpsRepo.upsertSetupPacket({
      orgId: layout.organization_id,
      eventId: layout.event_id,
      layoutId: id,
      audience: parsed.data.audience,
      payload: parsed.data.payload ?? {},
      expiresAt: parsed.data.expiresAt,
      actorId: req.auth!.userId,
    });
    return reply.code(201).send({ packet, publicUrl: `/api/public/layout-packets/${packet.token}` });
  });

  app.get('/api/public/layout-packets/:token', async (req) => {
    const { token } = req.params as { token: string };
    const packet = layoutOpsRepo.findPacketByToken(token);
    if (!packet) throw NotFound();
    const layout = layoutsRepo.findById(packet.layout_id);
    if (!layout) throw NotFound();
    let payload: Record<string, unknown> = {};
    try { payload = JSON.parse(packet.payload || '{}'); } catch {}
    return {
      packet: {
        id: packet.id,
        audience: packet.audience,
        layoutId: packet.layout_id,
        eventId: packet.event_id,
        layoutName: layout.name,
        layoutRevision: layout.revision,
        approvalStatus: layout.approval_status,
        payload,
        createdAt: packet.created_at,
        updatedAt: packet.updated_at,
      },
    };
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
