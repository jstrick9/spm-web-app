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
 *
 * Phase 18.5 — comprehensive RBAC expansion covering all modules.
 */

export type PermissionId =
  // ─── Organization ─────────────────────────────────────
  | 'org.view'
  | 'org.manage'
  | 'org.members.invite'
  | 'org.members.remove'
  | 'org.branding.manage'
  | 'org.settings.manage'
  | 'platform.manage'

  // ─── Roles (the RBAC admin surface) ───────────────────
  | 'roles.view'
  | 'roles.manage'

  // ─── Events ───────────────────────────────────────────
  | 'events.view'
  | 'events.create'
  | 'events.edit'
  | 'events.delete'
  | 'events.members.invite'
  | 'events.stage.transition'   // advance an event between pipeline stages
  | 'events.final_review.decide'// make the final call on final-review change requests

  // ─── Venues + catalog ─────────────────────────────────
  | 'venues.view'
  | 'venues.manage'
  | 'catalog.view'
  | 'catalog.manage'

  // ─── Layouts ──────────────────────────────────────────
  | 'layouts.view'
  | 'layouts.create'
  | 'layouts.edit'
  | 'layouts.delete'
  | 'layouts.publish'

  // ─── Guests ───────────────────────────────────────────
  | 'guests.view'
  | 'guests.manage'
  | 'guests.assign'
  | 'guests.import'
  | 'guests.export'

  // ─── RSVPs ────────────────────────────────────────────
  | 'rsvp.view'
  | 'rsvp.submit'
  | 'rsvp.manage'

  // ─── Couple workspace ─────────────────────────────────
  | 'guests.couple.manage'      // couples only: own the guest list (create/edit/import/assign)

  // ─── Portal ───────────────────────────────────────────
  | 'portal.config.manage'
  | 'portal.guest.view'

  // ─── Decor ────────────────────────────────────────────
  | 'decor.view'
  | 'decor.manage'
  | 'decor.design'

  // ─── Vendors (venue-side: managing the vendor records) ─
  | 'vendors.view'
  | 'vendors.manage'
  | 'vendors.invite'           // invite a vendor as a USER

  // ─── Vendor portal (vendor-side: what a vendor user sees) ──
  | 'vendor.portal.view'       // log into the vendor portal at all
  | 'vendor.bookings.view'     // see events they are booked for
  | 'vendor.invoices.manage'   // submit / edit invoices

  // ─── Vendor check-in ──────────────────────────────────
  | 'vendors.checkin.view'     // view check-in screen
  | 'vendors.checkin.manage'   // perform check-in actions

  // ─── Timeline ─────────────────────────────────────────
  | 'timeline.view'
  | 'timeline.manage'

  // ─── Staff ops ────────────────────────────────────────
  | 'staff.view'
  | 'staff.manage'

  // ─── Event questions ──────────────────────────────────
  | 'questions.view'
  | 'questions.manage'

  // ─── Budget ───────────────────────────────────────────
  | 'budget.view'
  | 'budget.manage'

  // ─── Contracts ────────────────────────────────────────
  | 'contracts.view'
  | 'contracts.manage'
  | 'contracts.sign'
  | 'financial_legal.escalate'

  // ─── Gallery / mood boards ────────────────────────────
  | 'gallery.view'
  | 'gallery.manage'

  // ─── Invitations / email ──────────────────────────────
  | 'invites.view'
  | 'invites.manage'
  | 'invites.send'

  // ─── Feedback / polls ─────────────────────────────────
  | 'feedback.view'
  | 'feedback.manage'

  // ─── Messaging ────────────────────────────────────────
  | 'messages.view'
  | 'messages.send'

  // ─── Inventory ────────────────────────────────────────
  | 'inventory.view'
  | 'inventory.manage'

  // ─── Reports / analytics ──────────────────────────────
  | 'reports.view'

  // ─── Calendar ─────────────────────────────────────────
  | 'calendar.view'

  // ─── Notifications / push ─────────────────────────────
  | 'notifications.manage'

  // ─── Integrations ─────────────────────────────────────
  | 'integrations.view'
  | 'integrations.manage'

  // ─── Audit ────────────────────────────────────────────
  | 'audit.view';

export interface PermissionDefinition {
  id: PermissionId;
  label: string;
  description: string;
  category: 'organization' | 'roles' | 'events' | 'venues' | 'layouts'
          | 'guests' | 'rsvp' | 'portal' | 'decor' | 'vendors'
          | 'vendor_portal' | 'vendor_checkin' | 'timeline' | 'staff'
          | 'questions' | 'budget' | 'contracts' | 'gallery' | 'invites'
          | 'feedback' | 'messages' | 'inventory' | 'reports' | 'calendar'
          | 'notifications' | 'integrations' | 'audit';
}

export const PERMISSION_CATALOG: ReadonlyArray<PermissionDefinition> = [
  // Organization
  { id: 'org.view',              label: 'View organization',      description: 'See basic org info', category: 'organization' },
  { id: 'org.manage',            label: 'Manage organization',    description: 'Edit org name, delete org, transfer ownership', category: 'organization' },
  { id: 'org.members.invite',    label: 'Invite members',         description: 'Invite users to the org and assign their role', category: 'organization' },
  { id: 'org.members.remove',    label: 'Remove members',         description: 'Remove users from the org', category: 'organization' },
  { id: 'org.branding.manage',   label: 'Manage branding',        description: 'Edit colors, logo, custom CSS', category: 'organization' },
  { id: 'org.settings.manage',   label: 'Manage settings',        description: 'Edit org-wide settings', category: 'organization' },
  { id: 'platform.manage',       label: 'Manage platform',      description: 'Access system-level settings, audit log, integrations, and platform studio', category: 'organization' },

  // Roles
  { id: 'roles.view',            label: 'View roles',             description: 'See the list of roles', category: 'roles' },
  { id: 'roles.manage',          label: 'Manage roles',           description: 'Create / edit / delete custom roles and assign permissions', category: 'roles' },

  // Events
  { id: 'events.view',           label: 'View events',            description: 'See event list and details', category: 'events' },
  { id: 'events.create',         label: 'Create events',          description: 'Add new events', category: 'events' },
  { id: 'events.edit',           label: 'Edit events',            description: 'Modify event properties and status', category: 'events' },
  { id: 'events.delete',         label: 'Delete events',          description: 'Soft-delete events', category: 'events' },
  { id: 'events.members.invite', label: 'Invite event members',   description: 'Add couple/planner users to a specific event', category: 'events' },
  { id: 'events.stage.transition', label: 'Transition event stages', description: 'Advance events through pipeline stages (lead → hold → booked → planning → final review → completed)', category: 'events' },
  { id: 'events.final_review.decide', label: 'Decide final-review changes', description: 'Accept or decline final-review change requests from couples and planners', category: 'events' },

  // Venues + catalog
  { id: 'venues.view',           label: 'View venues',            description: 'See venue list and floor plans', category: 'venues' },
  { id: 'venues.manage',         label: 'Manage venues',          description: 'Add / edit / remove venues and floor plans', category: 'venues' },
  { id: 'catalog.view',          label: 'View catalog',           description: 'Tables, chairs, fixtures, linens, etc.', category: 'venues' },
  { id: 'catalog.manage',        label: 'Manage catalog',         description: 'Add / edit / remove catalog items', category: 'venues' },

  // Layouts
  { id: 'layouts.view',          label: 'View layouts',           description: 'See floor plan layouts', category: 'layouts' },
  { id: 'layouts.create',        label: 'Create layouts',         description: 'Create new floor plan layouts', category: 'layouts' },
  { id: 'layouts.edit',          label: 'Edit layouts',           description: 'Modify layout items, guest seats, etc.', category: 'layouts' },
  { id: 'layouts.delete',        label: 'Delete layouts',         description: 'Remove layouts', category: 'layouts' },
  { id: 'layouts.publish',       label: 'Publish layouts',        description: 'Mark a layout as the official version', category: 'layouts' },

  // Guests
  { id: 'guests.view',           label: 'View guests',            description: 'See guest lists', category: 'guests' },
  { id: 'guests.couple.manage',  label: 'Manage couple guest list', description: 'Create / edit / import / assign guests in the couple workspace (couples only)', category: 'guests' },
  { id: 'guests.manage',         label: 'Manage guests',          description: 'Add / edit / remove guests', category: 'guests' },
  { id: 'guests.assign',         label: 'Assign guests',          description: 'Assign guests to tables / rooms', category: 'guests' },
  { id: 'guests.import',         label: 'Import guests',          description: 'Bulk import from CSV', category: 'guests' },
  { id: 'guests.export',         label: 'Export guests',          description: 'Export guest list to CSV', category: 'guests' },

  // RSVPs
  { id: 'rsvp.view',             label: 'View RSVPs',             description: 'See RSVP submissions', category: 'rsvp' },
  { id: 'rsvp.submit',           label: 'Submit RSVP',            description: 'Submit an RSVP response', category: 'rsvp' },
  { id: 'rsvp.manage',           label: 'Manage RSVPs',           description: 'Edit submitted RSVPs after the fact', category: 'rsvp' },

  // Portal
  { id: 'portal.config.manage',  label: 'Manage guest portal',    description: 'Configure portal settings, passwords, access windows', category: 'portal' },
  { id: 'portal.guest.view',     label: 'View guest portal',      description: 'Access the public guest portal', category: 'portal' },

  // Decor
  { id: 'decor.view',            label: 'View decor catalog',     description: 'See decor items and arrangements', category: 'decor' },
  { id: 'decor.manage',          label: 'Manage decor catalog',   description: 'Add / edit / remove decor items', category: 'decor' },
  { id: 'decor.design',          label: 'Use decor designer',     description: 'Create / save decor arrangements', category: 'decor' },

  // Vendors (venue-side)
  { id: 'vendors.view',          label: 'View vendors',           description: 'See vendor list and details', category: 'vendors' },
  { id: 'vendors.manage',        label: 'Manage vendors',         description: 'Add / edit / remove vendor records, log payments', category: 'vendors' },
  { id: 'vendors.invite',        label: 'Invite vendor users',    description: 'Link a vendor record to a user account', category: 'vendors' },

  // Vendor portal (vendor-side)
  { id: 'vendor.portal.view',    label: 'Access vendor portal',   description: 'Log into the vendor-facing portal', category: 'vendor_portal' },
  { id: 'vendor.bookings.view',  label: 'View own bookings',      description: 'See events the vendor is booked for', category: 'vendor_portal' },
  { id: 'vendor.invoices.manage',label: 'Manage own invoices',    description: 'Submit invoices and track payment status', category: 'vendor_portal' },

  // Vendor check-in
  { id: 'vendors.checkin.view',  label: 'View check-in',          description: 'View the vendor check-in screen', category: 'vendor_checkin' },
  { id: 'vendors.checkin.manage',label: 'Perform check-ins',      description: 'Scan QR codes and mark vendors as arrived', category: 'vendor_checkin' },

  // Timeline
  { id: 'timeline.view',         label: 'View timeline',          description: 'See day-of schedule', category: 'timeline' },
  { id: 'timeline.manage',       label: 'Manage timeline',        description: 'Add / edit / remove timeline items', category: 'timeline' },

  // Staff
  { id: 'staff.view',            label: 'View staff ops',         description: 'See tasks, areas, shifts', category: 'staff' },
  { id: 'staff.manage',          label: 'Manage staff ops',       description: 'Create / assign / complete tasks, areas, shifts', category: 'staff' },

  // Event questions
  { id: 'questions.view',        label: 'View event questions',   description: 'See configured questions', category: 'questions' },
  { id: 'questions.manage',      label: 'Manage event questions', description: 'Create / edit / delete questions', category: 'questions' },

  // Budget
  { id: 'budget.view',           label: 'View budget',            description: 'See budget line items and totals', category: 'budget' },
  { id: 'budget.manage',         label: 'Manage budget',          description: 'Add / edit / remove budget items', category: 'budget' },

  // Contracts
  { id: 'contracts.view',        label: 'View contracts',         description: 'See contract list and details', category: 'contracts' },
  { id: 'contracts.manage',      label: 'Manage contracts',       description: 'Create / edit / delete contracts', category: 'contracts' },
  { id: 'contracts.sign',        label: 'Sign contracts',         description: 'Apply an e-signature to a contract', category: 'contracts' },
  // MODULE-06 FI-11: raising financial/legal escalations + go/no-go flags is
  // a deliberate ops action — view-only roles (staff, couple) must not do it.
  { id: 'financial_legal.escalate', label: 'Escalate financial/legal risks', description: 'Raise escalations and go/no-go flags on events', category: 'contracts' },

  // Gallery / mood boards
  { id: 'gallery.view',          label: 'View gallery',           description: 'See mood board images and categories', category: 'gallery' },
  { id: 'gallery.manage',        label: 'Manage gallery',         description: 'Upload / categorize / remove images', category: 'gallery' },

  // Invitations
  { id: 'invites.view',          label: 'View invitations',       description: 'See invitation templates and tracking', category: 'invites' },
  { id: 'invites.manage',        label: 'Manage invitations',     description: 'Create / edit invitation designs', category: 'invites' },
  { id: 'invites.send',          label: 'Send invitations',       description: 'Dispatch invitations to guests', category: 'invites' },

  // Feedback / polls
  { id: 'feedback.view',         label: 'View feedback & polls',  description: 'See poll results and feedback submissions', category: 'feedback' },
  { id: 'feedback.manage',       label: 'Manage feedback & polls',description: 'Create / edit polls and manage feedback', category: 'feedback' },

  // Messaging
  { id: 'messages.view',         label: 'View messages',          description: 'Read direct message threads', category: 'messages' },
  { id: 'messages.send',         label: 'Send direct messages',   description: 'Send messages in threads', category: 'messages' },

  // Inventory
  { id: 'inventory.view',        label: 'View inventory',         description: 'See inventory items, stock levels', category: 'inventory' },
  { id: 'inventory.manage',      label: 'Manage inventory',       description: 'Add / edit / check out / return items', category: 'inventory' },

  // Reports / analytics
  { id: 'reports.view',          label: 'View reports',           description: 'Access analytics dashboard and export data', category: 'reports' },

  // Calendar
  { id: 'calendar.view',         label: 'View calendar',          description: 'See the global event calendar', category: 'calendar' },

  // Notifications
  { id: 'notifications.manage',  label: 'Manage notifications',   description: 'Configure push notification subscriptions', category: 'notifications' },

  // Integrations
  { id: 'integrations.view',     label: 'View integrations',      description: 'See configured integrations', category: 'integrations' },
  { id: 'integrations.manage',   label: 'Manage integrations',    description: 'Add / edit / remove integrations, test connections', category: 'integrations' },

  // Audit
  { id: 'audit.view',            label: 'View audit log',         description: 'See all org activity', category: 'audit' },
];

// O(1) lookup
const _set = new Set<string>(PERMISSION_CATALOG.map((p) => p.id));
export function isValidPermissionId(id: string): id is PermissionId {
  return _set.has(id);
}

// ─── System roles ─────────────────────────────────────
export type SystemRoleKey =
  | 'owner' | 'admin' | 'manager' | 'planner' | 'couple' | 'staff' | 'vendor' | 'guest';

export const SYSTEM_ROLE_IDS: Record<SystemRoleKey, string> = {
  owner:   'sys_owner',
  admin:   'sys_admin',
  manager: 'sys_manager',
  planner: 'sys_planner',
  couple:  'sys_couple',
  staff:   'sys_staff',
  vendor:  'sys_vendor',
  guest:   'sys_guest',
};

export interface SystemRoleDefinition {
  id: string;
  key: SystemRoleKey;
  name: string;
  description: string;
  hierarchy: number;
  permissions: ReadonlyArray<PermissionId>;
}

// ─── Every permission id (for the "grant all" roles) ────
// `vendor.*` permissions are vendor-side only, and `guests.couple.manage` is
// couple-only: even owner/admin roles must NOT gain couple guest-list
// ownership (the venue has read-only operational guest visibility).
const ALL_INTERNAL_PERMISSIONS: ReadonlyArray<PermissionId> = PERMISSION_CATALOG
  .filter(p => !p.id.startsWith('vendor.') && p.id !== 'guests.couple.manage')
  .map(p => p.id);

export const SYSTEM_ROLE_DEFINITIONS: ReadonlyArray<SystemRoleDefinition> = [
  {
    id: SYSTEM_ROLE_IDS.owner,
    key: 'owner',
    name: 'Owner',
    description: 'Full control of the organization. Cannot be removed; transferable.',
    hierarchy: 100,
    permissions: ALL_INTERNAL_PERMISSIONS,
  },
  {
    id: SYSTEM_ROLE_IDS.admin,
    key: 'admin',
    name: 'Admin',
    description: 'Manages everything except destroying the organization itself.',
    hierarchy: 90,
    permissions: ALL_INTERNAL_PERMISSIONS.filter(p => p !== 'org.manage'),
  },
  {
    id: SYSTEM_ROLE_IDS.manager,
    key: 'manager',
    name: 'Venue Manager',
    description: 'Runs venue operations, event-week execution, staff/vendor coordination, and escalations without owner-level admin powers.',
    hierarchy: 75,
    permissions: [
      'org.view',
      'roles.view',
      'events.view','events.create','events.edit','events.members.invite',
      'events.stage.transition','events.final_review.decide',
      'venues.view',
      'catalog.view',
      'layouts.view','layouts.create','layouts.edit','layouts.publish',
      'guests.view','guests.manage','guests.assign','guests.import','guests.export',
      'rsvp.view','rsvp.submit',
      'portal.config.manage','portal.guest.view',
      'decor.view','decor.design',
      'vendors.view','vendors.manage',
      'vendors.checkin.view','vendors.checkin.manage',
      'timeline.view','timeline.manage',
      'staff.view','staff.manage',
      'questions.view',
      'budget.view',
      'contracts.view',
      'financial_legal.escalate',
      'gallery.view','gallery.manage',
      'invites.view','invites.manage','invites.send',
      'feedback.view','feedback.manage',
      'messages.view','messages.send',
      'inventory.view','inventory.manage',
      'reports.view',
      'calendar.view',
      'notifications.manage',
      'integrations.view',
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
      'events.view','events.create','events.edit','events.members.invite',
      'venues.view',
      'catalog.view',
      // Layouts: planners draft and propose, but final layout approval is
      // venue-owned (blueprint §7) — no layouts.publish for planner.
      'layouts.view','layouts.create','layouts.edit',
      'guests.view','guests.manage','guests.assign','guests.import','guests.export',
      'rsvp.view','rsvp.submit',
      'portal.config.manage','portal.guest.view',
      'decor.view','decor.design',
      'vendors.view','vendors.manage',
      'vendors.checkin.view','vendors.checkin.manage',
      'timeline.view','timeline.manage',
      'staff.view',
      'questions.view',
      'budget.view','budget.manage',
      'contracts.view','contracts.manage',
      'financial_legal.escalate',
      // MODULE-06 FI-01: the finance role (planner) may countersign contracts;
      // couples sign through the couple-finance path; owner/admin get it via
      // ALL_INTERNAL_PERMISSIONS. The ops-manager role stays finance view-only.
      'contracts.sign',
      'gallery.view','gallery.manage',
      'invites.view','invites.manage','invites.send',
      'feedback.view','feedback.manage',
      'messages.view','messages.send',
      'inventory.view',
      'reports.view',
      'calendar.view',
      'notifications.manage',
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
      'layouts.view','layouts.create','layouts.edit',
      'guests.view','guests.couple.manage','guests.manage','guests.assign','guests.import','guests.export',
      'rsvp.view','rsvp.submit',
      'portal.guest.view',
      // MODULE-05 ST-02: couples do NOT hold timeline.view — the full internal
      // timeline (notes, vendor ids, assignments) is ops-internal. Couples get
      // the sanitized schedule via /api/events/:id/couple-schedule.
      'messages.view','messages.send',
      'calendar.view',
      'notifications.manage',
    ],
  },
  {
    id: SYSTEM_ROLE_IDS.staff,
    key: 'staff',
    name: 'Staff',
    description: 'Day-of operations. View most things; manage timeline and their own staff tasks (assignee self-service).',
    hierarchy: 30,
    permissions: [
      'events.view',
      'venues.view',
      'layouts.view',
      'guests.view',
      'rsvp.view',
      'decor.view',
      'vendors.view',
      'vendors.checkin.view','vendors.checkin.manage',
      'timeline.view','timeline.manage',
      // MODULE-05 ST-08: staff role manages its OWN tasks (status/checklist/notes
      // via assignee self-service), not org-wide staff ops (no staff.manage).
      'staff.view',
      'budget.view',
      'gallery.view',
      'feedback.view',
      'messages.view','messages.send',
      'calendar.view',
      'notifications.manage',
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
      'messages.view','messages.send',
      'notifications.manage',
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
