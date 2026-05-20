import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { AdminPanel } from './AdminPanel';
import { vi } from 'vitest';

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'admin-1',
      username: 'admin',
      role: 'admin',
      name: 'Admin User',
      isActive: true,
      createdAt: new Date().toISOString(),
    },
    isAdmin: true,
    isBasicUser: false,
    isGuest: false,
    login: vi.fn(),
    logout: vi.fn(),
    continueAsGuest: vi.fn(),
    createUser: vi.fn(),
    updateUser: vi.fn(),
    deleteUser: vi.fn(),
    getAllUsers: vi.fn(() => []),
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe('AdminPanel Fixtures expand/collapse regression', () => {
  it.skip('expands and collapses Venue, Lodging/Utilities, and Architectural sections and allows per-item expansion', async () => {
    const user = userEvent.setup();

    render(
      <AdminPanel
        onClose={() => undefined}
        currentLayout={{ tables: [], fixtures: [], venueId: 'v1', category: 'reception' }}
        onLoadTemplateForEdit={() => undefined}
      />,
    );

    await user.click(screen.getByRole('button', { name: /fixtures/i }));

    const venueHeader = screen.getByText('Venue Fixtures').closest('div');
    const lodgingHeader = screen.getByText('Lodging/Utilities Fixtures').closest('div');
    const exteriorHeader = screen.getByText('Architectural/Landscape Features').closest('div');

    expect(venueHeader).toBeTruthy();
    expect(lodgingHeader).toBeTruthy();
    expect(exteriorHeader).toBeTruthy();

    // Default collapsed at section level.
    expect(screen.queryByText('Dance Floor')).not.toBeInTheDocument();

    await user.click(within(venueHeader!.parentElement as HTMLElement).getByRole('button', { name: /expand/i }));
    expect(screen.getByText('Dance Floor')).toBeInTheDocument();

    await user.click(screen.getByText('Dance Floor'));
    expect(screen.getByText(/Visible to Basic\/Guest users/i)).toBeInTheDocument();

    await user.click(within(lodgingHeader!.parentElement as HTMLElement).getByRole('button', { name: /expand/i }));
    // At least one default lodging fixture should now be visible.
    expect(screen.getByText(/Power Outlet|Single Bed|Sofa|Toilet/i)).toBeInTheDocument();

    await user.click(within(exteriorHeader!.parentElement as HTMLElement).getByRole('button', { name: /expand/i }));
    expect(screen.getByText(/Fountain/i)).toBeInTheDocument();

    await user.click(screen.getByText(/Fountain/i));
    expect(screen.getByText(/Visible on Layout/i)).toBeInTheDocument();
  });
});
