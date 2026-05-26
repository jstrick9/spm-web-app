import { db } from '../db/database.js';
export async function requireAuth(req, reply) {
    try {
        await req.jwtVerify();
    }
    catch {
        reply.code(401).send({ error: 'unauthenticated' });
        return;
    }
    const payload = req.user;
    const userRow = db.prepare(`SELECT id, email, session_version, status FROM users WHERE id = ?`).get(payload.sub);
    if (!userRow || userRow.status !== 'active') {
        reply.code(401).send({ error: 'user-disabled' });
        return;
    }
    if (userRow.session_version !== payload.sv) {
        reply.code(401).send({ error: 'session-invalidated' });
        return;
    }
    const orgMems = db.prepare(`SELECT om.organization_id, om.role_id, r.key AS role_key, r.name AS role_name
     FROM organization_memberships om
     JOIN roles r ON r.id = om.role_id
     WHERE om.user_id = ? AND om.status = 'active'`).all(payload.sub);
    const eventMems = db.prepare(`SELECT em.event_id, em.role_id, r.key AS role_key, r.name AS role_name
     FROM event_memberships em
     JOIN roles r ON r.id = em.role_id
     WHERE em.user_id = ? AND em.status = 'active'`).all(payload.sub);
    req.auth = {
        userId: userRow.id,
        email: userRow.email,
        memberships: [
            ...orgMems.map((m) => ({
                organizationId: m.organization_id,
                roleId: m.role_id, roleKey: m.role_key, roleName: m.role_name,
            })),
            ...eventMems.map((m) => ({
                eventId: m.event_id,
                roleId: m.role_id, roleKey: m.role_key, roleName: m.role_name,
            })),
        ],
    };
}
//# sourceMappingURL=auth.js.map