import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { can } from '../lib/rbac.js';
import { venuesRepo, auditRepo } from '../db/repos/index.js';
import { BadRequest, Forbidden, NotFound } from '../lib/errors.js';
const venueSchema = z.object({
    name: z.string().min(1).max(200),
    category: z.string().max(40).optional(),
    environment: z.enum(['indoor', 'outdoor', 'both']).optional(),
    description: z.string().max(4000).optional(),
    capacity: z.number().int().min(0).optional(),
    width: z.number().min(0).optional(),
    height: z.number().min(0).optional(),
    canvasWidth: z.number().min(0).optional(),
    canvasHeight: z.number().min(0).optional(),
    shape: z.record(z.unknown()).optional(),
    style: z.record(z.unknown()).optional(),
    masterLayout: z.record(z.unknown()).optional(),
    metadata: z.record(z.unknown()).optional(),
});
export async function venueRoutes(app) {
    app.get('/api/orgs/:orgId/venues', { preHandler: requireAuth }, async (req) => {
        const { orgId } = req.params;
        if (!can(req.auth.memberships, { organizationId: orgId }, 'venues.view'))
            throw Forbidden();
        return { venues: venuesRepo.listForOrg(orgId) };
    });
    app.post('/api/orgs/:orgId/venues', { preHandler: requireAuth }, async (req, reply) => {
        const { orgId } = req.params;
        if (!can(req.auth.memberships, { organizationId: orgId }, 'venues.manage'))
            throw Forbidden();
        const parsed = venueSchema.safeParse(req.body);
        if (!parsed.success)
            throw BadRequest('invalid-input', parsed.error.issues);
        const venue = venuesRepo.create(orgId, req.auth.userId, parsed.data);
        auditRepo.log({
            organizationId: orgId, actorUserId: req.auth.userId, actorLabel: req.auth.email,
            action: 'venue.create', targetType: 'venue', targetId: venue.id, ip: req.ip,
        });
        return reply.code(201).send({ venue });
    });
    app.patch('/api/venues/:id', { preHandler: requireAuth }, async (req) => {
        const { id } = req.params;
        const venue = venuesRepo.findById(id);
        if (!venue)
            throw NotFound();
        if (!can(req.auth.memberships, { organizationId: venue.organization_id }, 'venues.manage'))
            throw Forbidden();
        const parsed = venueSchema.partial().safeParse(req.body);
        if (!parsed.success)
            throw BadRequest('invalid-input', parsed.error.issues);
        return { venue: venuesRepo.update(id, parsed.data) };
    });
    app.delete('/api/venues/:id', { preHandler: requireAuth }, async (req, reply) => {
        const { id } = req.params;
        const venue = venuesRepo.findById(id);
        if (!venue)
            throw NotFound();
        if (!can(req.auth.memberships, { organizationId: venue.organization_id }, 'venues.manage'))
            throw Forbidden();
        venuesRepo.softDelete(id);
        return reply.code(204).send();
    });
}
//# sourceMappingURL=venues.js.map