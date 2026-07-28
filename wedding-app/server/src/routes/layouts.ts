import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../db/database.js';
import { uuid } from '../lib/crypto.js';
import { requireAuth } from '../middleware/auth.js';
import { can } from '../lib/rbac.js';
import { auditRepo, assetsRepo, eventsRepo, inventoryRepo, layoutCollaborationRepo, layoutOpsRepo, layoutsRepo } from '../db/repos/index.js';
import { savePrivateImageDataUri, privateFilePath } from '../lib/fileStorage.js';
import { createReadStream, existsSync } from 'node:fs';
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
const commentSchema = z.object({ body: z.string().min(1).max(4000), target: z.record(z.unknown()).optional() });
const reviewDecisionSchema = z.object({ decision: z.enum(['approved','changes_requested','rejected']), note: z.string().max(2000).optional() });
const inventoryReservationsSchema = z.object({ reservations: z.array(z.object({ inventoryItemId: z.string().min(1), quantity: z.number().int().min(0) })).max(100), overrideReason: z.string().max(1000).optional() });

function requireLayoutAccess(layoutId: string, memberships: any[], permission: 'layouts.view' | 'layouts.edit' | 'layouts.publish') {
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

  app.get('/api/layouts/:id/collaboration', { preHandler: requireAuth }, async (req) => {
    const { id } = req.params as { id: string };
    requireLayoutAccess(id, req.auth!.memberships, 'layouts.view');
    return { comments: layoutCollaborationRepo.listComments(id), reviews: layoutCollaborationRepo.listReviews(id) };
  });

  app.post('/api/layouts/:id/comments', { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string }; const layout = requireLayoutAccess(id, req.auth!.memberships, 'layouts.edit');
    const parsed = commentSchema.safeParse(req.body); if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    return reply.code(201).send({ comment: layoutCollaborationRepo.addComment({ layoutId: id, orgId: layout.organization_id, eventId: layout.event_id, revision: layout.revision, authorUserId: req.auth!.userId, authorLabel: req.auth!.email, body: parsed.data.body, target: parsed.data.target }) });
  });

  app.post('/api/layouts/:id/review-request', { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string }; const layout = requireLayoutAccess(id, req.auth!.memberships, 'layouts.edit');
    const review = layoutCollaborationRepo.requestReview({ layoutId: id, orgId: layout.organization_id, eventId: layout.event_id, revision: layout.revision, userId: req.auth!.userId });
    return reply.code(201).send({ review });
  });

  app.post('/api/layouts/:id/reviews/:reviewId/decision', { preHandler: requireAuth }, async (req) => {
    const { id, reviewId } = req.params as { id: string; reviewId: string }; const layout = requireLayoutAccess(id, req.auth!.memberships, 'layouts.publish');
    const parsed = reviewDecisionSchema.safeParse(req.body); if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    const review = layoutCollaborationRepo.decideReview(reviewId, req.auth!.userId, parsed.data.decision, parsed.data.note);
    if (!review || (review as any).layout_id !== id) throw NotFound('review-not-found');
    const approvalStatus = parsed.data.decision === 'approved' ? 'approved' : parsed.data.decision === 'changes_requested' ? 'draft' : 'rejected';
    const saved = layoutsRepo.saveRevision({ layoutId: id, payload: JSON.parse(layout.payload), updatedBy: req.auth!.userId, expectedRevision: layout.revision, approvalStatus, changeDescription: parsed.data.note ?? `review ${parsed.data.decision}` });
    return { review, layout: saved };
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
    const photoUrl = parsed.data.photoDataUri ? savePrivateImageDataUri(parsed.data.photoDataUri, `layout_variance_${id}`) : parsed.data.photoUrl;
    const evidence = layoutOpsRepo.addVarianceEvidence({
      orgId: layout.organization_id,
      eventId: layout.event_id,
      layoutId: id,
      note: parsed.data.note,
      photoUrl,
      actorId: req.auth!.userId,
    });
    if (photoUrl && privateFilePath(photoUrl)) assetsRepo.create({ organization_id: layout.organization_id, event_id: layout.event_id, owner_type: 'layout_variance', owner_id: evidence.id, storage_key: photoUrl, original_filename: 'variance-evidence', mime_type: null, visibility: 'private', publish_status: 'draft', created_by: req.auth!.userId });
    return reply.code(201).send({ evidence });
  });

  app.get('/api/layouts/:id/variance-evidence/:evidenceId/content', { preHandler: requireAuth }, async (req, reply) => {
    const { id, evidenceId } = req.params as { id: string; evidenceId: string };
    requireLayoutAccess(id, req.auth!.memberships, 'layouts.view');
    const evidence = layoutOpsRepo.listForLayout(id).varianceEvidence.find((item) => item.id === evidenceId);
    if (!evidence?.photo_url) throw NotFound('evidence-file-not-found');
    const path = privateFilePath(evidence.photo_url);
    if (!path) return reply.redirect(evidence.photo_url);
    if (!existsSync(path)) throw NotFound('evidence-file-not-found');
    reply.header('Content-Type', 'image/*');
    return reply.send(createReadStream(path));
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

  app.get('/api/layouts/:id/inventory-reservations', { preHandler: requireAuth }, async (req) => {
    const { id } = req.params as { id: string }; const layout = requireLayoutAccess(id, req.auth!.memberships, 'layouts.view');
    return { reservations: db.prepare(`SELECT r.*, i.name, i.category, i.available_count FROM layout_inventory_reservations r JOIN inventory_items i ON i.id=r.inventory_item_id WHERE r.layout_id=? ORDER BY i.name`).all(id), sharedReviewEnabled: false, eventId: layout.event_id };
  });

  app.put('/api/layouts/:id/inventory-reservations', { preHandler: requireAuth }, async (req) => {
    const { id } = req.params as { id: string }; const layout = requireLayoutAccess(id, req.auth!.memberships, 'layouts.edit');
    const parsed = inventoryReservationsSchema.safeParse(req.body); if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    const requested = parsed.data.reservations.filter((item) => item.quantity > 0); const itemIds = [...new Set(requested.map((item) => item.inventoryItemId))];
    const inventory = itemIds.map((itemId) => inventoryRepo.findById(itemId));
    if (inventory.some((item) => !item || item.organization_id !== layout.organization_id)) throw BadRequest('invalid-inventory-item');
    const current = db.prepare(`SELECT inventory_item_id, quantity FROM layout_inventory_reservations WHERE layout_id=?`).all(id) as Array<{ inventory_item_id: string; quantity: number }>;
    const currentByItem = new Map(current.map((item) => [item.inventory_item_id, item.quantity]));
    const shortages = requested.flatMap((item) => { const stock = inventoryRepo.findById(item.inventoryItemId)!; const delta = item.quantity - (currentByItem.get(item.inventoryItemId) || 0); return delta > stock.available_count ? [{ inventoryItemId: item.inventoryItemId, requested: item.quantity, available: stock.available_count + (currentByItem.get(item.inventoryItemId) || 0) }] : []; });
    if (shortages.length && !parsed.data.overrideReason?.trim()) throw BadRequest('inventory-reservation-conflict', { shortages });
    db.transaction(() => {
      for (const item of current) { if (!requested.some((next) => next.inventoryItemId === item.inventory_item_id)) db.prepare(`UPDATE inventory_items SET available_count=available_count+? WHERE id=?`).run(item.quantity, item.inventory_item_id); }
      db.prepare(`DELETE FROM layout_inventory_reservations WHERE layout_id=?`).run(id);
      for (const item of requested) { const prior = currentByItem.get(item.inventoryItemId) || 0; const delta = item.quantity - prior; if (delta) db.prepare(`UPDATE inventory_items SET available_count=MAX(0,available_count-?) WHERE id=?`).run(delta, item.inventoryItemId); db.prepare(`INSERT INTO layout_inventory_reservations (id,layout_id,event_id,organization_id,inventory_item_id,quantity,override_reason,reserved_by) VALUES (?,?,?,?,?,?,?,?)`).run(uuid(), id, layout.event_id, layout.organization_id, item.inventoryItemId, item.quantity, parsed.data.overrideReason?.trim() || null, req.auth!.userId); }
    })();
    auditRepo.log({ organizationId: layout.organization_id, actorUserId: req.auth!.userId, actorLabel: req.auth!.email, action: 'layout.inventory.reserve', targetType: 'layout', targetId: id, ip: req.ip, details: { reservations: requested, override: !!parsed.data.overrideReason } });
    return { reservations: db.prepare(`SELECT r.*, i.name, i.category, i.available_count FROM layout_inventory_reservations r JOIN inventory_items i ON i.id=r.inventory_item_id WHERE r.layout_id=? ORDER BY i.name`).all(id) };
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
