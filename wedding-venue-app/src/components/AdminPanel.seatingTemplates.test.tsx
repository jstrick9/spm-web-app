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

describe('AdminPanel Seating template behavior', () => {
  it.skip('creates a seating template and allows venue-category restriction editing', async () => {
    const user = userEvent.setup();

    render(
      <AdminPanel
        onClose={() => undefined}
        currentLayout={{ tables: [], fixtures: [], venueId: 'v1', category: 'ceremony' }}
        onLoadTemplateForEdit={() => undefined}
      />,
    );

    await user.click(screen.getByRole('button', { name: /tables\/seating/i }));

    // Expand Seating Types section.
    const seatingHeader = screen.getByText('Seating Types').closest('div');
    expect(seatingHeader).toBeTruthy();
    await user.click(
      seatingHeader!.parentElement!.querySelector('button') as HTMLButtonElement,
    );

    // Add a quick seating template.
    await user.click(screen.getByRole('button', { name: /ceremony row/i }));

    expect(screen.getByText(/Ceremony Row/i)).toBeInTheDocument();

    // Expand created seating type and verify category controls.
    await user.click(screen.getByText(/Ceremony Row/i));
    expect(screen.getByText(/Assign venue categories/i)).toBeInTheDocument();

    // Category buttons are available for restrictions.
    expect(screen.getByRole('button', { name: /Ceremony/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Reception/i })).toBeInTheDocument();
  });
});
