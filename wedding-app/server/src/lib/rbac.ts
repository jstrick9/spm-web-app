/**
 * Role-Based Access Control resolver.
 *
 * Every route handler must call `can(req.auth.memberships, scope, 'permission.id')`
 * BEFORE doing any work. Never inspect role strings directly. This is the
 * fix for the "decorative RBAC" problem flagged in the original-app review.
 *
 * Permission ids are hierarchical strings. We keep a flat set per role here
 * (instead of role inheritance) because debugging "which permission did
 * which inherited role grant?" was the most painful part of the old system.
 */

export type PermissionId =
  // Organization
  | 'org.view'
  | 'org.manage'
  | 'org.members.invite'
  | 'org.members.remove'
  | 'org.branding.manage'
  | 'org.settings.manage'

  // Events
  | 'events.view'
  | 'events.create'
  | 'events.edit'
  | 'events.delete'
  | 'events.members.invite'

  // Venues + catalog
  | 'venues.view'
  | 'venues.manage'
  | 'catalog.view'
  | 'catalog.manage'

  // Layouts (floor plans)
  | 'layouts.view'
  | 'layouts.create'
  | 'layouts.edit'
  | 'layouts.delete'
  | 'layouts.publish'

  // Guests
  | 'guests.view'
  | 'guests.manage'
  | 'guests.assign'
  | 'guests.import'
  | 'guests.export'

  // RSVPs
  | 'rsvp.view'
  | 'rsvp.submit'
  | 'rsvp.manage'

  // Portal
  | 'portal.config.manage'
  | 'portal.guest.view'

  // Decor
  | 'decor.view'
  | 'decor.manage'
  | 'decor.design'

  // Vendors
  | 'vendors.view'
  | 'vendors.manage'

  // Timeline
  | 'timeline.view'
  | 'timeline.manage'

  // Staff ops
  | 'staff.view'
  | 'staff.manage'

  // Event questions
  | 'questions.view'
  | 'questions.manage'

  // Messaging
  | 'messages.send'

  // Audit
  | 'audit.view';

export type AppRole =
  | 'owner'   // Org owner
  | 'admin'   // Org admin
  | 'planner' // Wedding planner (org-level or event-level)
  | 'couple'  // Bride/groom (event-level)
  | 'staff'   // Day-of operations
  | 'guest';  // Wedding guest

const ROLE_PERMISSIONS: Record<AppRole, ReadonlyArray<PermissionId>> = {
  owner: [
    'org.view', 'org.manage', 'org.members.invite', 'org.members.remove',
    'org.branding.manage', 'org.settings.manage',
    'events.view', 'events.create', 'events.edit', 'events.delete', 'events.members.invite',
    'venues.view', 'venues.manage',
    'catalog.view', 'catalog.manage',
    'layouts.view', 'layouts.create', 'layouts.edit', 'layouts.delete', 'layouts.publish',
    'guests.view', 'guests.manage', 'guests.assign', 'guests.import', 'guests.export',
    'rsvp.view', 'rsvp.submit', 'rsvp.manage',
    'portal.config.manage', 'portal.guest.view',
    'decor.view', 'decor.manage', 'decor.design',
    'vendors.view', 'vendors.manage',
    'timeline.view', 'timeline.manage',
    'staff.view', 'staff.manage',
    'questions.view', 'questions.manage',
    'messages.send',
    'audit.view',
  ],
  admin: [
    'org.view', 'org.members.invite',
    'org.branding.manage', 'org.settings.manage',
    'events.view', 'events.create', 'events.edit', 'events.delete', 'events.members.invite',
    'venues.view', 'venues.manage',
    'catalog.view', 'catalog.manage',
    'layouts.view', 'layouts.create', 'layouts.edit', 'layouts.delete', 'layouts.publish',
    'guests.view', 'guests.manage', 'guests.assign', 'guests.import', 'guests.export',
    'rsvp.view', 'rsvp.submit', 'rsvp.manage',
    'portal.config.manage', 'portal.guest.view',
    'decor.view', 'decor.manage', 'decor.design',
    'vendors.view', 'vendors.manage',
    'timeline.view', 'timeline.manage',
    'staff.view', 'staff.manage',
    'questions.view', 'questions.manage',
    'messages.send',
    'audit.view',
  ],
  planner: [
    'org.view',
    'events.view', 'events.create', 'events.edit',
    'venues.view',
    'catalog.view',
    'layouts.view', 'layouts.create', 'layouts.edit', 'layouts.publish',
    'guests.view', 'guests.manage', 'guests.assign', 'guests.import', 'guests.export',
    'rsvp.view', 'rsvp.submit',
    'portal.config.manage', 'portal.guest.view',
    'decor.view', 'decor.design',
    'vendors.view', 'vendors.manage',
    'timeline.view', 'timeline.manage',
    'staff.view',
    'questions.view',
    'messages.send',
  ],
  couple: [
    'events.view',
    'venues.view',
    'layouts.view',
    'guests.view', 'guests.manage', 'guests.assign', 'guests.import', 'guests.export',
    'rsvp.view', 'rsvp.submit',
    'portal.guest.view',
    'decor.view', 'decor.design',
    'vendors.view',
    'timeline.view',
    'questions.view',
    'messages.send',
  ],
  staff: [
    'events.view',
    'venues.view',
    'layouts.view',
    'guests.view',
    'rsvp.view',
    'decor.view',
    'vendors.view',
    'timeline.view', 'timeline.manage',
    'staff.view', 'staff.manage',
  ],
  guest: [
    'rsvp.submit',
    'portal.guest.view',
  ],
};

export interface Membership {
  organizationId?: string;
  eventId?: string;
  role: AppRole;
}

export interface Scope {
  organizationId?: string;
  eventId?: string;
}

/**
 * Returns all permissions granted via any membership matching the scope.
 *
 *   - scope.organizationId set: org memberships matching that org count.
 *     Event memberships count IF the event belongs to that org (looked
 *     up via eventOrgMap).
 *   - scope.eventId set: event memberships matching that event count;
 *     org memberships count if the event's org matches.
 *   - empty scope: union over ALL memberships (use sparingly).
 */
export function resolvePermissions(
  memberships: ReadonlyArray<Membership>,
  scope: Scope = {},
  eventOrgMap: Readonly<Record<string, string>> = {},
): Set<PermissionId> {
  const out = new Set<PermissionId>();

  for (const m of memberships) {
    let matches = false;

    if (!scope.organizationId && !scope.eventId) {
      matches = true;
    }
    if (scope.organizationId && m.organizationId === scope.organizationId) {
      matches = true;
    }
    if (scope.eventId && m.eventId === scope.eventId) {
      matches = true;
    }
    if (
      scope.eventId &&
      m.organizationId &&
      eventOrgMap[scope.eventId] === m.organizationId
    ) {
      matches = true;
    }
    if (
      scope.organizationId &&
      m.eventId &&
      eventOrgMap[m.eventId] === scope.organizationId
    ) {
      // Edge case: querying org scope with an event-membership user
      matches = true;
    }

    if (matches) {
      for (const p of ROLE_PERMISSIONS[m.role] ?? []) out.add(p);
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

/** Throw a 403-style error if the permission is missing. */
export function assertCan(
  memberships: ReadonlyArray<Membership>,
  scope: Scope,
  permission: PermissionId,
  eventOrgMap: Readonly<Record<string, string>> = {},
): void {
  if (!can(memberships, scope, permission, eventOrgMap)) {
    const err = new Error(`forbidden: missing ${permission}`) as Error & {
      statusCode: number;
      code: string;
    };
    err.statusCode = 403;
    err.code = 'forbidden';
    throw err;
  }
}

/** For debugging / admin UI: which roles grant a given permission. */
export function rolesGranting(permission: PermissionId): AppRole[] {
  return (Object.entries(ROLE_PERMISSIONS) as Array<[AppRole, ReadonlyArray<PermissionId>]>)
    .filter(([, perms]) => perms.includes(permission))
    .map(([role]) => role);
}
