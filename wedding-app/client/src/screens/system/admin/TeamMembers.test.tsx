import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TeamMembers } from './TeamMembers';

vi.mock('../../../sdk', () => ({
  sdk: {
    roles: {
      listMembers: vi.fn().mockResolvedValue({
        members: [
          { userId: 'u1', email: 'owner@venue.com', fullName: 'Venue Owner', roleName: 'Owner', roleKey: 'owner' },
          { userId: 'u2', email: 'planner@venue.com', fullName: 'Head Planner', roleName: 'Planner', roleKey: 'planner' },
        ],
      }),
      listRoles: vi.fn().mockResolvedValue({
        roles: [
          { id: 'sys_admin', key: 'admin', name: 'Admin', description: 'Manages everything' },
          { id: 'sys_planner', key: 'planner', name: 'Planner', description: 'Plans events' },
          { id: 'sys_staff', key: 'staff', name: 'Staff', description: 'Day-of ops' },
        ],
      }),
      addMember: vi.fn().mockResolvedValue({}),
      removeMember: vi.fn().mockResolvedValue({}),
    },
  },
}));

vi.mock('../../../ui/Toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));

function wrap() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

describe('TeamMembers', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('renders team members list', async () => {
    render(<TeamMembers orgId="org1" />, { wrapper: wrap() });
    await waitFor(() => {
      expect(screen.getByText('Venue Owner')).toBeTruthy();
      expect(screen.getByText('Head Planner')).toBeTruthy();
    });
  });

  it('shows member roles', async () => {
    render(<TeamMembers orgId="org1" />, { wrapper: wrap() });
    await waitFor(() => {
      expect(screen.getByText('Owner')).toBeTruthy();
      expect(screen.getByText('Planner')).toBeTruthy();
    });
  });

  it('shows invite button', async () => {
    render(<TeamMembers orgId="org1" />, { wrapper: wrap() });
    await waitFor(() => {
      expect(screen.getByText('Invite Member')).toBeTruthy();
    });
  });

  it('shows member emails', async () => {
    render(<TeamMembers orgId="org1" />, { wrapper: wrap() });
    await waitFor(() => {
      expect(screen.getByText('owner@venue.com')).toBeTruthy();
      expect(screen.getByText('planner@venue.com')).toBeTruthy();
    });
  });
});
