import { db } from '../db/database.js';
const stmtUser = db.prepare(`SELECT id, email, session_version, status FROM users WHERE id = ?`);
const stmtOrgMemberships = db.prepare(`SELECT organization_id, role FROM organization_memberships
   WHERE user_id = ? AND status = 'active'`);
const stmtEventMemberships = db.prepare(`SELECT event_id, role FROM event_memberships
   WHERE user_id = ? AND status = 'active'`);
export async function requireAuth(req, reply) {
    try {
        await req.jwtVerify();
    }
    catch {
        reply.code(401).send({ error: 'unauthenticated' });
        return;
    }
    const payload = req.user;
    const userRow = stmtUser.get(payload.sub);
    if (!userRow || userRow.status !== 'active') {
        reply.code(401).send({ error: 'user-disabled' });
        return;
    }
    if (userRow.session_version !== payload.sv) {
        reply.code(401).send({ error: 'session-invalidated' });
        return;
    }
    const orgMems = stmtOrgMemberships.all(payload.sub);
    const eventMems = stmtEventMemberships.all(payload.sub);
    const memberships = [
        ...orgMems.map((m) => ({ organizationId: m.organization_id, role: m.role })),
        ...eventMems.map((m) => ({ eventId: m.event_id, role: m.role })),
    ];
    req.auth = {
        userId: userRow.id,
        email: userRow.email,
        memberships,
    };
}
//# sourceMappingURL=auth.js.map