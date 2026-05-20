import { render, screen } from '@testing-library/react';
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

describe('AdminPanel Tables/Seating section collapse behavior', () => {
  it.skip('defaults Table Types and Seating Types sections to collapsed and expands on demand', async () => {
    const user = userEvent.setup();

    render(
      <AdminPanel
        onClose={() => undefined}
        currentLayout={{ tables: [], fixtures: [], venueId: 'v1', category: 'reception' }}
        onLoadTemplateForEdit={() => undefined}
      />,
    );

    await user.click(screen.getByRole('button', { name: /tables\/seating/i }));

    // Both sections should start collapsed.
    expect(screen.queryByRole('button', { name: /add table type/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /add seating type/i })).not.toBeInTheDocument();

    const expandButtons = screen.getAllByRole('button', { name: /▼ expand/i });
    expect(expandButtons.length).toBeGreaterThanOrEqual(2);

    await user.click(expandButtons[0]);
    await user.click(expandButtons[1]);

    expect(screen.getByRole('button', { name: /add table type/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add seating type/i })).toBeInTheDocument();
  });
});
