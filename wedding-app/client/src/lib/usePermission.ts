/**
 * usePermission — Client-side RBAC hook.
 *
 * Checks whether the current user has a specific permission by resolving
 * their memberships against the permission grants cached in their JWT.
 *
 * Usage:
 *   const canManageBudget = usePermission('budget.manage');
 *   const canViewReports = usePermission('reports.view');
 *
 * This is a *hint* for UI gating (hide tabs, disable buttons). The server
 * always re-validates on every request — this hook prevents users from
 * seeing controls they'd get 403'd on.
 *
 * Implementation: we fetch the role definitions from the server once
 * (cached), then resolve permissions from the user's memberships locally.
 */
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { sdk } from '../sdk';
import type { SdkMembership } from '../sdk/types';

/**
 * Resolve the permission set for one membership: the org's role map when it
 * is available (roles.view holders), otherwise the effective permissions the
 * server embedded in the membership itself (auth/me). The embedded list is
 * the fallback that keeps staff/other roles WITHOUT roles.view fully gated
 * instead of being locked out of every surface.
 */
function permsFor(m: SdkMembership, roleMap: Map<string, Set<string>>): Set<string> | undefined {
  return roleMap.get(m.roleId) ?? (m.permissions?.length ? new Set(m.permissions) : undefined);
}

/**
 * True when every membership already carries its effective permissions — in
 * that case the roles query (which requires roles.view and 403s for staff)
 * can be skipped entirely.
 */
function membershipsCarryPermissions(memberships: SdkMembership[]): boolean {
  return memberships.length > 0 && memberships.every((m) => Array.isArray(m.permissions) && m.permissions.length > 0);
}

/**
 * Fetches the full role permission map for the org, caches it.
 * Returns a Map<roleId, Set<permissionId>>.
 *
 * Only fired as a fallback when some membership lacks its embedded
 * permission list (stale payloads); the auth/me memberships are the primary
 * source so roles WITHOUT roles.view (staff) stay fully gated.
 */
function useRolePermissionState(orgId: string | null) {
  const memberships = _ctx.memberships;
  // Empty memberships = context not mounted yet — don't fire the roles query
  // against the pre-login orgId (it would 403 for roles without roles.view
  // and pollute the console with errors on every gated surface).
  const skipQuery = memberships.length === 0 || membershipsCarryPermissions(memberships);
  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['roles', orgId],
    queryFn: () => sdk.roles.listRoles(orgId!),
    enabled: !!orgId && !skipQuery,
    staleTime: 5 * 60_000, // 5 min cache — roles rarely change
  });

  const roleMap = useMemo(() => {
    const map = new Map<string, Set<string>>();
    if (!data?.roles) return map;
    for (const role of data.roles) {
      map.set(role.id, new Set(role.permissions));
    }
    return map;
  }, [data]);

  return { roleMap, memberships, isLoading: !skipQuery && !!orgId && !data && (isLoading || isFetching) };
}

function useRolePermissionMap(orgId: string | null) {
  return useRolePermissionState(orgId).roleMap;
}

interface PermissionContext {
  orgId: string | null;
  memberships: SdkMembership[];
}

let _ctx: PermissionContext = { orgId: null, memberships: [] };

/** Call once in AuthenticatedApp to set the context for all hooks. */
export function setPermissionContext(orgId: string | null, memberships: SdkMembership[]) {
  _ctx = { orgId, memberships };
}

/**
 * Check if the current user has a specific permission.
 * Returns `true` if any of their roles grant the permission.
 */
export function usePermission(permissionId: string): boolean {
  const { roleMap, memberships } = useRolePermissionState(_ctx.orgId);

  return useMemo(() => {
    for (const m of memberships) {
      const perms = permsFor(m, roleMap);
      if (perms?.has(permissionId)) return true;
    }
    return false;
  }, [roleMap, permissionId, memberships]);
}

/**
 * Check multiple permissions at once.
 * Returns an object with boolean values for each permission.
 */
export function usePermissions<T extends string>(permissionIds: readonly T[]): Record<T, boolean> {
  const { roleMap, memberships } = useRolePermissionState(_ctx.orgId);

  return useMemo(() => {
    const result = {} as Record<T, boolean>;
    for (const pid of permissionIds) {
      result[pid] = false;
      for (const m of memberships) {
        const perms = permsFor(m, roleMap);
        if (perms?.has(pid)) {
          result[pid] = true;
          break;
        }
      }
    }
    return result;
  }, [roleMap, permissionIds, memberships]);
}

/**
 * Permission gate state for route-level guards. Unlike usePermission(), this
 * exposes the role-loading state so routes can show a loading skeleton instead
 * of flashing AccessDenied while the permission catalog is being fetched.
 */
export function usePermissionGate(permissionId: string): { allowed: boolean; isLoading: boolean } {
  const { roleMap, memberships, isLoading } = useRolePermissionState(_ctx.orgId);

  const allowed = useMemo(() => {
    for (const m of memberships) {
      const perms = permsFor(m, roleMap);
      if (perms?.has(permissionId)) return true;
    }
    return false;
  }, [roleMap, permissionId, memberships]);

  return { allowed, isLoading };
}
