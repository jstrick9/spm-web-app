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
/** Permissions granted by each system role. */
const ROLE_PERMISSIONS = {
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
export function resolvePermissions(memberships, scope = {}, eventOrgMap = {}) {
    const out = new Set();
    for (const m of memberships) {
        let matches = false;
        if (scope.organizationId && m.organizationId === scope.organizationId) {
            matches = true;
        }
        if (scope.eventId && m.eventId === scope.eventId) {
            matches = true;
        }
        if (scope.eventId &&
            m.organizationId &&
            eventOrgMap[scope.eventId] === m.organizationId) {
            matches = true;
        }
        if (!scope.organizationId && !scope.eventId) {
            matches = true;
        }
        if (matches) {
            for (const p of ROLE_PERMISSIONS[m.role] ?? [])
                out.add(p);
        }
    }
    return out;
}
export function can(memberships, scope, permission, eventOrgMap = {}) {
    return resolvePermissions(memberships, scope, eventOrgMap).has(permission);
}
//# sourceMappingURL=rbac.js.map