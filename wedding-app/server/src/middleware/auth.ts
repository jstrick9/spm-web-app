/**
 * JWT verification + membership loading.
 *
 * Memberships now reference roles.id. We also load role.key and role.name
 * on the auth payload so clients can display them without an extra query.
 */
import type { FastifyReply, FastifyRequest } from 'fastify';
import { db } from '../db/database.js';
import type { Membership } from '../lib/rbac.js';

declare module 'fastify' {
  interface FastifyRequest {
    auth?: {
      userId: string;
      email: string;
      sessionVersion: number;
      memberships: Array<Membership & { roleKey: string; roleName: string; eventOrganizationId?: string; permissions?: string[] }>;
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
    `SELECT om.organization_id, om.role_id, r.key AS role_key, r.name AS role_name
     FROM organization_memberships om
     JOIN roles r ON r.id = om.role_id
     WHERE om.user_id = ? AND om.status = 'active'`
  ).all(payload.sub) as Array<{ organization_id: string; role_id: string; role_key: string; role_name: string }>;

  const eventMems = db.prepare(
    `SELECT em.event_id, e.organization_id AS event_organization_id, em.role_id, r.key AS role_key, r.name AS role_name
     FROM event_memberships em
     JOIN events e ON e.id = em.event_id
     JOIN roles r ON r.id = em.role_id
     WHERE em.user_id = ? AND em.status = 'active' AND e.deleted_at IS NULL`
  ).all(payload.sub) as Array<{ event_id: string; event_organization_id: string; role_id: string; role_key: string; role_name: string }>;

  const memberships = [
    ...orgMems.map((m) => ({
      organizationId: m.organization_id,
      roleId: m.role_id, roleKey: m.role_key, roleName: m.role_name,
    })),
    ...eventMems.map((m) => ({
      eventId: m.event_id,
      eventOrganizationId: m.event_organization_id,
      roleId: m.role_id, roleKey: m.role_key, roleName: m.role_name,
    })),
  ];

  // Effective permission ids per role, embedded in each membership so the
  // client can resolve usePermission() WITHOUT calling GET /api/orgs/:id/roles
  // (that endpoint requires roles.view, which staff does not have — staff
  // used to get an empty permission map and an AccessRestricted home screen).
  const roleIds = [...new Set(memberships.map((m) => m.roleId))];
  const permsByRole = new Map<string, Set<string>>();
  if (roleIds.length > 0) {
    const rows = db.prepare(
      `SELECT role_id, permission_id FROM role_permissions WHERE role_id IN (${roleIds.map(() => '?').join(',')})`
    ).all(...roleIds) as Array<{ role_id: string; permission_id: string }>;
    for (const row of rows) {
      let set = permsByRole.get(row.role_id);
      if (!set) { set = new Set(); permsByRole.set(row.role_id, set); }
      set.add(row.permission_id);
    }
  }

  req.auth = {
    userId: userRow.id,
    email: userRow.email,
    sessionVersion: userRow.session_version,
    memberships: memberships.map((m) => ({
      ...m,
      permissions: [...(permsByRole.get(m.roleId) ?? [])],
    })),
  };
}
