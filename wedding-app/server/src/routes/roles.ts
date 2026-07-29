/**
 * Roles REST endpoints.
 *
 *   GET    /api/orgs/:orgId/roles                 list system + org-custom roles
 *   GET    /api/orgs/:orgId/roles/permissions     the catalog (for the UI editor)
 *   POST   /api/orgs/:orgId/roles                 create custom role
 *   PATCH  /api/roles/:id                          update custom role (system roles rejected)
 *   DELETE /api/roles/:id                          delete custom role (system roles + in-use roles rejected)
 *
 *   POST   /api/orgs/:orgId/members                add user with role
 *   PATCH  /api/orgs/:orgId/members/:userId        change a user's role in the org
 *   DELETE /api/orgs/:orgId/members/:userId        remove user from org
 *
 * Permission gating: anything that lists requires `roles.view`; anything
 * that mutates requires `roles.manage` (granted to owner + admin by default).
 */
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { assertCan } from '../lib/rbac.js';
import { auditRepo, eventsRepo, orgsRepo, rolesRepo, teamInvitationsRepo, usersRepo } from '../db/repos/index.js';
import { BadRequest, Forbidden, NotFound } from '../lib/errors.js';
import { deliverTeamInvitation } from '../lib/teamInviteDelivery.js';
import { isValidPermissionId, type PermissionId } from '../lib/permissions.js';

const KEY_RE = /^[a-z0-9][a-z0-9_-]{1,49}$/;

const createRoleSchema = z.object({
  key:         z.string().regex(KEY_RE,
                  'key must be lowercase, 2-50 chars, [a-z0-9_-]'),
  name:        z.string().min(1).max(120),
  description: z.string().max(2000).optional(),
  hierarchy:   z.number().int().min(0).max(99).optional(),
  permissions: z.array(z.string()).min(0),
  // Optional: copy from another role's permission set as a starting point
  copyFrom:    z.string().optional(),
});

const updateRoleSchema = z.object({
  name:        z.string().min(1).max(120).optional(),
  description: z.string().max(2000).optional(),
  hierarchy:   z.number().int().min(0).max(99).optional(),
  permissions: z.array(z.string()).optional(),
});

const addMemberSchema = z.object({
  userEmail: z.string().email(),
  roleId:    z.string().min(1),
});

const inviteMemberSchema = z.object({
  email: z.string().email(),
  roleId: z.string().min(1),
});

const inviteEventMemberSchema = z.object({
  email: z.string().email(),
  roleId: z.string().min(1).optional(),
  roleKey: z.enum(['couple', 'planner']).default('couple'),
});

const updateMemberRoleSchema = z.object({
  roleId: z.string().min(1),
});

function validatePermissions(ids: string[]): PermissionId[] {
  const bad = ids.filter((p) => !isValidPermissionId(p));
  if (bad.length > 0) {
    throw BadRequest('unknown-permission', { unknown: bad });
  }
  return ids as PermissionId[];
}

function isVenueOwnerOrManager(memberships: any[], organizationId: string) {
  return memberships.some((membership) => membership.organizationId === organizationId && ['owner', 'manager'].includes(String(membership.roleKey).toLowerCase()));
}

export async function roleRoutes(app: FastifyInstance) {
  // ─── Catalog: every permission id known to the app ────
  // Used by the admin UI to render the role editor checkboxes.
  app.get(
    '/api/orgs/:orgId/roles/permissions',
    { preHandler: requireAuth },
    async (req) => {
      const { orgId } = req.params as { orgId: string };
      assertCan(req.auth!.memberships, { organizationId: orgId }, 'roles.view');
      return { catalog: rolesRepo.permissionCatalog() };
    },
  );

  // ─── List roles (system + org-custom) ──────────────────
  app.get(
    '/api/orgs/:orgId/roles',
    { preHandler: requireAuth },
    async (req) => {
      const { orgId } = req.params as { orgId: string };
      assertCan(req.auth!.memberships, { organizationId: orgId }, 'roles.view');
      return { roles: rolesRepo.listForOrg(orgId) };
    },
  );

  // ─── Create custom role ────────────────────────────────
  app.post(
    '/api/orgs/:orgId/roles',
    { preHandler: requireAuth },
    async (req, reply) => {
      const { orgId } = req.params as { orgId: string };
      assertCan(req.auth!.memberships, { organizationId: orgId }, 'roles.manage');

      const parsed = createRoleSchema.safeParse(req.body);
      if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);

      // If copyFrom is provided, start from that role's permission set,
      // then union with explicit `permissions`.
      let perms = parsed.data.permissions;
      if (parsed.data.copyFrom) {
        const base = rolesRepo.findById(parsed.data.copyFrom);
        if (!base) throw BadRequest('copy-source-not-found');
        // The copy source must be available to this org (system OR same-org).
        if (base.organization_id && base.organization_id !== orgId) {
          throw Forbidden();
        }
        perms = Array.from(new Set([...base.permissions, ...perms]));
      }

      const role = rolesRepo.createCustom({
        organizationId: orgId,
        key: parsed.data.key,
        name: parsed.data.name,
        description: parsed.data.description,
        hierarchy: parsed.data.hierarchy,
        permissions: validatePermissions(perms),
        createdBy: req.auth!.userId,
      });

      auditRepo.log({
        organizationId: orgId, actorUserId: req.auth!.userId,
        actorLabel: req.auth!.email, action: 'role.create',
        targetType: 'role', targetId: role.id, ip: req.ip,
        details: { key: role.key, name: role.name, permissionCount: role.permissions.length },
      });

      return reply.code(201).send({ role });
    },
  );

  // ─── Update custom role ────────────────────────────────
  app.patch(
    '/api/roles/:id',
    { preHandler: requireAuth },
    async (req) => {
      const { id } = req.params as { id: string };
      const role = rolesRepo.findById(id);
      if (!role) throw NotFound('role-not-found');
      if (role.is_system) {
        // Don't even let the caller think they're authorized
        throw BadRequest('system-role-immutable');
      }
      assertCan(req.auth!.memberships, { organizationId: role.organization_id! }, 'roles.manage');

      const parsed = updateRoleSchema.safeParse(req.body);
      if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);

      const updated = rolesRepo.updateCustom(id, {
        ...parsed.data,
        permissions: parsed.data.permissions ? validatePermissions(parsed.data.permissions) : undefined,
      });

      auditRepo.log({
        organizationId: role.organization_id!, actorUserId: req.auth!.userId,
        actorLabel: req.auth!.email, action: 'role.update',
        targetType: 'role', targetId: id, ip: req.ip,
      });

      return { role: updated };
    },
  );

  // ─── Delete custom role ────────────────────────────────
  app.delete(
    '/api/roles/:id',
    { preHandler: requireAuth },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const role = rolesRepo.findById(id);
      if (!role) throw NotFound('role-not-found');
      if (role.is_system) throw BadRequest('system-role-immutable');
      assertCan(req.auth!.memberships, { organizationId: role.organization_id! }, 'roles.manage');

      rolesRepo.deleteCustom(id);

      auditRepo.log({
        organizationId: role.organization_id!, actorUserId: req.auth!.userId,
        actorLabel: req.auth!.email, action: 'role.delete',
        targetType: 'role', targetId: id, ip: req.ip,
      });

      return reply.code(204).send();
    },
  );

  // ─── Memberships: list/add/update/remove ──────────────
  app.get(
    '/api/orgs/:orgId/members',
    { preHandler: requireAuth },
    async (req) => {
      const { orgId } = req.params as { orgId: string };
      assertCan(req.auth!.memberships, { organizationId: orgId }, 'org.view');
      return { members: orgsRepo.listMembers(orgId) };
    },
  );

  app.get(
    '/api/orgs/:orgId/team-invitations',
    { preHandler: requireAuth },
    async (req) => {
      const { orgId } = req.params as { orgId: string };
      assertCan(req.auth!.memberships, { organizationId: orgId }, 'org.members.invite');
      return { invitations: teamInvitationsRepo.listForOrg(orgId).map((i) => ({
        id: i.id,
        organization_id: i.organization_id,
        email: i.email,
        role_id: i.role_id,
        expires_at: i.expires_at,
        accepted_at: i.accepted_at,
        revoked_at: i.revoked_at,
        invited_by: i.invited_by,
        created_at: i.created_at,
      })) };
    },
  );

  app.post(
    '/api/events/:eventId/couple-invitations',
    { preHandler: requireAuth, config: { rateLimit: { max: 20, timeWindow: '1 minute' } } },
    async (req, reply) => {
      const { eventId } = req.params as { eventId: string };
      const event = eventsRepo.findById(eventId);
      if (!event) throw NotFound('event-not-found');
      const orgMap = eventsRepo.orgMapForUser(req.auth!.userId);
      assertCan(req.auth!.memberships, { eventId }, 'events.members.invite', orgMap);
      if (!isVenueOwnerOrManager(req.auth!.memberships, event.organization_id)) throw Forbidden();
      const parsed = inviteEventMemberSchema.safeParse(req.body);
      if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);

      const role = parsed.data.roleId ? rolesRepo.findById(parsed.data.roleId) : rolesRepo.findByKey(null, parsed.data.roleKey);
      if (!role) throw BadRequest('role-not-found');
      if (!['couple', 'planner'].includes(role.key)) throw BadRequest('event-invite-role-not-allowed');
      if (role.organization_id && role.organization_id !== event.organization_id) throw Forbidden();

      const existing = usersRepo.findByEmail(parsed.data.email);
      if (existing) {
        eventsRepo.addMember({ eventId, userId: existing.id, roleId: role.id });
        auditRepo.log({
          organizationId: event.organization_id,
          actorUserId: req.auth!.userId,
          actorLabel: req.auth!.email,
          action: 'event.member.invite.existing_user',
          targetType: 'user',
          targetId: existing.id,
          ip: req.ip,
          details: { email: parsed.data.email, roleKey: role.key, eventId },
        });
        return reply.code(201).send({ ok: true, status: 'added_existing_user', eventId, roleKey: role.key });
      }

      const invitation = teamInvitationsRepo.create({
        organizationId: event.organization_id,
        eventId,
        invitationType: 'event',
        email: parsed.data.email,
        roleId: role.id,
        invitedBy: req.auth!.userId,
      });
      let delivery: Record<string, unknown> = {};
      try {
        delivery = await deliverTeamInvitation({ invitation: invitation.row, token: invitation.token });
      } catch (err) {
        delivery = { channel: 'failed', error: (err as Error).message };
      }
      auditRepo.log({
        organizationId: event.organization_id,
        actorUserId: req.auth!.userId,
        actorLabel: req.auth!.email,
        action: 'event.member.invite.pending_user',
        targetType: 'team_invitation',
        targetId: invitation.row.id,
        ip: req.ip,
        details: { email: parsed.data.email, roleKey: role.key, eventId, delivery },
      });
      return reply.code(201).send({
        ok: true,
        status: 'invitation_sent',
        eventId,
        roleKey: role.key,
        invitation: { id: invitation.row.id, email: invitation.row.email, role_id: invitation.row.role_id, event_id: invitation.row.event_id, expires_at: invitation.row.expires_at },
        ...(process.env.NODE_ENV !== 'production' || process.env.TEST_DB === ':memory:' ? { token: invitation.token } : {}),
      });
    },
  );

  app.post(
    '/api/orgs/:orgId/team-invitations',
    { preHandler: requireAuth, config: { rateLimit: { max: 20, timeWindow: '1 minute' } } },
    async (req, reply) => {
      const { orgId } = req.params as { orgId: string };
      assertCan(req.auth!.memberships, { organizationId: orgId }, 'org.members.invite');
      const parsed = inviteMemberSchema.safeParse(req.body);
      if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);

      const role = rolesRepo.findById(parsed.data.roleId);
      if (!role) throw BadRequest('role-not-found');
      if (role.organization_id && role.organization_id !== orgId) throw Forbidden();

      const existing = usersRepo.findByEmail(parsed.data.email);
      if (existing) {
        try {
          orgsRepo.addMember({ orgId, userId: existing.id, roleId: role.id, invitedBy: req.auth!.userId });
        } catch (err) {
          if ((err as { code?: string }).code !== 'SQLITE_CONSTRAINT_UNIQUE') throw err;
        }
        auditRepo.log({
          organizationId: orgId,
          actorUserId: req.auth!.userId,
          actorLabel: req.auth!.email,
          action: 'member.invite.existing_user',
          targetType: 'user',
          targetId: existing.id,
          ip: req.ip,
          details: { email: parsed.data.email, roleKey: role.key },
        });
        return reply.code(201).send({ ok: true, status: 'added_existing_user' });
      }

      const invitation = teamInvitationsRepo.create({
        organizationId: orgId,
        email: parsed.data.email,
        roleId: role.id,
        invitedBy: req.auth!.userId,
      });
      let delivery: Record<string, unknown> = {};
      try {
        delivery = await deliverTeamInvitation({ invitation: invitation.row, token: invitation.token });
      } catch (err) {
        delivery = { channel: 'failed', error: (err as Error).message };
      }
      auditRepo.log({
        organizationId: orgId,
        actorUserId: req.auth!.userId,
        actorLabel: req.auth!.email,
        action: 'member.invite.pending_user',
        targetType: 'team_invitation',
        targetId: invitation.row.id,
        ip: req.ip,
        details: { email: parsed.data.email, roleKey: role.key, delivery },
      });
      return reply.code(201).send({
        ok: true,
        status: 'invitation_sent',
        invitation: { id: invitation.row.id, email: invitation.row.email, role_id: invitation.row.role_id, expires_at: invitation.row.expires_at },
        ...(process.env.NODE_ENV !== 'production' || process.env.TEST_DB === ':memory:' ? { token: invitation.token } : {}),
      });
    },
  );

  app.post(
    '/api/orgs/:orgId/members',
    { preHandler: requireAuth },
    async (req, reply) => {
      const { orgId } = req.params as { orgId: string };
      assertCan(req.auth!.memberships, { organizationId: orgId }, 'org.members.invite');

      const parsed = addMemberSchema.safeParse(req.body);
      if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);

      const user = usersRepo.findByEmail(parsed.data.userEmail);
      if (!user) throw NotFound('user-not-found');

      // Validate the role exists AND is usable by this org
      const role = rolesRepo.findById(parsed.data.roleId);
      if (!role) throw BadRequest('role-not-found');
      if (role.organization_id && role.organization_id !== orgId) {
        throw Forbidden();  // can't assign another org's custom role
      }

      try {
        orgsRepo.addMember({
          orgId, userId: user.id, roleId: role.id, invitedBy: req.auth!.userId,
        });
      } catch (err) {
        if ((err as { code?: string }).code === 'SQLITE_CONSTRAINT_UNIQUE') {
          throw BadRequest('user-already-member');
        }
        throw err;
      }

      auditRepo.log({
        organizationId: orgId, actorUserId: req.auth!.userId,
        actorLabel: req.auth!.email, action: 'member.add',
        targetType: 'user', targetId: user.id, ip: req.ip,
        details: { roleKey: role.key, roleName: role.name },
      });

      return reply.code(201).send({ ok: true });
    },
  );

  app.patch(
    '/api/orgs/:orgId/members/:userId',
    { preHandler: requireAuth },
    async (req) => {
      const { orgId, userId } = req.params as { orgId: string; userId: string };
      assertCan(req.auth!.memberships, { organizationId: orgId }, 'org.members.invite');
      const parsed = updateMemberRoleSchema.safeParse(req.body);
      if (!parsed.success) throw BadRequest('invalid-input', parsed.error.issues);

      const role = rolesRepo.findById(parsed.data.roleId);
      if (!role) throw BadRequest('role-not-found');
      if (role.organization_id && role.organization_id !== orgId) throw Forbidden();

      const updated = orgsRepo.updateMemberRole(orgId, userId, role.id);
      if (!updated) throw NotFound('membership-not-found');

      auditRepo.log({
        organizationId: orgId, actorUserId: req.auth!.userId,
        actorLabel: req.auth!.email, action: 'member.role.update',
        targetType: 'user', targetId: userId, ip: req.ip,
        details: { newRoleKey: role.key },
      });

      return { ok: true };
    },
  );

  app.delete(
    '/api/orgs/:orgId/members/:userId',
    { preHandler: requireAuth },
    async (req, reply) => {
      const { orgId, userId } = req.params as { orgId: string; userId: string };
      assertCan(req.auth!.memberships, { organizationId: orgId }, 'org.members.remove');
      // Block removing the org owner via this endpoint
      const org = orgsRepo.findById(orgId);
      if (org?.owner_id === userId) throw BadRequest('cannot-remove-owner');
      const ok = orgsRepo.removeMember(orgId, userId);
      if (!ok) throw NotFound('membership-not-found');

      auditRepo.log({
        organizationId: orgId, actorUserId: req.auth!.userId,
        actorLabel: req.auth!.email, action: 'member.remove',
        targetType: 'user', targetId: userId, ip: req.ip,
      });
      return reply.code(204).send();
    },
  );
}
