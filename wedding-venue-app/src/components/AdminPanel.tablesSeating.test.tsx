import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AdminPanel } from './AdminPanel';

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

describe('AdminPanel Tables/Seating tab', () => {
  it('shows separate Table Types and Seating Types sections', async () => {
    const user = userEvent.setup();
    render(
      <AdminPanel
        onClose={() => undefined}
        currentLayout={{ tables: [], fixtures: [], venueId: 'v1', category: 'reception' }}
        onLoadTemplateForEdit={() => undefined}
      />,
    );

    const tablesTab = screen.getByRole('button', { name: /tables\/seating/i });
    await user.click(tablesTab);

    expect(screen.getAllByText(/table types/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/seating types/i).length).toBeGreaterThan(0);
  });
});