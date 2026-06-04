import { PermissionDefinition } from '../types/rbac';

// ============================================================
// PERMISSION REGISTRY
// ============================================================
// All permissions in the application are registered here.
// New features should add their permissions here.
// Hierarchical format: parent.child.grandchild
// ============================================================

export const PERMISSIONS: PermissionDefinition[] = [
  // ─── ADMINISTRATION ─────────────────────────────────────
  {
    id: 'admin.panel.access',
    label: 'Access Admin Panel',
    description: 'Can open and use the Admin Panel',
    category: 'admin',
    level: 'feature',
    isLocked: true,
    isDefault: true,
  },
  {
    id: 'admin.users.manage',
    label: 'Manage Users',
    description: 'Can create, edit, and delete users',
    category: 'admin',
    parentId: 'admin.panel.access',
    level: 'sub-feature',
    isLocked: true,
  },
  {
    id: 'admin.roles.manage',
    label: 'Manage Roles & Permissions',
    description: 'Can create and modify roles and permissions',
    category: 'admin',
    parentId: 'admin.panel.access',
    level: 'sub-feature',
    isLocked: true,
  },
  {
    id: 'admin.venues.manage',
    label: 'Manage Venues',
    description: 'Can create and edit venue configurations',
    category: 'admin',
    parentId: 'admin.panel.access',
    level: 'sub-feature',
  },
  {
    id: 'admin.settings.manage',
    label: 'Manage Settings',
    description: 'Can modify application settings and branding',
    category: 'admin',
    parentId: 'admin.panel.access',
    level: 'sub-feature',
  },
  {
    id: 'admin.backup.manage',
    label: 'Manage Backups',
    description: 'Can create and restore backups',
    category: 'admin',
    parentId: 'admin.panel.access',
    level: 'sub-feature',
  },

  // ─── LAYOUT & DESIGN ───────────────────────────────────
  {
    id: 'layout.canvas.view',
    label: 'View Layout Canvas',
    description: 'Can view the floor plan canvas',
    category: 'layout',
    level: 'feature',
    isDefault: true,
  },
  {
    id: 'layout.canvas.edit',
    label: 'Edit Layout Canvas',
    description: 'Can add, move, and modify items on the canvas',
    category: 'layout',
    parentId: 'layout.canvas.view',
    level: 'sub-feature',
  },
  {
    id: 'layout.canvas.delete',
    label: 'Delete Layout Items',
    description: 'Can remove items from the canvas',
    category: 'layout',
    parentId: 'layout.canvas.edit',
    level: 'sub-feature',
  },
  {
    id: 'layout.canvas.duplicate',
    label: 'Duplicate Layout Items',
    description: 'Can duplicate items on the canvas',
    category: 'layout',
    parentId: 'layout.canvas.edit',
    level: 'sub-feature',
  },
  {
    id: 'layout.collision.override',
    label: 'Override Collision Warnings',
    description: 'Can place items despite collision warnings',
    category: 'layout',
    parentId: 'layout.canvas.edit',
    level: 'sub-feature',
  },
  {
    id: 'layout.undo.use',
    label: 'Use Undo/Redo',
    description: 'Can undo and redo layout changes',
    category: 'layout',
    parentId: 'layout.canvas.edit',
    level: 'sub-feature',
  },

  // ─── GUEST MANAGEMENT ──────────────────────────────────
  {
    id: 'guests.view',
    label: 'View Guest List',
    description: 'Can view the guest list',
    category: 'guests',
    level: 'feature',
    isDefault: true,
  },
  {
    id: 'guests.manage',
    label: 'Manage Guests',
    description: 'Can add, edit, and remove guests',
    category: 'guests',
    parentId: 'guests.view',
    level: 'sub-feature',
  },
  {
    id: 'guests.assign',
    label: 'Assign Guests to Tables',
    description: 'Can assign guests to tables and rooms',
    category: 'guests',
    parentId: 'guests.manage',
    level: 'sub-feature',
  },
  {
    id: 'guests.import',
    label: 'Import Guests',
    description: 'Can import guests from CSV',
    category: 'guests',
    parentId: 'guests.manage',
    level: 'sub-feature',
  },
  {
    id: 'guests.export',
    label: 'Export Guests',
    description: 'Can export guest list to CSV',
    category: 'guests',
    parentId: 'guests.view',
    level: 'sub-feature',
  },

  // ─── DECOR & DESIGN ────────────────────────────────────
  {
    id: 'decor.catalog.view',
    label: 'View Decor Catalog',
    description: 'Can view the decor item catalog',
    category: 'decor',
    level: 'feature',
  },
  {
    id: 'decor.catalog.manage',
    label: 'Manage Decor Catalog',
    description: 'Can add, edit, and remove decor items',
    category: 'decor',
    parentId: 'decor.catalog.view',
    level: 'sub-feature',
  },
  {
    id: 'decor.designer.use',
    label: 'Use Decor Designer',
    description: 'Can open and use the decor arrangement designer',
    category: 'decor',
    level: 'feature',
  },
  {
    id: 'decor.designer.save',
    label: 'Save Decor Designs',
    description: 'Can save decor arrangements',
    category: 'decor',
    parentId: 'decor.designer.use',
    level: 'sub-feature',
  },
  {
    id: 'decor.designer.delete',
    label: 'Delete Decor Designs',
    description: 'Can delete saved decor arrangements',
    category: 'decor',
    parentId: 'decor.designer.use',
    level: 'sub-feature',
  },
  {
    id: 'decor.apply',
    label: 'Apply Decor to Layout',
    description: 'Can drag and drop decor onto tables/fixtures',
    category: 'decor',
    level: 'feature',
  },

  // ─── VENDOR MANAGEMENT ─────────────────────────────────
  {
    id: 'vendors.view',
    label: 'View Vendors',
    description: 'Can view the vendor list',
    category: 'vendors',
    level: 'feature',
  },
  {
    id: 'vendors.manage',
    label: 'Manage Vendors',
    description: 'Can add, edit, and remove vendors',
    category: 'vendors',
    parentId: 'vendors.view',
    level: 'sub-feature',
  },
  {
    id: 'vendors.payments.view',
    label: 'View Vendor Payments',
    description: 'Can view vendor payment information',
    category: 'vendors',
    parentId: 'vendors.view',
    level: 'sub-feature',
  },
  {
    id: 'vendors.payments.manage',
    label: 'Manage Vendor Payments',
    description: 'Can record and update vendor payments',
    category: 'vendors',
    parentId: 'vendors.payments.view',
    level: 'sub-feature',
  },

  // ─── TIMELINE & SCHEDULE ───────────────────────────────
  {
    id: 'timeline.view',
    label: 'View Timeline',
    description: 'Can view the wedding timeline',
    category: 'timeline',
    level: 'feature',
  },
  {
    id: 'timeline.manage',
    label: 'Manage Timeline',
    description: 'Can create and edit timeline events',
    category: 'timeline',
    parentId: 'timeline.view',
    level: 'sub-feature',
  },
  {
    id: 'timeline.events.complete',
    label: 'Mark Events Complete',
    description: 'Can mark timeline events as completed',
    category: 'timeline',
    parentId: 'timeline.manage',
    level: 'sub-feature',
  },

  // ─── COMMUNICATION ─────────────────────────────────────
  {
    id: 'communication.chat',
    label: 'Use Direct Messaging',
    description: 'Can send and receive direct messages',
    category: 'communication',
    level: 'feature',
  },
  {
    id: 'communication.notifications',
    label: 'Receive Notifications',
    description: 'Can receive system notifications',
    category: 'communication',
    level: 'feature',
  },

  // ─── GUEST PORTAL ──────────────────────────────────────
  {
    id: 'portal.config.manage',
    label: 'Configure Guest Portal',
    description: 'Can configure guest portal settings',
    category: 'portal',
    level: 'feature',
  },
  {
    id: 'portal.guest.view',
    label: 'Access Guest Portal',
    description: 'Can view the guest portal',
    category: 'portal',
    level: 'feature',
  },
  {
    id: 'portal.rsvp.submit',
    label: 'Submit RSVP',
    description: 'Can submit RSVP through the portal',
    category: 'portal',
    level: 'feature',
  },
  {
    id: 'portal.rsvp.manage',
    label: 'Manage RSVP Submissions',
    description: 'Can view and manage RSVP submissions',
    category: 'portal',
    level: 'feature',
  },
  {
    id: 'portal.lodging.view',
    label: 'View Lodging Info',
    description: 'Can view lodging information in portal',
    category: 'portal',
    level: 'feature',
  },

  // ─── STAFF OPERATIONS ──────────────────────────────────
  {
    id: 'staff.operations.access',
    label: 'Access Staff Operations',
    description: 'Can open and use Staff Operations panel',
    category: 'staff',
    level: 'feature',
  },
  {
    id: 'staff.tasks.manage',
    label: 'Manage Staff Tasks',
    description: 'Can create and assign staff tasks',
    category: 'staff',
    parentId: 'staff.operations.access',
    level: 'sub-feature',
  },
  {
    id: 'staff.areas.manage',
    label: 'Manage Staff Areas',
    description: 'Can create and manage operational areas',
    category: 'staff',
    parentId: 'staff.operations.access',
    level: 'sub-feature',
  },
  {
    id: 'staff.shifts.manage',
    label: 'Manage Staff Shifts',
    description: 'Can create and manage staff shifts',
    category: 'staff',
    parentId: 'staff.operations.access',
    level: 'sub-feature',
  },

  // ─── SUBMISSIONS ───────────────────────────────────────
  {
    id: 'submissions.submit',
    label: 'Submit Layout for Approval',
    description: 'Can submit layouts for admin approval',
    category: 'layout',
    level: 'feature',
  },
  {
    id: 'submissions.review',
    label: 'Review Submissions',
    description: 'Can approve or reject layout submissions',
    category: 'layout',
    level: 'feature',
  },

  // ─── EXPORT & PRINT ────────────────────────────────────
  {
    id: 'export.print',
    label: 'Print Layout',
    description: 'Can print the current layout',
    category: 'export',
    level: 'feature',
  },
  {
    id: 'export.share',
    label: 'Share Layout',
    description: 'Can share layouts with others',
    category: 'export',
    level: 'feature',
  },
  {
    id: 'export.download',
    label: 'Download Layout',
    description: 'Can download layout as image/PDF',
    category: 'export',
    level: 'feature',
  },

  // ─── TEMPLATES ─────────────────────────────────────────
  {
    id: 'templates.view',
    label: 'View Templates',
    description: 'Can view available templates',
    category: 'layout',
    level: 'feature',
  },
  {
    id: 'templates.use',
    label: 'Use Templates',
    description: 'Can apply templates to layouts',
    category: 'layout',
    parentId: 'templates.view',
    level: 'sub-feature',
  },
  {
    id: 'templates.create',
    label: 'Create Templates',
    description: 'Can save layouts as templates',
    category: 'layout',
    parentId: 'templates.use',
    level: 'sub-feature',
  },
  {
    id: 'templates.manage',
    label: 'Manage Templates',
    description: 'Can edit and delete templates',
    category: 'layout',
    parentId: 'templates.create',
    level: 'sub-feature',
  },
];

// Helper functions
export function getPermissionById(id: string): PermissionDefinition | undefined {
  return PERMISSIONS.find(p => p.id === id);
}

export function getPermissionsByCategory(category: string): PermissionDefinition[] {
  return PERMISSIONS.filter(p => p.category === category);
}

export function getFeaturePermissions(): PermissionDefinition[] {
  return PERMISSIONS.filter(p => p.level === 'feature');
}

export function getSubFeaturePermissions(parentId: string): PermissionDefinition[] {
  return PERMISSIONS.filter(p => p.parentId === parentId);
}

export function getChildPermissions(permissionId: string): PermissionDefinition[] {
  return PERMISSIONS.filter(p => p.parentId === permissionId);
}

export function getLockedPermissions(): string[] {
  return PERMISSIONS.filter(p => p.isLocked).map(p => p.id);
}

export function getDefaultPermissions(): string[] {
  return PERMISSIONS.filter(p => p.isDefault).map(p => p.id);
}

// Get all permission IDs for a feature (including sub-features)
export function getAllPermissionIdsForFeature(featureId: string): string[] {
  const ids: string[] = [featureId];
  const children = getChildPermissions(featureId);
  
  for (const child of children) {
    ids.push(...getAllPermissionIdsForFeature(child.id));
  }
  
  return ids;
}

// Check if a permission has all its children selected
export function hasAllChildrenSelected(
  permissionId: string, 
  selectedPermissions: string[]
): boolean {
  const children = getChildPermissions(permissionId);
  if (children.length === 0) return selectedPermissions.includes(permissionId);
  
  return children.every(child => 
    selectedPermissions.includes(child.id) || hasAllChildrenSelected(child.id, selectedPermissions)
  );
}

// Get inherited permissions for a role
export function getInheritedPermissions(
  roleId: string,
  roles: { id: string; permissions: string[]; inheritsFrom?: string[] }[]
): string[] {
  const role = roles.find(r => r.id === roleId);
  if (!role) return [];
  
  let allPermissions = [...role.permissions];
  
  if (role.inheritsFrom) {
    for (const parentId of role.inheritsFrom) {
      const parentPermissions = getInheritedPermissions(parentId, roles);
      allPermissions = [...allPermissions, ...parentPermissions];
    }
  }
  
  return [...new Set(allPermissions)];
}