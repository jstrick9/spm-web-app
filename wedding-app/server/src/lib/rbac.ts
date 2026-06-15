/**
 * RBAC resolver — now backed by the `roles` + `role_permissions` tables.
 *
 * External API is unchanged from Phase 1:
 *   - can(memberships, scope, permission, eventOrgMap?)
 *   - assertCan(memberships, scope, permission, eventOrgMap?)
 *   - resolvePermissions(memberships, scope, eventOrgMap?)
 *
 * Internally, memberships now carry a `roleId` (not a hard-coded role
 * string), and permission lookup is a DB query (with a small per-process
 * cache). System roles have predictable ids ('sys_owner', 'sys_admin', ...).
 *
 * Custom roles are created at runtime via /api/orgs/:id/roles and stored
 * in the same tables.
 *
 * Cache invalidation: rolesRepo.* mutations clear the cache. Worst case
 * (race between an update and a check) is one stale permission check; the
 * next request rebuilds the cache.
 */
import { db } from '../db/database.js';
import type { PermissionId } from './permissions.js';
import { isValidPermissionId } from './permissions.js';

export type { PermissionId } from './permissions.js';

// AppRole is now just the system-role key, kept as a type alias for places
// that want to refer to "the kind of role" (e.g. when seeding the demo
// org we want to grant the user the system 'owner' role).
export type AppRole =
  | 'owner' | 'admin' | 'manager' | 'planner' | 'couple' | 'staff' | 'vendor' | 'guest';

/**
 * A membership ties a user to a scope (org OR event) via a role id.
 * The role id is a stable string for system roles and a uuid for custom
 * roles.
 */
export interface Membership {
  organizationId?: string;
  eventId?: string;
  roleId: string;
}

export interface Scope {
  organizationId?: string;
  eventId?: string;
}

// ─── Cache ──────────────────────────────────────────────
// In-process cache of roleId -> Set<PermissionId>. Cleared whenever a
// role's permissions change (see invalidateRoleCache, called from
// rolesRepo).

const _cache = new Map<string, Set<PermissionId>>();

export function invalidateRoleCache(roleId?: string): void {
  if (roleId) _cache.delete(roleId);
  else _cache.clear();
}

function permissionsForRole(roleId: string): Set<PermissionId> {
  const cached = _cache.get(roleId);
  if (cached) return cached;
  const rows = db.prepare(
    `SELECT permission_id FROM role_permissions WHERE role_id = ?`
  ).all(roleId) as Array<{ permission_id: string }>;
  const out = new Set<PermissionId>();
  for (const r of rows) {
    if (isValidPermissionId(r.permission_id)) out.add(r.permission_id);
  }
  _cache.set(roleId, out);
  return out;
}

// ─── The resolver ───────────────────────────────────────
/**
 * Returns the union of permissions granted to a user via any membership
 * that matches the scope.
 *
 *   - empty scope: union over ALL memberships
 *   - org scope set: org memberships matching the org count; event
 *     memberships for events in that org count (via eventOrgMap)
 *   - event scope set: event memberships matching the event count; org
 *     memberships for the event's org count
 */
export function resolvePermissions(
  memberships: ReadonlyArray<Membership>,
  scope: Scope = {},
  eventOrgMap: Readonly<Record<string, string>> = {},
): Set<PermissionId> {
  const out = new Set<PermissionId>();

  for (const m of memberships) {
    let matches = false;
    if (!scope.organizationId && !scope.eventId) matches = true;
    if (scope.organizationId && m.organizationId === scope.organizationId) matches = true;
    if (scope.eventId && m.eventId === scope.eventId) matches = true;
    if (
      scope.eventId && m.organizationId &&
      eventOrgMap[scope.eventId] === m.organizationId
    ) matches = true;
    if (
      scope.organizationId && m.eventId &&
      eventOrgMap[m.eventId] === scope.organizationId
    ) matches = true;

    if (matches) {
      for (const p of permissionsForRole(m.roleId)) out.add(p);
    }
  }

  return out;
}

export function can(
  memberships: ReadonlyArray<Membership>,
  scope: Scope,
  permission: PermissionId,
  eventOrgMap: Readonly<Record<string, string>> = {},
): boolean {
  return resolvePermissions(memberships, scope, eventOrgMap).has(permission);
}

export function assertCan(
  memberships: ReadonlyArray<Membership>,
  scope: Scope,
  permission: PermissionId,
  eventOrgMap: Readonly<Record<string, string>> = {},
): void {
  if (!can(memberships, scope, permission, eventOrgMap)) {
    const err = new Error(`forbidden: missing ${permission}`) as Error & {
      statusCode: number; code: string;
    };
    err.statusCode = 403;
    err.code = 'forbidden';
    throw err;
  }
}
