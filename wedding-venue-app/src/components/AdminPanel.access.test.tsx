import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'u1',
      username: 'basic-user',
      role: 'basic',
      name: 'Basic User',
      isActive: true,
      createdAt: new Date().toISOString(),
    },
    createUser: vi.fn(),
    deleteUser: vi.fn(),
    getAllUsers: vi.fn(() => []),
  }),
}));

import { AdminPanel } from './AdminPanel';

describe('AdminPanel access guard', () => {
  it('shows access denied for non-admin users', () => {
    render(<AdminPanel onClose={() => undefined} />);

    expect(screen.getByText(/access denied/i)).toBeInTheDocument();
    expect(
      screen.getByText(/you do not have permission to access the admin panel/i),
    ).toBeInTheDocument();
  });
});