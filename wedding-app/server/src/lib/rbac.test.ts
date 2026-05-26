import './../test/setup.js';
import { describe, it, expect, beforeAll } from 'vitest';
import { can, resolvePermissions, type Membership } from './rbac.js';
import { SYSTEM_ROLE_IDS } from './permissions.js';
import { rolesRepo } from '../db/repos/roles.js';

beforeAll(() => {
  // setup.ts seeds system roles, but make sure the cache is warm for these
  // sync tests by forcing a lookup once.
  rolesRepo.ensureSystemRoles();
});

const OWNER   = SYSTEM_ROLE_IDS.owner;
const ADMIN   = SYSTEM_ROLE_IDS.admin;
const PLANNER = SYSTEM_ROLE_IDS.planner;
const COUPLE  = SYSTEM_ROLE_IDS.couple;
const STAFF   = SYSTEM_ROLE_IDS.staff;
const VENDOR  = SYSTEM_ROLE_IDS.vendor;
const GUEST   = SYSTEM_ROLE_IDS.guest;

describe('rbac.resolvePermissions', () => {
  it('returns empty set for user with no memberships', () => {
    expect(resolvePermissions([], {}).size).toBe(0);
  });

  it('returns owner permissions in the right org', () => {
    const m: Membership[] = [{ organizationId: 'org1', roleId: OWNER }];
    expect(can(m, { organizationId: 'org1' }, 'events.create')).toBe(true);
    expect(can(m, { organizationId: 'org1' }, 'audit.view')).toBe(true);
    expect(can(m, { organizationId: 'org1' }, 'roles.manage')).toBe(true);
  });

  it('isolates orgs - owner of A has no perms in B', () => {
    const m: Membership[] = [{ organizationId: 'orgA', roleId: OWNER }];
    expect(can(m, { organizationId: 'orgB' }, 'events.create')).toBe(false);
  });

  it('couple event-membership grants event-scoped permissions', () => {
    const m: Membership[] = [{ eventId: 'evt1', roleId: COUPLE }];
    expect(can(m, { eventId: 'evt1' }, 'guests.manage')).toBe(true);
    expect(can(m, { eventId: 'evt1' }, 'org.manage')).toBe(false);
  });

  it('org admin has perms on events in their org via the orgMap bridge', () => {
    const m: Membership[] = [{ organizationId: 'org1', roleId: ADMIN }];
    const orgMap = { evt1: 'org1' };
    expect(can(m, { eventId: 'evt1' }, 'guests.manage', orgMap)).toBe(true);
    expect(can(m, { eventId: 'evtX' }, 'guests.manage', orgMap)).toBe(false);
  });

  it('staff cannot manage events', () => {
    const m: Membership[] = [{ organizationId: 'org1', roleId: STAFF }];
    expect(can(m, { organizationId: 'org1' }, 'events.create')).toBe(false);
    expect(can(m, { organizationId: 'org1' }, 'events.view')).toBe(true);
  });

  it('guest can submit RSVP but nothing else', () => {
    const m: Membership[] = [{ eventId: 'evt1', roleId: GUEST }];
    expect(can(m, { eventId: 'evt1' }, 'rsvp.submit')).toBe(true);
    expect(can(m, { eventId: 'evt1' }, 'guests.manage')).toBe(false);
    expect(can(m, { eventId: 'evt1' }, 'layouts.view')).toBe(false);
  });

  it('vendor sees vendor portal but no venue internals', () => {
    const m: Membership[] = [{ organizationId: 'org1', roleId: VENDOR }];
    expect(can(m, { organizationId: 'org1' }, 'vendor.portal.view')).toBe(true);
    expect(can(m, { organizationId: 'org1' }, 'vendor.bookings.view')).toBe(true);
    expect(can(m, { organizationId: 'org1' }, 'vendor.invoices.manage')).toBe(true);
    // negative space
    expect(can(m, { organizationId: 'org1' }, 'guests.view')).toBe(false);
    expect(can(m, { organizationId: 'org1' }, 'layouts.view')).toBe(false);
    expect(can(m, { organizationId: 'org1' }, 'events.view')).toBe(false);
  });

  it('multiple memberships union their permissions', () => {
    const m: Membership[] = [
      { organizationId: 'org1', roleId: STAFF },
      { eventId: 'evt1', roleId: COUPLE },
    ];
    const orgMap = { evt1: 'org1' };
    expect(can(m, { eventId: 'evt1' }, 'guests.manage', orgMap)).toBe(true);
    expect(can(m, { eventId: 'evt1' }, 'staff.view', orgMap)).toBe(true);
  });

  it('planner has roles.view but not roles.manage', () => {
    const m: Membership[] = [{ organizationId: 'org1', roleId: PLANNER }];
    expect(can(m, { organizationId: 'org1' }, 'roles.view')).toBe(true);
    expect(can(m, { organizationId: 'org1' }, 'roles.manage')).toBe(false);
  });
});

describe('rbac with custom roles', () => {
  let ownerUserId: string;
  let orgId: string;
  let customRoleId: string;

  beforeAll(async () => {
    const { makeUser, makeOrg } = await import('../test/factories.js');
    const { user } = makeUser({ email: `rbac-test-owner-${Date.now()}@x.com` });
    ownerUserId = user.id;
    const org = makeOrg(ownerUserId);
    orgId = org.id;

    // Create a custom role: a "Finance Viewer" with audit + vendor view only
    const role = rolesRepo.createCustom({
      organizationId: orgId,
      key: 'finance-viewer',
      name: 'Finance Viewer',
      permissions: ['audit.view', 'vendors.view'],
      createdBy: ownerUserId,
    });
    customRoleId = role.id;
  });

  it('custom role grants exactly the permissions it was given', () => {
    const m: Membership[] = [{ organizationId: orgId, roleId: customRoleId }];
    expect(can(m, { organizationId: orgId }, 'audit.view')).toBe(true);
    expect(can(m, { organizationId: orgId }, 'vendors.view')).toBe(true);
    expect(can(m, { organizationId: orgId }, 'events.create')).toBe(false);
    expect(can(m, { organizationId: orgId }, 'guests.view')).toBe(false);
  });

  it('updating a custom role takes effect after invalidation', () => {
    rolesRepo.updateCustom(customRoleId, {
      permissions: ['audit.view', 'vendors.view', 'guests.view'],
    });
    const m: Membership[] = [{ organizationId: orgId, roleId: customRoleId }];
    expect(can(m, { organizationId: orgId }, 'guests.view')).toBe(true);
  });

  it('rejects unknown permission ids', () => {
    expect(() => rolesRepo.createCustom({
      organizationId: orgId,
      key: 'bogus',
      name: 'B',
      permissions: ['no.such.permission' as never],
      createdBy: ownerUserId,
    })).toThrow(/unknown-permission/);
  });

  it('refuses to update system roles', () => {
    expect(() => rolesRepo.updateCustom(SYSTEM_ROLE_IDS.admin, { name: 'Hacked' }))
      .toThrow(/system-role-immutable/);
  });

  it('refuses to delete system roles', () => {
    expect(() => rolesRepo.deleteCustom(SYSTEM_ROLE_IDS.owner))
      .toThrow(/system-role-immutable/);
  });

  it('rejects duplicate role key in the same org', () => {
    expect(() => rolesRepo.createCustom({
      organizationId: orgId,
      key: 'finance-viewer',
      name: 'Dup',
      permissions: ['audit.view'],
      createdBy: ownerUserId,
    })).toThrow(/role-key-already-exists/);
  });
});
