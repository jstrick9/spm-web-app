import type { FixtureType, TableSpec, User, UserPermissions } from '../types';

function permissionEnabled(value: boolean | undefined, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function getPermissions(user: User | null | undefined): UserPermissions {
  return user?.permissions || {};
}

export function isAdminUser(user: User | null | undefined): boolean {
  return user?.role === 'admin';
}

export function isStaffUser(user: User | null | undefined): boolean {
  return user?.role === 'staff';
}

export function isGuestUser(user: User | null | undefined): boolean {
  return user?.role === 'guest';
}

export function canViewLayout(user: User | null | undefined): boolean {
  if (!user) return false;
  if (isAdminUser(user)) return true;
  return permissionEnabled(getPermissions(user).canViewLayout, true);
}

export function canEditLayout(user: User | null | undefined): boolean {
  if (!user) return false;
  if (isAdminUser(user) || isStaffUser(user)) return true;
  if (isGuestUser(user)) return false;
  return permissionEnabled(getPermissions(user).canEditLayout, true);
}

export function canManageGuests(user: User | null | undefined): boolean {
  if (!user) return false;
  if (isAdminUser(user) || isStaffUser(user)) return true;
  if (isGuestUser(user)) return false;
  return permissionEnabled(getPermissions(user).canManageGuests, true);
}

export function canPrintLayouts(user: User | null | undefined): boolean {
  if (!user) return false;
  if (isAdminUser(user) || isStaffUser(user)) return true;
  if (isGuestUser(user)) return false;
  return permissionEnabled(getPermissions(user).canPrint, true);
}

export function canExportLayouts(user: User | null | undefined): boolean {
  if (!user) return false;
  if (isAdminUser(user) || isStaffUser(user)) return true;
  if (isGuestUser(user)) return false;
  return permissionEnabled(getPermissions(user).canExport, true);
}

export function canAccessAdminPanel(user: User | null | undefined): boolean {
  return isAdminUser(user);
}

export function canManageUsers(user: User | null | undefined): boolean {
  return isAdminUser(user) || permissionEnabled(getPermissions(user).canInviteUsers, false);
}

export function canAccessOperationsPanel(user: User | null | undefined): boolean {
  return isAdminUser(user) || isStaffUser(user);
}

export function canManageOperationsData(user: User | null | undefined): boolean {
  return isAdminUser(user) || isStaffUser(user);
}

export function canUseTableSpec(user: User | null | undefined, spec: TableSpec): boolean {
  if (isAdminUser(user)) return true;
  if (!canEditLayout(user)) return false;
  return true;
}

export function canSeeFixtureType(user: User | null | undefined, fixture: FixtureType): boolean {
  if (isAdminUser(user)) return true;
  if (!canViewLayout(user)) return false;
  return fixture.visibleToUsers !== false;
}

export function canPlaceFixtureType(user: User | null | undefined, fixture: FixtureType): boolean {
  if (isAdminUser(user)) return true;
  if (!canEditLayout(user)) return false;
  if (fixture.visibleToUsers === false) return false;
  if (fixture.isSelectable === false) return false;
  return true;
}

export function canMoveFixture(user: User | null | undefined, fixture: FixtureType): boolean {
  if (fixture.isPermanent) return false;
  if (isAdminUser(user)) return true;
  if (!canEditLayout(user)) return false;
  if (fixture.isLocked) return false;
  return true;
}