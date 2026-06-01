import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AdminPanel } from './AdminPanel';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '../../../ui/Toast';

vi.mock('../../../sdk', () => ({
  sdk: {
    roles: {
      listRoles: vi.fn().mockResolvedValue({
        roles: [
          { id: 'r1', name: 'Owner', key: 'owner', is_system: 1, permissions: ['org.view'] },
          { id: 'r2', name: 'Vendor', key: 'vendor', is_system: 1, permissions: [] },
        ],
      }),
      permissionCatalog: vi.fn().mockResolvedValue({
        catalog: [{ id: 'p1', label: 'Manage Events', category: 'Events', description: 'Can create events' }],
      }),
      listMembers: vi.fn().mockResolvedValue({
        members: [{ userId: 'u1', email: 'owner@test.com', fullName: 'Owner', roleName: 'Owner' }],
      }),
    },
  },
}));

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>
      <ToastProvider>{children}</ToastProvider>
    </QueryClientProvider>
  );
}

describe('AdminPanel', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('renders Team Members tab by default', async () => {
    render(<AdminPanel orgId="org-1" />, { wrapper: makeWrapper() });
    await waitFor(() => {
      expect(screen.getAllByText('Team Members').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('shows team member data', async () => {
    render(<AdminPanel orgId="org-1" />, { wrapper: makeWrapper() });
    await waitFor(() => {
      expect(screen.getByText('owner@test.com')).toBeTruthy();
    });
  });

  it('can switch between tabs without crashing', async () => {
    render(<AdminPanel orgId="org-1" />, { wrapper: makeWrapper() });
    // Default tab is Team
    await waitFor(() => {
      expect(screen.getByText('Invite Member')).toBeTruthy();
    });
    // Switch to Permissions — should not crash
    const tabs = screen.getAllByRole('tab');
    const permTab = tabs.find(t => t.textContent?.includes('Permissions'));
    if (permTab) fireEvent.click(permTab);
    // The component should still be rendered
    expect(screen.getAllByRole('tab').length).toBeGreaterThanOrEqual(4);
  });

  it('has all admin tabs', async () => {
    render(<AdminPanel orgId="org-1" />, { wrapper: makeWrapper() });
    const tabs = screen.getAllByRole('tab');
    expect(tabs.length).toBeGreaterThanOrEqual(4);
  });
});
