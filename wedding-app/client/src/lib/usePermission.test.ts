import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { usePermission, usePermissions, setPermissionContext } from './usePermission';

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
});
