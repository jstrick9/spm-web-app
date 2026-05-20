import './../test/setup.js';
import { describe, it, expect } from 'vitest';
import { can, resolvePermissions, rolesGranting, type Membership } from './rbac.js';

describe('rbac.resolvePermissions', () => {
  it('returns empty set for user with no memberships', () => {
    expect(resolvePermissions([], {}).size).toBe(0);
  });

  it('returns owner permissions in the right org', () => {
    const m: Membership[] = [{ organizationId: 'org1', role: 'owner' }];
    expect(can(m, { organizationId: 'org1' }, 'events.create')).toBe(true);
    expect(can(m, { organizationId: 'org1' }, 'audit.view')).toBe(true);
  });

  it('isolates orgs - owner of A has no perms in B', () => {
    const m: Membership[] = [{ organizationId: 'orgA', role: 'owner' }];
    expect(can(m, { organizationId: 'orgB' }, 'events.create')).toBe(false);
  });

  it('couple event-membership grants event-scoped permissions', () => {
    const m: Membership[] = [{ eventId: 'evt1', role: 'couple' }];
    expect(can(m, { eventId: 'evt1' }, 'guests.manage')).toBe(true);
    // ...but no org-level perms
    expect(can(m, { eventId: 'evt1' }, 'org.manage')).toBe(false);
  });

  it('org admin has perms on events in their org via the orgMap bridge', () => {
    const m: Membership[] = [{ organizationId: 'org1', role: 'admin' }];
    const orgMap = { evt1: 'org1' };
    expect(can(m, { eventId: 'evt1' }, 'guests.manage', orgMap)).toBe(true);
    // unknown event isn't bridged
    expect(can(m, { eventId: 'evtX' }, 'guests.manage', orgMap)).toBe(false);
  });

  it('staff cannot manage events', () => {
    const m: Membership[] = [{ organizationId: 'org1', role: 'staff' }];
    expect(can(m, { organizationId: 'org1' }, 'events.create')).toBe(false);
    expect(can(m, { organizationId: 'org1' }, 'events.view')).toBe(true);
  });

  it('guest can submit RSVP but nothing else', () => {
    const m: Membership[] = [{ eventId: 'evt1', role: 'guest' }];
    expect(can(m, { eventId: 'evt1' }, 'rsvp.submit')).toBe(true);
    expect(can(m, { eventId: 'evt1' }, 'guests.manage')).toBe(false);
    expect(can(m, { eventId: 'evt1' }, 'layouts.view')).toBe(false);
  });

  it('multiple memberships union their permissions', () => {
    const m: Membership[] = [
      { organizationId: 'org1', role: 'staff' },
      { eventId: 'evt1', role: 'couple' },
    ];
    const orgMap = { evt1: 'org1' };
    expect(can(m, { eventId: 'evt1' }, 'guests.manage', orgMap)).toBe(true);
    expect(can(m, { eventId: 'evt1' }, 'staff.view', orgMap)).toBe(true);
  });

  it('rolesGranting lists every role that has a permission', () => {
    const roles = rolesGranting('events.create');
    expect(roles).toContain('owner');
    expect(roles).toContain('admin');
    expect(roles).toContain('planner');
    expect(roles).not.toContain('guest');
  });
});
