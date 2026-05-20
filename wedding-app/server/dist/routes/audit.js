import { requireAuth } from '../middleware/auth.js';
import { can } from '../lib/rbac.js';
import { auditRepo } from '../db/repos/index.js';
import { Forbidden } from '../lib/errors.js';
export async function auditRoutes(app) {
    app.get('/api/orgs/:orgId/audit', { preHandler: requireAuth }, async (req) => {
        const { orgId } = req.params;
        const { limit, action } = req.query;
        if (!can(req.auth.memberships, { organizationId: orgId }, 'audit.view'))
            throw Forbidden();
        return {
            logs: auditRepo.listForOrg(orgId, {
                limit: limit ? Number(limit) : undefined,
                action,
            }),
        };
    });
}
//# sourceMappingURL=audit.js.map