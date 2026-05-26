import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { can } from '../lib/rbac.js';
import { vendorsRepo, auditRepo } from '../db/repos/index.js';
import { BadRequest, Forbidden, NotFound } from '../lib/errors.js';
const vendorSchema = z.object({
    name: z.string().min(1).max(200),
    category: z.string().max(40).optional(),
    contactName: z.string().max(200).optional(),
    email: z.string().email().max(254).optional().or(z.literal('')),
    phone: z.string().max(40).optional(),
    websiteUrl: z.string().url().max(2000).optional().or(z.literal('')),
    contractAmountCents: z.number().int().min(0).optional(),
    isPreferred: z.boolean().optional(),
    notes: z.string().max(4000).optional(),
    metadata: z.record(z.unknown()).optional(),
    eventId: z.string().nullable().optional(),
});
const paymentSchema = z.object({
    amountCents: z.number().int().positive(),
    paidAt: z.string().min(1),
    method: z.string().max(40).optional(),
    notes: z.string().max(2000).optional(),
});
export async function vendorRoutes(app) {
    app.get('/api/orgs/:orgId/vendors', { preHandler: requireAuth }, async (req) => {
        const { orgId } = req.params;
        const { eventId } = req.query;
        if (!can(req.auth.memberships, { organizationId: orgId }, 'vendors.view'))
            throw Forbidden();
        return { vendors: vendorsRepo.listForOrg(orgId, { eventId }) };
    });
    app.post('/api/orgs/:orgId/vendors', { preHandler: requireAuth }, async (req, reply) => {
        const { orgId } = req.params;
        if (!can(req.auth.memberships, { organizationId: orgId }, 'vendors.manage'))
            throw Forbidden();
        const parsed = vendorSchema.safeParse(req.body);
        if (!parsed.success)
            throw BadRequest('invalid-input', parsed.error.issues);
        const vendor = vendorsRepo.create(orgId, parsed.data);
        auditRepo.log({
            organizationId: orgId, actorUserId: req.auth.userId, actorLabel: req.auth.email,
            action: 'vendor.create', targetType: 'vendor', targetId: vendor.id, ip: req.ip,
        });
        return reply.code(201).send({ vendor });
    });
    app.patch('/api/vendors/:id', { preHandler: requireAuth }, async (req) => {
        const { id } = req.params;
        const v = vendorsRepo.findById(id);
        if (!v)
            throw NotFound();
        if (!can(req.auth.memberships, { organizationId: v.organization_id }, 'vendors.manage'))
            throw Forbidden();
        const parsed = vendorSchema.partial().safeParse(req.body);
        if (!parsed.success)
            throw BadRequest('invalid-input', parsed.error.issues);
        return { vendor: vendorsRepo.update(id, parsed.data) };
    });
    app.delete('/api/vendors/:id', { preHandler: requireAuth }, async (req, reply) => {
        const { id } = req.params;
        const v = vendorsRepo.findById(id);
        if (!v)
            throw NotFound();
        if (!can(req.auth.memberships, { organizationId: v.organization_id }, 'vendors.manage'))
            throw Forbidden();
        vendorsRepo.softDelete(id);
        return reply.code(204).send();
    });
    // Payments
    app.get('/api/vendors/:id/payments', { preHandler: requireAuth }, async (req) => {
        const { id } = req.params;
        const v = vendorsRepo.findById(id);
        if (!v)
            throw NotFound();
        if (!can(req.auth.memberships, { organizationId: v.organization_id }, 'vendors.view'))
            throw Forbidden();
        return { payments: vendorsRepo.listPayments(id) };
    });
    app.post('/api/vendors/:id/payments', { preHandler: requireAuth }, async (req, reply) => {
        const { id } = req.params;
        const v = vendorsRepo.findById(id);
        if (!v)
            throw NotFound();
        if (!can(req.auth.memberships, { organizationId: v.organization_id }, 'vendors.manage'))
            throw Forbidden();
        const parsed = paymentSchema.safeParse(req.body);
        if (!parsed.success)
            throw BadRequest('invalid-input', parsed.error.issues);
        return reply.code(201).send({ payment: vendorsRepo.addPayment(id, parsed.data) });
    });
}
//# sourceMappingURL=vendors.js.map