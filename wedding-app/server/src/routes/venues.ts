import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { can } from '../lib/rbac.js';
import { venuesRepo, auditRepo } from '../db/repos/index.js';
import { BadRequest, Forbidden, NotFound } from '../lib/errors.js';
import { saveDataUri } from '../lib/fileStorage.js';

const venueSchema = z.object({
  name:          z.string().min(1).max(200),
  category:      z.string().max(40).optional(),
  environment:   z.enum(['indoor','outdoor','both']).optional(),
  description:   z.string().max(4000).optional(),
  capacity:      z.number().int().min(0).optional(),
  width:         z.number().min(0).optional(),
  height:        z.number().min(0).optional(),
  canvasWidth:   z.number().min(0).optional(),
  canvasHeight:  z.number().min(0).optional(),
  shape:         z.record(z.unknown()).optional(),
  style:         z.record(z.unknown()).optional(),
  masterLayout:  z.record(z.unknown()).optional(),
  metadata:      z.record(z.unknown()).optional(),
  unitSystem:    z.enum(['imperial','metric']).optional(),
  templateKey:   z.enum(['custom','ceremony','cocktail','reception','outdoor_tent']).optional(),
  approvalStatus:z.enum(['draft','approved','archived']).optional(),
  underlay:      z.record(z.unknown()).optional(),
});

export async function venueRoutes(app: FastifyInstance) {
  app.get('/api/orgs/:orgId/venues', { preHandler: requireAuth }, async (req) => {
    const { orgId } = req.params as { orgId: string };
    if (!can(req.auth!.memberships, { organizationId: orgId }, 'venues.view')) throw Forbidden();
    return { venues: venuesRepo.listForOrg(orgId) };
  });

  app.post('/api/orgs/:orgId/venues', { preHandler: requireAuth }, async (req, reply) => {
    const { orgId } = req.params as { orgId: string };
    if (!can(req.auth!.memberships, { organizationId: orgId }, 'venues.manage')) throw Forbidden();
    const parsed = venueSchema.safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    const venue = venuesRepo.create(orgId, req.auth!.userId, parsed.data);
    auditRepo.log({
      organizationId: orgId, actorUserId: req.auth!.userId, actorLabel: req.auth!.email,
      action: 'venue.create', targetType: 'venue', targetId: venue.id, ip: req.ip,
    });
    return reply.code(201).send({ venue });
  });

  app.patch('/api/venues/:id', { preHandler: requireAuth }, async (req) => {
    const { id } = req.params as { id: string };
    const venue = venuesRepo.findById(id);
    if (!venue) throw NotFound();
    if (!can(req.auth!.memberships, { organizationId: venue.organization_id }, 'venues.manage')) throw Forbidden();
    const parsed = venueSchema.partial().safeParse(req.body);
    if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);
    return { venue: venuesRepo.update(id, parsed.data) };
  });

  app.post('/api/venues/:id/underlay', { preHandler: requireAuth, bodyLimit: 12 * 1024 * 1024 }, async (req) => {
    const { id } = req.params as { id: string };
    const venue = venuesRepo.findById(id);
    if (!venue) throw NotFound();
    if (!can(req.auth!.memberships, { organizationId: venue.organization_id }, 'venues.manage')) throw Forbidden();
    const dataUri = (req.body as { dataUri?: unknown })?.dataUri;
    if (typeof dataUri !== 'string') throw BadRequest('underlay-required');
    const url = saveDataUri(dataUri, `venue_underlay_${id}`);
    const current = (() => { try { return JSON.parse(venue.underlay || '{}'); } catch { return {}; } })();
    const updated = venuesRepo.update(id, { underlay: { ...current, url, locked: true, opacity: 0.55, scale: 1, rotation: 0 } });
    return { venue: updated };
  });

  app.delete('/api/venues/:id', { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const venue = venuesRepo.findById(id);
    if (!venue) throw NotFound();
    if (!can(req.auth!.memberships, { organizationId: venue.organization_id }, 'venues.manage')) throw Forbidden();
    venuesRepo.softDelete(id);
    return reply.code(204).send();
  });
}
