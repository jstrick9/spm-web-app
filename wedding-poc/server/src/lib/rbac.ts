/**
 * Role-Based Access Control resolver.
 *
 * This is the piece that the previous review identified as MISSING in the
 * original front-end: a single function that converts a user + scope into
 * the set of permissions they actually have. Every route handler asks this
 * module — never inspects `user.role` directly.
 *
 * Permission ids are strings like 'guests.manage' or 'events.create',
 * grouped hierarchically. Roles are pre-defined here (system roles); the
 * design is ready to load custom roles from a future `roles` table.
 */

export type PermissionId =
  // Organization
  | 'org.manage'
  | 'org.members.invite'
  // Events
  | 'events.view'
  | 'events.create'
  | 'events.edit'
  | 'events.delete'
  // Guests
  | 'guests.view'
  | 'guests.manage'
  | 'guests.assign'
  // RSVPs
  | 'rsvp.view'
  | 'rsvp.submit'
  // Portal
  | 'portal.guest.view';

export type AppRole =
  | 'owner'
  | 'admin'
  | 'planner'
  | 'couple'
  | 'staff'
  | 'guest';

/** Permissions granted by each system role. */
const ROLE_PERMISSIONS: Record<AppRole, PermissionId[]> = {
  owner: [
    'org.manage', 'org.members.invite',
    'events.view', 'events.create', 'events.edit', 'events.delete',
    'guests.view', 'guests.manage', 'guests.assign',
    'rsvp.view', 'rsvp.submit',
    'portal.guest.view',
  ],
  admin: [
    'org.members.invite',
    'events.view', 'events.create', 'events.edit', 'events.delete',
    'guests.view', 'guests.manage', 'guests.assign',
    'rsvp.view', 'rsvp.submit',
    'portal.guest.view',
  ],
  planner: [
    'events.view', 'events.create', 'events.edit',
    'guests.view', 'guests.manage', 'guests.assign',
    'rsvp.view', 'rsvp.submit',
    'portal.guest.view',
  ],
  couple: [
    'events.view',
    'guests.view', 'guests.manage', 'guests.assign',
    'rsvp.view', 'rsvp.submit',
    'portal.guest.view',
  ],
  staff: [
    'events.view',
    'guests.view',
    'rsvp.view',
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
 * Returns the union of permissions granted to a user via any membership
 * that overlaps the requested scope.
 *
 *   - If scope.organizationId is set, only org memberships for that org
 *     and event memberships for events in that org contribute.
 *   - If scope.eventId is set, only the matching event membership and
 *     any org membership for that event's org contribute.
 *   - If scope is empty, the union over ALL memberships is returned
 *     (useful for "what can this user do anywhere?" checks).
 */
export function resolvePermissions(
  memberships: Membership[],
  scope: Scope = {},
  eventOrgMap: Record<string, string> = {}, // event_id -> org_id, for the eventId-only case
): Set<PermissionId> {
  const out = new Set<PermissionId>();

  for (const m of memberships) {
    let matches = false;

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
    if (!scope.organizationId && !scope.eventId) {
      matches = true;
    }

    if (matches) {
      for (const p of ROLE_PERMISSIONS[m.role] ?? []) out.add(p);
    }
  }

  return out;
}

export function can(
  memberships: Membership[],
  scope: Scope,
  permission: PermissionId,
  eventOrgMap: Record<string, string> = {},
): boolean {
  return resolvePermissions(memberships, scope, eventOrgMap).has(permission);
}
