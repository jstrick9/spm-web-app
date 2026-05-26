/**
 * The canonical catalog of every permission id the app knows about.
 *
 * Why in code, not the DB?
 *   - Permission ids are referenced by string literals in route handlers
 *     (e.g. `assertCan(req.auth.memberships, scope, 'events.create')`).
 *     Keeping them as a typed union lets TypeScript catch typos at
 *     compile time.
 *   - The DB stores which roles HAVE which permissions; the set of
 *     POSSIBLE permissions evolves with deployments, not with admin clicks.
 *
 * To add a new permission:
 *   1. Add the id to PermissionId
 *   2. Add a row to PERMISSION_CATALOG with label + description + category
 *   3. Reference it from route handlers
 *   4. (Optional) Add it to the relevant system role's grants in
 *      SYSTEM_ROLE_PERMISSIONS below.
 */
export const PERMISSION_CATALOG = [
    // Organization
    { id: 'org.view', label: 'View organization', description: 'See basic org info', category: 'organization' },
    { id: 'org.manage', label: 'Manage organization', description: 'Edit org name, delete org, transfer ownership', category: 'organization' },
    { id: 'org.members.invite', label: 'Invite members', description: 'Invite users to the org and assign their role', category: 'organization' },
    { id: 'org.members.remove', label: 'Remove members', description: 'Remove users from the org', category: 'organization' },
    { id: 'org.branding.manage', label: 'Manage branding', description: 'Edit colors, logo, custom CSS', category: 'organization' },
    { id: 'org.settings.manage', label: 'Manage settings', description: 'Edit org-wide settings', category: 'organization' },
    // Roles
    { id: 'roles.view', label: 'View roles', description: 'See the list of roles', category: 'roles' },
    { id: 'roles.manage', label: 'Manage roles', description: 'Create / edit / delete custom roles and assign permissions', category: 'roles' },
    // Events
    { id: 'events.view', label: 'View events', description: '', category: 'events' },
    { id: 'events.create', label: 'Create events', description: '', category: 'events' },
    { id: 'events.edit', label: 'Edit events', description: '', category: 'events' },
    { id: 'events.delete', label: 'Delete events', description: '', category: 'events' },
    { id: 'events.members.invite', label: 'Invite event members', description: 'Add couple/planner users to a specific event', category: 'events' },
    // Venues + catalog
    { id: 'venues.view', label: 'View venues', description: '', category: 'venues' },
    { id: 'venues.manage', label: 'Manage venues', description: '', category: 'venues' },
    { id: 'catalog.view', label: 'View catalog', description: 'Tables, chairs, fixtures, linens, etc.', category: 'venues' },
    { id: 'catalog.manage', label: 'Manage catalog', description: '', category: 'venues' },
    // Layouts
    { id: 'layouts.view', label: 'View layouts', description: '', category: 'layouts' },
    { id: 'layouts.create', label: 'Create layouts', description: '', category: 'layouts' },
    { id: 'layouts.edit', label: 'Edit layouts', description: '', category: 'layouts' },
    { id: 'layouts.delete', label: 'Delete layouts', description: '', category: 'layouts' },
    { id: 'layouts.publish', label: 'Publish layouts', description: 'Mark a layout as the official version', category: 'layouts' },
    // Guests
    { id: 'guests.view', label: 'View guests', description: '', category: 'guests' },
    { id: 'guests.manage', label: 'Manage guests', description: 'Add / edit / remove guests', category: 'guests' },
    { id: 'guests.assign', label: 'Assign guests', description: 'Assign guests to tables / rooms', category: 'guests' },
    { id: 'guests.import', label: 'Import guests', description: '', category: 'guests' },
    { id: 'guests.export', label: 'Export guests', description: '', category: 'guests' },
    // RSVPs
    { id: 'rsvp.view', label: 'View RSVPs', description: '', category: 'rsvp' },
    { id: 'rsvp.submit', label: 'Submit RSVP', description: '', category: 'rsvp' },
    { id: 'rsvp.manage', label: 'Manage RSVPs', description: 'Edit submitted RSVPs after the fact', category: 'rsvp' },
    // Portal
    { id: 'portal.config.manage', label: 'Manage guest portal', description: '', category: 'portal' },
    { id: 'portal.guest.view', label: 'View guest portal', description: '', category: 'portal' },
    // Decor
    { id: 'decor.view', label: 'View decor catalog', description: '', category: 'decor' },
    { id: 'decor.manage', label: 'Manage decor catalog', description: '', category: 'decor' },
    { id: 'decor.design', label: 'Use decor designer', description: 'Create / save decor arrangements', category: 'decor' },
    // Vendors (venue-side)
    { id: 'vendors.view', label: 'View vendors', description: '', category: 'vendors' },
    { id: 'vendors.manage', label: 'Manage vendors', description: 'Add / edit / remove vendor records', category: 'vendors' },
    { id: 'vendors.invite', label: 'Invite vendor users', description: 'Link a vendor record to a user account so the vendor can log in', category: 'vendors' },
    // Vendor portal (vendor-side)
    { id: 'vendor.portal.view', label: 'Access vendor portal', description: 'Log into the vendor-facing portal', category: 'vendor_portal' },
    { id: 'vendor.bookings.view', label: 'View own bookings', description: "See events the vendor is booked for", category: 'vendor_portal' },
    { id: 'vendor.invoices.manage', label: 'Manage own invoices', description: 'Submit invoices and track payment status', category: 'vendor_portal' },
    // Timeline
    { id: 'timeline.view', label: 'View timeline', description: '', category: 'timeline' },
    { id: 'timeline.manage', label: 'Manage timeline', description: '', category: 'timeline' },
    // Staff
    { id: 'staff.view', label: 'View staff ops', description: '', category: 'staff' },
    { id: 'staff.manage', label: 'Manage staff ops', description: 'Tasks, areas, shifts', category: 'staff' },
    // Event questions
    { id: 'questions.view', label: 'View event questions', description: '', category: 'questions' },
    { id: 'questions.manage', label: 'Manage event questions', description: '', category: 'questions' },
    // Messaging
    { id: 'messages.send', label: 'Send direct messages', description: '', category: 'messages' },
    // Audit
    { id: 'audit.view', label: 'View audit log', description: '', category: 'audit' },
];
// O(1) lookup
const _set = new Set(PERMISSION_CATALOG.map((p) => p.id));
export function isValidPermissionId(id) {
    return _set.has(id);
}
export const SYSTEM_ROLE_IDS = {
    owner: 'sys_owner',
    admin: 'sys_admin',
    planner: 'sys_planner',
    couple: 'sys_couple',
    staff: 'sys_staff',
    vendor: 'sys_vendor',
    guest: 'sys_guest',
};
export const SYSTEM_ROLE_DEFINITIONS = [
    {
        id: SYSTEM_ROLE_IDS.owner,
        key: 'owner',
        name: 'Owner',
        description: 'Full control of the organization. Cannot be removed; transferable.',
        hierarchy: 100,
        permissions: [
            'org.view', 'org.manage', 'org.members.invite', 'org.members.remove',
            'org.branding.manage', 'org.settings.manage',
            'roles.view', 'roles.manage',
            'events.view', 'events.create', 'events.edit', 'events.delete', 'events.members.invite',
            'venues.view', 'venues.manage',
            'catalog.view', 'catalog.manage',
            'layouts.view', 'layouts.create', 'layouts.edit', 'layouts.delete', 'layouts.publish',
            'guests.view', 'guests.manage', 'guests.assign', 'guests.import', 'guests.export',
            'rsvp.view', 'rsvp.submit', 'rsvp.manage',
            'portal.config.manage', 'portal.guest.view',
            'decor.view', 'decor.manage', 'decor.design',
            'vendors.view', 'vendors.manage', 'vendors.invite',
            'timeline.view', 'timeline.manage',
            'staff.view', 'staff.manage',
            'questions.view', 'questions.manage',
            'messages.send',
            'audit.view',
        ],
    },
    {
        id: SYSTEM_ROLE_IDS.admin,
        key: 'admin',
        name: 'Admin',
        description: 'Manages everything except destroying the organization itself.',
        hierarchy: 90,
        permissions: [
            'org.view', 'org.members.invite', 'org.branding.manage', 'org.settings.manage',
            'roles.view', 'roles.manage',
            'events.view', 'events.create', 'events.edit', 'events.delete', 'events.members.invite',
            'venues.view', 'venues.manage',
            'catalog.view', 'catalog.manage',
            'layouts.view', 'layouts.create', 'layouts.edit', 'layouts.delete', 'layouts.publish',
            'guests.view', 'guests.manage', 'guests.assign', 'guests.import', 'guests.export',
            'rsvp.view', 'rsvp.submit', 'rsvp.manage',
            'portal.config.manage', 'portal.guest.view',
            'decor.view', 'decor.manage', 'decor.design',
            'vendors.view', 'vendors.manage', 'vendors.invite',
            'timeline.view', 'timeline.manage',
            'staff.view', 'staff.manage',
            'questions.view', 'questions.manage',
            'messages.send',
            'audit.view',
        ],
    },
    {
        id: SYSTEM_ROLE_IDS.planner,
        key: 'planner',
        name: 'Planner',
        description: 'Plans events end-to-end. No org-level admin powers.',
        hierarchy: 70,
        permissions: [
            'org.view',
            'roles.view',
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
    },
    {
        id: SYSTEM_ROLE_IDS.couple,
        key: 'couple',
        name: 'Couple',
        description: 'Bride/groom. Sees only their own event.',
        hierarchy: 50,
        permissions: [
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
    },
    {
        id: SYSTEM_ROLE_IDS.staff,
        key: 'staff',
        name: 'Staff',
        description: 'Day-of operations. View most things; manage timeline + own staff tasks.',
        hierarchy: 30,
        permissions: [
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
    },
    {
        id: SYSTEM_ROLE_IDS.vendor,
        key: 'vendor',
        name: 'Vendor',
        description: 'External vendor user (DJ, florist, caterer). Sees only their bookings + invoices.',
        hierarchy: 20,
        permissions: [
            'vendor.portal.view',
            'vendor.bookings.view',
            'vendor.invoices.manage',
            'messages.send',
        ],
    },
    {
        id: SYSTEM_ROLE_IDS.guest,
        key: 'guest',
        name: 'Guest',
        description: 'Wedding guest. Submits RSVP through the public portal.',
        hierarchy: 10,
        permissions: [
            'rsvp.submit',
            'portal.guest.view',
        ],
    },
];
//# sourceMappingURL=permissions.js.map