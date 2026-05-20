/**
 * Loads the JWT, the user, and their memberships onto every authenticated
 * request. Downstream handlers call `can(req.auth.memberships, ...)` for
 * authorization.
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
  sub: string;
  email: string;
  sv: number;
}

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
  const userRow = db.prepare(
    `SELECT id, email, session_version, status FROM users WHERE id = ?`
  ).get(payload.sub) as
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

  const orgMems = db.prepare(
    `SELECT organization_id, role FROM organization_memberships
     WHERE user_id = ? AND status = 'active'`
  ).all(payload.sub) as Array<{ organization_id: string; role: AppRole }>;

  const eventMems = db.prepare(
    `SELECT event_id, role FROM event_memberships
     WHERE user_id = ? AND status = 'active'`
  ).all(payload.sub) as Array<{ event_id: string; role: AppRole }>;

  req.auth = {
    userId: userRow.id,
    email: userRow.email,
    memberships: [
      ...orgMems.map((m) => ({ organizationId: m.organization_id, role: m.role })),
      ...eventMems.map((m) => ({ eventId: m.event_id, role: m.role })),
    ],
  };
}
