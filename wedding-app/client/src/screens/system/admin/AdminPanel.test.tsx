import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AdminPanel } from './AdminPanel';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '../../../ui/Toast';

vi.mock('../../../sdk', () => ({
  sdk: {
    roles: {
      listRoles: vi.fn().mockResolvedValue({
        roles: [
          { id: 'r1', name: 'Owner', key: 'owner', is_system: 1, permissions: ['p1', 'org.view'] },
          { id: 'r2', name: 'Vendor', key: 'vendor', is_system: 1, permissions: [] },
          { id: 'r3', name: 'Venue Manager', key: 'manager', is_system: 1, permissions: ['events.view', 'staff.view', 'vendors.view'] },
        ],
      }),
      permissionCatalog: vi.fn().mockResolvedValue({
        catalog: [{ id: 'p1', label: 'Manage Events', category: 'Events', description: 'Can create events' }],
      }),
      listMembers: vi.fn().mockResolvedValue({
        members: [{ userId: 'u1', email: 'owner@test.com', fullName: 'Owner', roleName: 'Owner' }],
      }),
    },
    platformConfig: {
      getOrg: vi.fn().mockResolvedValue({ config: {} }),
      putOrg: vi.fn().mockResolvedValue({ config: {} }),
      listAdminChangeRequests: vi.fn().mockResolvedValue({ requests: [{ id: 'acr1', title: 'Enable SMS alerts', area: 'notifications', reason: 'Managers need day-of notices', status: 'open', created_at: '2026-06-09' }] }),
      createAdminChangeRequest: vi.fn().mockResolvedValue({ request: { id: 'acr2' } }),
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
  beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); });


  it('renders manager configuration viewer and change request queue in manager mode', async () => {
    localStorage.setItem('wvi_registration_role', 'venue_manager');
    render(<AdminPanel orgId="org-1" />, { wrapper: makeWrapper() });
    expect(await screen.findByText('Manager configuration viewer')).toBeTruthy();
    expect(screen.getByText('Request admin change')).toBeTruthy();
    expect(screen.getByText('Venue Manager role policy pack')).toBeTruthy();
    expect(screen.getByText('What settings affect my workflow?')).toBeTruthy();
    expect(screen.getByText('Venue SOP library')).toBeTruthy();
    expect(screen.getByText('Manager-readable audit summaries')).toBeTruthy();
    expect(await screen.findByText('Enable SMS alerts')).toBeTruthy();
    expect(screen.getByText('Owner/admin escalation contacts')).toBeTruthy();
  });

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

  it('separates required setup from advanced tools', async () => {
    render(<AdminPanel orgId="org-1" />, { wrapper: makeWrapper() });
    expect(screen.getByRole('button', { name: /Required setup/i })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Advanced tools/i }));
    expect(await screen.findByRole('tab', { name: /Default templates/i })).toBeTruthy();
    expect(screen.getByRole('tab', { name: /System health/i })).toBeTruthy();
  });

  it('renders setup checklist manager with diff/restore controls', async () => {
    const user = userEvent.setup();
    render(<AdminPanel orgId="org-1" />, { wrapper: makeWrapper() });
    await user.click(screen.getByRole('tab', { name: /Setup checklist/i }));
    expect(await screen.findByText(/Setup checklist manager/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Restore defaults/i })).toBeTruthy();
    expect(screen.getByText(/Save diff \/ confirmation/i)).toBeTruthy();
  });
});
