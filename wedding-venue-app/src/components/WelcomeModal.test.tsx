import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('../config', () => ({
  getConfig: () => ({
    venueName: 'Seven Paths Manor',
    welcomeLogoUrl: '',
    welcomeTitle: 'Welcome to the Wedding Layout Planner',
    welcomeFeatures: [
      'Layout Design',
      'Guest Management',
      'Templates',
      'Print & Share',
    ],
  }),
}));

import { WelcomeModal } from './WelcomeModal';

describe('WelcomeModal', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders as a dialog', () => {
    render(<WelcomeModal onClose={() => undefined} isAdmin={false} />);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(
      screen.getByRole('dialog', { name: /welcome to the wedding layout planner/i }),
    ).toBeInTheDocument();
  });

  it('closes on Escape', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(<WelcomeModal onClose={onClose} isAdmin={false} />);

    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });

  it('persists do not show again when checked and completed', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(<WelcomeModal onClose={onClose} isAdmin={false} />);

    await user.click(screen.getByLabelText(/don’t show this again/i));

    await user.click(screen.getByRole('button', { name: /next/i }));
    await user.click(screen.getByRole('button', { name: /next/i }));
    await user.click(screen.getByRole('button', { name: /next/i }));
    await user.click(screen.getByRole('button', { name: /next/i }));
    await user.click(screen.getByRole('button', { name: /let's start!/i }));

    expect(localStorage.getItem('spm_welcome_hidden')).toBe('true');
    expect(onClose).toHaveBeenCalled();
  });

  it('shows guest notice for guest users', () => {
    render(<WelcomeModal onClose={() => undefined} isAdmin={false} isGuest />);

    expect(screen.getByText(/sign in to save your preferences/i)).toBeInTheDocument();
  });

  it('shows admin tip on final step for admins', async () => {
    const user = userEvent.setup();

    render(<WelcomeModal onClose={() => undefined} isAdmin />);

    await user.click(screen.getByRole('button', { name: /next/i }));
    await user.click(screen.getByRole('button', { name: /next/i }));
    await user.click(screen.getByRole('button', { name: /next/i }));
    await user.click(screen.getByRole('button', { name: /next/i }));

    expect(screen.getByText(/admin tip/i)).toBeInTheDocument();
  });
});