import { useState, useCallback, useEffect, useMemo } from 'react';
import { Role, PermissionGroup, AuditLogEntry, PermissionDefinition, DEFAULT_PERMISSION_GROUPS } from '../types/rbac';
import { PERMISSIONS, getInheritedPermissions, getChildPermissions } from '../constants/permissions';
const ROLES_KEY = 'spm_rbac_roles';
const GROUPS_KEY = 'spm_rbac_groups';
const AUDIT_KEY = 'spm_rbac_audit';

// Storage helpers
function loadFromStorage<T>(key: string, defaultValue: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : defaultValue;
  } catch {
    return defaultValue;
  }
}

function saveToStorage<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value));
}

// Default system roles
const DEFAULT_ROLES: Role[] = [
  {
    id: 'master-admin',
    name: 'Master Admin',
    description: 'Full system access - cannot be modified',
    permissions: PERMISSIONS.map(p => p.id),
    isSystem: true,
    isImmutable: true,
    hierarchy: 100,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'admin',
    name: 'Admin',
    description: 'Administrative access with most permissions',
    permissions: PERMISSIONS.filter(p => !p.id.startsWith('admin.roles')).map(p => p.id),
    isSystem: true,
    hierarchy: 90,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'basic',
    name: 'Basic User',
    description: 'Standard user with layout and guest management',
    permissions: [
      'layout.canvas.view',
      'layout.canvas.edit',
      'layout.canvas.delete',
      'layout.canvas.duplicate',
      'layout.undo.use',
      'guests.view',
      'guests.manage',
      'guests.assign',
      'guests.import',
      'guests.export',
      'decor.catalog.view',
      'decor.designer.use',
      'decor.designer.save',
      'decor.apply',
      'vendors.view',
      'timeline.view',
      'timeline.manage',
      'communication.chat',
      'portal.guest.view',
      'export.print',
      'export.share',
      'templates.view',
      'templates.use',
      'submissions.submit',
    ],
    isSystem: true,
    hierarchy: 50,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'staff',
    name: 'Staff',
    description: 'Staff member with operations access',
    permissions: [
      'layout.canvas.view',
      'guests.view',
      'timeline.view',
      'timeline.manage',
      'timeline.events.complete',
      'communication.chat',
      'staff.operations.access',
      'staff.tasks.manage',
      'staff.areas.manage',
      'staff.shifts.manage',
      'export.print',
    ],
    isSystem: true,
    hierarchy: 40,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'guest',
    name: 'Guest',
    description: 'Guest portal access only',
    permissions: [
      'portal.guest.view',
      'portal.rsvp.submit',
      'portal.lodging.view',
    ],
    isSystem: true,
    hierarchy: 10,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export function useRBAC() {
  const [roles, setRoles] = useState<Role[]>(() => {
    const stored = loadFromStorage<Role[]>(ROLES_KEY, []);
    // Ensure system roles always exist
    const mergedRoles = [...DEFAULT_ROLES];
    for (const storedRole of stored) {
      if (!mergedRoles.find(r => r.id === storedRole.id)) {
        mergedRoles.push(storedRole);
      } else if (!storedRole.isImmutable) {
        // Update non-immutable system roles with stored version
        const index = mergedRoles.findIndex(r => r.id === storedRole.id);
        if (index >= 0) {
          mergedRoles[index] = storedRole;
        }
      }
    }
    return mergedRoles;
  });

  const [groups, setGroups] = useState<PermissionGroup[]>(() => {
    const stored = loadFromStorage<PermissionGroup[]>(GROUPS_KEY, []);
    const mergedGroups = [...DEFAULT_PERMISSION_GROUPS];
    for (const storedGroup of stored) {
      if (!mergedGroups.find(g => g.id === storedGroup.id)) {
        mergedGroups.push(storedGroup);
      }
    }
    return mergedGroups.sort((a, b) => a.order - b.order);
  });

  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>(() => 
    loadFromStorage<AuditLogEntry[]>(AUDIT_KEY, [])
  );

  // Save to storage on changes
  useEffect(() => {
    saveToStorage(ROLES_KEY, roles);
  }, [roles]);

  useEffect(() => {
    saveToStorage(GROUPS_KEY, groups);
  }, [groups]);

  useEffect(() => {
    saveToStorage(AUDIT_KEY, auditLog);
  }, [auditLog]);

  // Add audit log entry
  const addAuditEntry = useCallback((
    entry: Omit<AuditLogEntry, 'id' | 'timestamp'>
  ) => {
    const newEntry: AuditLogEntry = {
      ...entry,
      id: `audit-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      timestamp: new Date().toISOString(),
    };
    setAuditLog(prev => [newEntry, ...prev].slice(0, 500)); // Keep last 500 entries
  }, []);

  // Create role
  const createRole = useCallback((
    role: Omit<Role, 'id' | 'createdAt' | 'updatedAt'>,
    performedBy: string,
    performedByName: string
  ): Role => {
    const newRole: Role = {
      ...role,
      id: `role-${Date.now()}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setRoles(prev => [...prev, newRole]);
    
    addAuditEntry({
      action: 'role_created',
      targetType: 'role',
      targetId: newRole.id,
      targetName: newRole.name,
      details: `Created role "${newRole.name}" with ${newRole.permissions.length} permissions`,
      performedBy,
      performedByName,
    });

    return newRole;
  }, [addAuditEntry]);

  // Update role
  const updateRole = useCallback((
    roleId: string,
    updates: Partial<Role>,
    performedBy: string,
    performedByName: string
  ) => {
    setRoles(prev => prev.map(r => {
      if (r.id !== roleId) return r;
      if (r.isImmutable) return r; // Can't update immutable roles
      
      const updated = { ...r, ...updates, updatedAt: new Date().toISOString() };
      
      addAuditEntry({
        action: 'role_updated',
        targetType: 'role',
        targetId: roleId,
        targetName: updated.name,
        details: `Updated role "${updated.name}"`,
        performedBy,
        performedByName,
        previousValue: { permissions: r.permissions },
        newValue: { permissions: updated.permissions },
      });

      return updated;
    }));
  }, [addAuditEntry]);

  // Delete role
  const deleteRole = useCallback((
    roleId: string,
    performedBy: string,
    performedByName: string
  ) => {
    const role = roles.find(r => r.id === roleId);
    if (!role || role.isSystem || role.isImmutable) return false;

    setRoles(prev => prev.filter(r => r.id !== roleId));
    
    addAuditEntry({
      action: 'role_deleted',
      targetType: 'role',
      targetId: roleId,
      targetName: role.name,
      details: `Deleted role "${role.name}"`,
      performedBy,
      performedByName,
    });

    return true;
  }, [roles, addAuditEntry]);

  // Add permission to role
  const addPermissionToRole = useCallback((
    roleId: string,
    permissionId: string,
    performedBy: string,
    performedByName: string
  ) => {
    setRoles(prev => prev.map(r => {
      if (r.id !== roleId || r.isImmutable) return r;
      if (r.permissions.includes(permissionId)) return r;

      const updated = {
        ...r,
        permissions: [...r.permissions, permissionId],
        updatedAt: new Date().toISOString(),
      };

      addAuditEntry({
        action: 'permission_added',
        targetType: 'role',
        targetId: roleId,
        targetName: r.name,
        details: `Added permission "${permissionId}" to role "${r.name}"`,
        performedBy,
        performedByName,
      });

      return updated;
    }));
  }, [addAuditEntry]);

  // Remove permission from role
  const removePermissionFromRole = useCallback((
    roleId: string,
    permissionId: string,
    performedBy: string,
    performedByName: string
  ) => {
    setRoles(prev => prev.map(r => {
      if (r.id !== roleId || r.isImmutable) return r;
      
      const perm = PERMISSIONS.find(p => p.id === permissionId);
      if (perm?.isLocked) return r; // Can't remove locked permissions

      const updated = {
        ...r,
        permissions: r.permissions.filter(p => p !== permissionId),
        updatedAt: new Date().toISOString(),
      };

      addAuditEntry({
        action: 'permission_removed',
        targetType: 'role',
        targetId: roleId,
        targetName: r.name,
        details: `Removed permission "${permissionId}" from role "${r.name}"`,
        performedBy,
        performedByName,
      });

      return updated;
    }));
  }, [addAuditEntry]);

  // Get all permissions for a role (including inherited)
  const getRolePermissions = useCallback((roleId: string): string[] => {
    return getInheritedPermissions(roleId, roles);
  }, [roles]);

  // Check if user has permission (checks all assigned roles)
  const hasPermission = useCallback((
    userRoles: string[],
    permissionId: string
  ): boolean => {
    for (const roleId of userRoles) {
      const permissions = getRolePermissions(roleId);
      if (permissions.includes(permissionId)) return true;
    }
    return false;
  }, [getRolePermissions]);

  // Copy permissions from one role to another
  const copyPermissions = useCallback((
    fromRoleId: string,
    toRoleId: string,
    performedBy: string,
    performedByName: string
  ) => {
    const fromRole = roles.find(r => r.id === fromRoleId);
    if (!fromRole) return;

    updateRole(toRoleId, { permissions: [...fromRole.permissions] }, performedBy, performedByName);
  }, [roles, updateRole]);

  // Create permission group
  const createGroup = useCallback((
    group: Omit<PermissionGroup, 'id'>,
    performedBy: string,
    performedByName: string
  ): PermissionGroup => {
    const newGroup: PermissionGroup = {
      ...group,
      id: `group-${Date.now()}`,
    };
    setGroups(prev => [...prev, newGroup].sort((a, b) => a.order - b.order));
    
    addAuditEntry({
      action: 'permission_group_created',
      targetType: 'group',
      targetId: newGroup.id,
      targetName: newGroup.name,
      details: `Created permission group "${newGroup.name}"`,
      performedBy,
      performedByName,
    });

    return newGroup;
  }, [addAuditEntry]);

  // Update permission group
  const updateGroup = useCallback((
    groupId: string,
    updates: Partial<PermissionGroup>,
    performedBy: string,
    performedByName: string
  ) => {
    setGroups(prev => prev.map(g => {
      if (g.id !== groupId) return g;
      const updated = { ...g, ...updates };
      
      addAuditEntry({
        action: 'permission_group_updated',
        targetType: 'group',
        targetId: groupId,
        targetName: updated.name,
        details: `Updated permission group "${updated.name}"`,
        performedBy,
        performedByName,
      });

      return updated;
    }));
  }, [addAuditEntry]);

  // Delete permission group
  const deleteGroup = useCallback((groupId: string) => {
    const group = groups.find(g => g.id === groupId);
    if (!group || !group.isCustom) return false;
    setGroups(prev => prev.filter(g => g.id !== groupId));
    return true;
  }, [groups]);

  // Get permissions organized by group
  const getPermissionsByGroup = useCallback((): Record<string, PermissionDefinition[]> => {
    const result: Record<string, PermissionDefinition[]> = {};
    
    for (const group of groups) {
      result[group.id] = PERMISSIONS.filter(p => p.category === group.id);
    }
    
    return result;
  }, [groups]);

  // Get role by ID
  const getRoleById = useCallback((roleId: string): Role | undefined => {
    return roles.find(r => r.id === roleId);
  }, [roles]);

  // Get non-system roles (custom roles)
  const getCustomRoles = useCallback((): Role[] => {
    return roles.filter(r => !r.isSystem);
  }, [roles]);

  // Get all roles sorted by hierarchy
  const getAllRoles = useCallback((): Role[] => {
    return [...roles].sort((a, b) => (b.hierarchy || 0) - (a.hierarchy || 0));
  }, [roles]);

  return {
    // State
    roles,
    groups,
    auditLog,
    
    // Role operations
    createRole,
    updateRole,
    deleteRole,
    getRoleById,
    getAllRoles,
    getCustomRoles,
    
    // Permission operations
    addPermissionToRole,
    removePermissionFromRole,
    getRolePermissions,
    hasPermission,
    copyPermissions,
    
    // Group operations
    createGroup,
    updateGroup,
    deleteGroup,
    getPermissionsByGroup,
    
    // Audit
    addAuditEntry,
  };
}