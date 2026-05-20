// Permission metadata
export interface PermissionDefinition {
  id: string;                    // Hierarchical ID: e.g., "decor.designer.edit"
  label: string;                 // Human-readable: "Edit Decor Designs"
  description: string;           // Description of what this permission grants
  category: string;              // Group: "Decor", "Layout", "Guests", etc.
  featureGroup?: string;         // Parent feature: "decor.designer"
  isLocked?: boolean;            // Cannot be deleted
  isDefault?: boolean;           // Default permission (always exists)
  parentId?: string;             // Parent permission for hierarchy
  level: 'feature' | 'sub-feature'; // Permission level
}

// Role definition
export interface Role {
  id: string;
  name: string;
  description?: string;
  permissions: string[];         // Array of permission IDs
  isSystem?: boolean;            // System role (can't be deleted)
  isImmutable?: boolean;         // Immutable role (Master Admin)
  hierarchy?: number;            // Hierarchy level (higher = more access)
  inheritsFrom?: string[];       // Role IDs to inherit permissions from
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
}

// Permission group/category
export interface PermissionGroup {
  id: string;
  name: string;
  icon?: string;
  description?: string;
  order: number;                 // Display order
  isCustom?: boolean;            // Created by admin
}

// Role template (for quick role creation)
export interface RoleTemplate {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  icon?: string;
}

// Audit log entry
export interface AuditLogEntry {
  id: string;
  action: 'role_created' | 'role_updated' | 'role_deleted' | 
          'permission_added' | 'permission_removed' |
          'user_role_assigned' | 'user_role_removed' |
          'permission_group_created' | 'permission_group_updated';
  targetType: 'role' | 'user' | 'permission' | 'group';
  targetId: string;
  targetName?: string;
  details: string;
  performedBy: string;
  performedByName: string;
  timestamp: string;
  previousValue?: any;
  newValue?: any;
}

// Updated UserPermissions to use dynamic permissions
export interface DynamicUserPermissions {
  [permissionId: string]: boolean;
}

// Default roles
export const SYSTEM_ROLES = {
  MASTER_ADMIN: 'master-admin',
  ADMIN: 'admin',
  BASIC: 'basic',
  STAFF: 'staff',
  GUEST: 'guest',
} as const;

// Default permission groups
export const DEFAULT_PERMISSION_GROUPS: PermissionGroup[] = [
  { id: 'admin', name: 'Administration', icon: '⚙️', order: 1 },
  { id: 'layout', name: 'Layout & Design', icon: '📐', order: 2 },
  { id: 'guests', name: 'Guest Management', icon: '👥', order: 3 },
  { id: 'decor', name: 'Decor & Design', icon: '🎀', order: 4 },
  { id: 'vendors', name: 'Vendor Management', icon: '🤝', order: 5 },
  { id: 'timeline', name: 'Timeline & Schedule', icon: '📅', order: 6 },
  { id: 'communication', name: 'Communication', icon: '💬', order: 7 },
  { id: 'portal', name: 'Guest Portal', icon: '🌐', order: 8 },
  { id: 'staff', name: 'Staff Operations', icon: '👷', order: 9 },
  { id: 'export', name: 'Export & Print', icon: '🖨️', order: 10 },
];

// Role templates
export const DEFAULT_ROLE_TEMPLATES: RoleTemplate[] = [
  {
    id: 'template-coordinator',
    name: 'Event Coordinator',
    description: 'Full access to planning and coordination features',
    icon: '📋',
    permissions: [
      'layout.canvas.edit',
      'layout.canvas.view',
      'guests.manage',
      'guests.view',
      'decor.designer.use',
      'vendors.manage',
      'vendors.view',
      'timeline.use',
      'communication.chat',
      'export.print',
      'export.share',
      'templates.use',
    ],
  },
  {
    id: 'template-setup-crew',
    name: 'Setup Crew',
    description: 'View-only access to layouts for setup',
    icon: '👷',
    permissions: [
      'layout.canvas.view',
      'guests.view',
      'timeline.view',
      'export.print',
    ],
  },
  {
    id: 'template-client',
    name: 'Client/Planner',
    description: 'Access for wedding couples or planners',
    icon: '💑',
    permissions: [
      'layout.canvas.view',
      'layout.canvas.edit',
      'guests.view',
      'guests.manage',
      'decor.designer.use',
      'timeline.view',
      'communication.chat',
      'portal.rsvp.submit',
      'portal.guest.view',
    ],
  },
  {
    id: 'template-readonly',
    name: 'View Only',
    description: 'Can only view, no editing',
    icon: '👁️',
    permissions: [
      'layout.canvas.view',
      'guests.view',
      'timeline.view',
      'vendors.view',
      'portal.guest.view',
    ],
  },
];