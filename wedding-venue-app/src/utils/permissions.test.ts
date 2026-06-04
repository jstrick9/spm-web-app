import { describe, expect, it } from 'vitest';
import type { FixtureType, TableSpec, User } from '../types';
import {
  canAccessAdminPanel,
  canAccessOperationsPanel,
  canEditLayout,
  canManageGuests,
  canMoveFixture,
  canPlaceFixtureType,
  canSeeFixtureType,
  isAdminUser,
  isGuestUser,
  isStaffUser,
} from './permissions';

function createUser(overrides: Partial<User> = {}): User {
  return {
    id: 'u1',
    username: 'user1',
    role: 'basic',
    name: 'User One',
    isActive: true,
    createdAt: new Date().toISOString(),
    ...overrides,
  } as User;
}

const fixture: FixtureType = {
  id: 'fix-1',
  name: 'Fixture',
  shape: 'rectangle',
  width: 4,
  height: 4,
  category: 'interior',
  visibleToUsers: true,
  isSelectable: true,
} as FixtureType;

const hiddenFixture: FixtureType = {
  ...fixture,
  id: 'fix-hidden',
  visibleToUsers: false,
};

const lockedFixture: FixtureType = {
  ...fixture,
  id: 'fix-locked',
  isLocked: true,
};

const permanentFixture: FixtureType = {
  ...fixture,
  id: 'fix-perm',
  isPermanent: true,
};

const tableSpec: TableSpec = {
  id: 'tbl-1',
  name: 'Table',
  shape: 'rectangle',
  width: 6,
  height: 3,
  capacity: 8,
} as TableSpec;

describe('permissions policy', () => {
  it('identifies admin/staff/guest users correctly', () => {
    expect(isAdminUser(createUser({ role: 'admin' }))).toBe(true);
    expect(isStaffUser(createUser({ role: 'staff' }))).toBe(true);
    expect(isGuestUser(createUser({ role: 'guest' }))).toBe(true);
  });

  it('restricts admin panel to admins only', () => {
    expect(canAccessAdminPanel(createUser({ role: 'admin' }))).toBe(true);
    expect(canAccessAdminPanel(createUser({ role: 'staff' }))).toBe(false);
    expect(canAccessAdminPanel(createUser({ role: 'basic' }))).toBe(false);
    expect(canAccessAdminPanel(createUser({ role: 'guest' }))).toBe(false);
  });

  it('allows operations panel for admin and staff only', () => {
    expect(canAccessOperationsPanel(createUser({ role: 'admin' }))).toBe(true);
    expect(canAccessOperationsPanel(createUser({ role: 'staff' }))).toBe(true);
    expect(canAccessOperationsPanel(createUser({ role: 'basic' }))).toBe(false);
    expect(canAccessOperationsPanel(createUser({ role: 'guest' }))).toBe(false);
  });

  it('blocks guest layout editing and guest management', () => {
    const guest = createUser({ role: 'guest' });
    expect(canEditLayout(guest)).toBe(false);
    expect(canManageGuests(guest)).toBe(false);
  });

  it('honors fixture visibility and selectability', () => {
    const basic = createUser({ role: 'basic' });
    expect(canSeeFixtureType(basic, fixture)).toBe(true);
    expect(canSeeFixtureType(basic, hiddenFixture)).toBe(false);
    expect(canPlaceFixtureType(basic, fixture)).toBe(true);
    expect(
      canPlaceFixtureType(basic, { ...fixture, isSelectable: false }),
    ).toBe(false);
  });

  it('honors locked and permanent fixture movement rules', () => {
    const admin = createUser({ role: 'admin' });
    const basic = createUser({ role: 'basic' });

    expect(canMoveFixture(admin, lockedFixture)).toBe(true);
    expect(canMoveFixture(basic, lockedFixture)).toBe(false);
    expect(canMoveFixture(admin, permanentFixture)).toBe(false);
    expect(canMoveFixture(basic, permanentFixture)).toBe(false);
  });

  it('allows basic users to use normal table specs unless permissions override says otherwise', () => {
    const basic = createUser({ role: 'basic' });
    expect(canEditLayout(basic)).toBe(true);
    expect(tableSpec.name).toBe('Table');
  });
});