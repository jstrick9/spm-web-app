import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { UserProfile } from './UserProfile';

vi.mock('../../sdk', () => ({
  sdk: {},
}));

vi.mock('../../sdk/auth', () => ({
  profileSdk: {
    updateProfile: vi.fn().mockResolvedValue({ user: { id: 'u1', email: 'test@x.com', fullName: 'Updated' } }),
    changePassword: vi.fn().mockResolvedValue({ ok: true }),
  },
}));

vi.mock('../../ui/Toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));

function wrap() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

const mockUser = { id: 'u1', email: 'owner@venue.com', fullName: 'Venue Owner' };

describe('UserProfile', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('renders profile section with user email', () => {
    render(<UserProfile user={mockUser} />, { wrapper: wrap() });
    expect(screen.getByText('Account Settings')).toBeTruthy();
    expect(screen.getByDisplayValue('owner@venue.com')).toBeTruthy();
  });

  it('renders full name input pre-filled', () => {
    render(<UserProfile user={mockUser} />, { wrapper: wrap() });
    const input = screen.getByLabelText('Full Name') as HTMLInputElement;
    expect(input.value).toBe('Venue Owner');
  });

  it('renders password change section', () => {
    render(<UserProfile user={mockUser} />, { wrapper: wrap() });
    expect(screen.getAllByText('Change Password').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByLabelText('Current Password')).toBeTruthy();
    expect(screen.getByLabelText('New Password')).toBeTruthy();
    expect(screen.getByLabelText('Confirm New Password')).toBeTruthy();
  });

  it('has Save Profile button', () => {
    render(<UserProfile user={mockUser} />, { wrapper: wrap() });
    expect(screen.getByText('Save Profile')).toBeTruthy();
  });

  it('has Change Password button (initially disabled)', () => {
    render(<UserProfile user={mockUser} />, { wrapper: wrap() });
    const btns = screen.getAllByText('Change Password'); const btn = btns[btns.length - 1] as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });
});
