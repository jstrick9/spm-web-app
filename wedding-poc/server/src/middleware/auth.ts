/**
 * Fastify request decorator + preHandler that:
 *   1. Verifies the JWT.
 *   2. Loads the user's memberships in one query.
 *   3. Attaches { userId, memberships } to the request for downstream handlers.
 *
 * Downstream handlers then call `can(req.memberships, scope, 'permission.id')`
 * from lib/rbac.ts — never inspect role strings ad-hoc.
 */
import type { FastifyReply, FastifyRequest } from 'fastify';
import { db } from '../db/database.js';
import type { AppRole, Membership } from '../lib/rbac.js';

declare module 'fastify' {
  interface FastifyRequest {
    auth?: {
      userId: string;
      email: string;
      memberships: Membership[];
    };
  }
}

interface JwtPayload {
  sub: string;     // user id
  email: string;
  sv: number;      // session_version snapshot
}

const stmtUser = db.prepare<[string]>(
  `SELECT id, email, session_version, status FROM users WHERE id = ?`
);

const stmtOrgMemberships = db.prepare<[string]>(
  `SELECT organization_id, role FROM organization_memberships
   WHERE user_id = ? AND status = 'active'`
);

const stmtEventMemberships = db.prepare<[string]>(
  `SELECT event_id, role FROM event_memberships
   WHERE user_id = ? AND status = 'active'`
);

export async function requireAuth(
  req: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  try {
    await req.jwtVerify();
  } catch {
    reply.code(401).send({ error: 'unauthenticated' });
    return;
  }

  const payload = req.user as JwtPayload;
  const userRow = stmtUser.get(payload.sub) as
    | { id: string; email: string; session_version: number; status: string }
    | undefined;

  if (!userRow || userRow.status !== 'active') {
    reply.code(401).send({ error: 'user-disabled' });
    return;
  }
  if (userRow.session_version !== payload.sv) {
    reply.code(401).send({ error: 'session-invalidated' });
    return;
  }

  const orgMems = stmtOrgMemberships.all(payload.sub) as Array<{
    organization_id: string;
    role: AppRole;
  }>;
  const eventMems = stmtEventMemberships.all(payload.sub) as Array<{
    event_id: string;
    role: AppRole;
  }>;

  const memberships: Membership[] = [
    ...orgMems.map((m) => ({ organizationId: m.organization_id, role: m.role })),
    ...eventMems.map((m) => ({ eventId: m.event_id, role: m.role })),
  ];

  req.auth = {
    userId: userRow.id,
    email: userRow.email,
    memberships,
  };
}
