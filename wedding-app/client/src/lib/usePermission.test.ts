import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { usePermission, usePermissionGate, usePermissions, setPermissionContext } from './usePermission';

// Mock SDK to return role definitions
vi.mock('../sdk', () => ({
  sdk: {
    roles: {
      listRoles: vi.fn().mockResolvedValue({
        roles: [
          { id: 'sys_owner', permissions: ['events.view', 'events.create', 'budget.view', 'budget.manage', 'reports.view'] },
          { id: 'sys_staff', permissions: ['events.view', 'staff.view', 'staff.manage'] },
          { id: 'sys_guest', permissions: ['rsvp.submit', 'portal.guest.view'] },
        ],
      }),
    },
  },
}));

describe('usePermission', () => {
  let qc: QueryClient;

  beforeEach(() => {
    qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });

  function wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: qc }, children);
  }

  it('returns true for permission the user has', async () => {
    setPermissionContext('org1', [{ organizationId: 'org1', roleId: 'sys_owner', roleKey: 'owner', roleName: 'Owner' }]);
    
    const { result, rerender } = renderHook(() => usePermission('events.view'), { wrapper });
    // Wait for the query to resolve
    await new Promise(r => setTimeout(r, 100));
    rerender();
    expect(result.current).toBe(true);
  });

  it('returns false for permission the user lacks', async () => {
    setPermissionContext('org1', [{ organizationId: 'org1', roleId: 'sys_guest', roleKey: 'guest', roleName: 'Guest' }]);
    
    const { result, rerender } = renderHook(() => usePermission('events.create'), { wrapper });
    await new Promise(r => setTimeout(r, 100));
    rerender();
    expect(result.current).toBe(false);
  });

  it('usePermissions returns map of all checked permissions', async () => {
    setPermissionContext('org1', [{ organizationId: 'org1', roleId: 'sys_owner', roleKey: 'owner', roleName: 'Owner' }]);
    
    const { result, rerender } = renderHook(
      () => usePermissions(['budget.view', 'budget.manage', 'staff.manage']),
      { wrapper }
    );
    await new Promise(r => setTimeout(r, 100));
    rerender();
    expect(result.current['budget.view']).toBe(true);
    expect(result.current['budget.manage']).toBe(true);
    expect(result.current['staff.manage']).toBe(false); // owner doesn't have this in mock
  });

  it('handles empty memberships gracefully', async () => {
    setPermissionContext('org1', []);
    
    const { result, rerender } = renderHook(() => usePermission('events.view'), { wrapper });
    await new Promise(r => setTimeout(r, 100));
    rerender();
    expect(result.current).toBe(false);
  });

  it('resolves permissions from the embedded membership list when the roles query is not available (staff lacks roles.view)', async () => {
    // Regression: staff/planner do NOT have roles.view, so GET roles 403s and
    // the role map stays empty — the embedded permissions array (auth/me)
    // must keep every gate working instead of locking staff out of the app.
    setPermissionContext('org1', [{
      organizationId: 'org1', roleId: 'sys_staff', roleKey: 'staff', roleName: 'Staff',
      permissions: ['events.view', 'guests.view', 'staff.view', 'timeline.view'],
    }]);

    const { result, rerender } = renderHook(
      () => usePermissions(['events.view', 'guests.view', 'staff.manage', 'platform.manage']),
      { wrapper },
    );
    await new Promise(r => setTimeout(r, 100));
    rerender();
    expect(result.current['events.view']).toBe(true);
    expect(result.current['guests.view']).toBe(true);
    expect(result.current['staff.manage']).toBe(false);
    expect(result.current['platform.manage']).toBe(false);
  });

  it('usePermissionGate allows a staff-like membership via embedded permissions', async () => {
    setPermissionContext('org1', [{
      organizationId: 'org1', roleId: 'sys_staff', roleKey: 'staff', roleName: 'Staff',
      permissions: ['events.view'],
    }]);

    const { result, rerender } = renderHook(() => usePermissionGate('events.view'), { wrapper });
    await new Promise(r => setTimeout(r, 100));
    rerender();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.allowed).toBe(true);
  });

  it('usePermissionGate exposes loading and allowed states for route guards', async () => {
    setPermissionContext('org1', [{ organizationId: 'org1', roleId: 'sys_owner', roleKey: 'owner', roleName: 'Owner' }]);

    const { result, rerender } = renderHook(() => usePermissionGate('reports.view'), { wrapper });
    expect(result.current.isLoading).toBe(true);

    await new Promise(r => setTimeout(r, 100));
    rerender();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.allowed).toBe(true);
  });
});
