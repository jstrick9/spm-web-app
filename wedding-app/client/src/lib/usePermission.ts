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
 * Fetches the full role permission map for the org, caches it.
 * Returns a Map<roleId, Set<permissionId>>.
 */
function useRolePermissionState(orgId: string | null) {
  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['roles', orgId],
    queryFn: () => sdk.roles.listRoles(orgId!),
    enabled: !!orgId,
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

  return { roleMap, isLoading: !!orgId && !data && (isLoading || isFetching) };
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
  const roleMap = useRolePermissionMap(_ctx.orgId);

  return useMemo(() => {
    for (const m of _ctx.memberships) {
      const roleId = m.roleId;
      const perms = roleMap.get(roleId);
      if (perms?.has(permissionId)) return true;
    }
    return false;
  }, [roleMap, permissionId]);
}

/**
 * Check multiple permissions at once.
 * Returns an object with boolean values for each permission.
 */
export function usePermissions<T extends string>(permissionIds: readonly T[]): Record<T, boolean> {
  const roleMap = useRolePermissionMap(_ctx.orgId);

  return useMemo(() => {
    const result = {} as Record<T, boolean>;
    for (const pid of permissionIds) {
      result[pid] = false;
      for (const m of _ctx.memberships) {
        const perms = roleMap.get(m.roleId);
        if (perms?.has(pid)) {
          result[pid] = true;
          break;
        }
      }
    }
    return result;
  }, [roleMap, permissionIds]);
}

/**
 * Permission gate state for route-level guards. Unlike usePermission(), this
 * exposes the role-loading state so routes can show a loading skeleton instead
 * of flashing AccessDenied while the permission catalog is being fetched.
 */
export function usePermissionGate(permissionId: string): { allowed: boolean; isLoading: boolean } {
  const { roleMap, isLoading } = useRolePermissionState(_ctx.orgId);

  const allowed = useMemo(() => {
    for (const m of _ctx.memberships) {
      const perms = roleMap.get(m.roleId);
      if (perms?.has(permissionId)) return true;
    }
    return false;
  }, [roleMap, permissionId]);

  return { allowed, isLoading };
}
