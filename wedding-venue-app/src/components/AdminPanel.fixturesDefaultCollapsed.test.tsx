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

describe('AdminPanel Fixtures default-collapsed behavior', () => {
  it('shows section headers collapsed by default and expands each section on demand', async () => {
    const user = userEvent.setup();
    render(
      <AdminPanel
        onClose={() => undefined}
        currentLayout={{ tables: [], fixtures: [], venueId: 'v1', category: 'reception' }}
        onLoadTemplateForEdit={() => undefined}
      />,
    );

    await user.click(screen.getByRole('button', { name: /fixtures/i }));

    const venueSection = screen.getByRole('heading', { name: 'Venue Fixtures' }).closest('div')?.parentElement?.parentElement as HTMLElement;
    const lodgingSection = screen.getByRole('heading', { name: /Lodging\/Utilities/i }).closest('div')?.parentElement?.parentElement as HTMLElement;
    const exteriorSection = screen.getByRole('heading', { name: /Architectural\/Landscape/i }).closest('div')?.parentElement?.parentElement as HTMLElement;

    expect(venueSection).toBeTruthy();
    expect(lodgingSection).toBeTruthy();
    expect(exteriorSection).toBeTruthy();

    // Default-collapsed: items should not be visible
    expect(screen.queryByText('Dance Floor')).not.toBeInTheDocument();
    expect(screen.queryByText('Power Outlet')).not.toBeInTheDocument();
    expect(screen.queryByText('Fountain')).not.toBeInTheDocument();

    // Click on section header to expand
    await user.click(venueSection.querySelector('h4')!);
    expect(screen.getByText('Dance Floor')).toBeInTheDocument();

    await user.click(lodgingSection.querySelector('h4')!);
    expect(screen.getByText('Power Outlet')).toBeInTheDocument();

    await user.click(exteriorSection.querySelector('h4')!);
    expect(screen.getByText('Fountain')).toBeInTheDocument();
  });
});