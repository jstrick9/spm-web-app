import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthScreen } from './AuthScreen';
import { ToastProvider } from '../../ui/Toast';
import { resetStore } from '../../test/handlers';
import { server, http, HttpResponse } from '../../test/server';

function renderAuth(onAuth = vi.fn()) {
  render(
    <ToastProvider>
      <AuthScreen onAuth={onAuth} />
    </ToastProvider>,
  );
  return { onAuth };
}

describe('AuthScreen first-time owner UX', () => {
  beforeEach(() => {
    resetStore();
    localStorage.clear();
  });

  it('does not prefill or display seeded demo credentials in sign-in mode', () => {
    renderAuth();

    expect(screen.getByLabelText(/email address/i)).toHaveValue('');
    expect(screen.getByLabelText(/^password$/i)).toHaveValue('');
    expect(screen.queryByText(/owner@demo\.local/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/wedding123/i)).not.toBeInTheDocument();
    expect(screen.getAllByText(/explore demo/i).length).toBeGreaterThan(0);
  });

  it('shows clearer registration path, role selection, onboarding explanation, import, and team invite options', async () => {
    const user = userEvent.setup();
    renderAuth();

    await user.click(screen.getByRole('button', { name: /create my venue account/i }));

    expect(screen.getByText(/what best describes you/i)).toBeInTheDocument();
    expect(screen.getByText(/i’m a venue owner/i)).toBeInTheDocument();
    expect(screen.getByText(/i’m a venue manager/i)).toBeInTheDocument();
    expect(screen.getAllByText(/who should use this role/i).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /not sure\? take role quiz/i })).toBeInTheDocument();
    expect(screen.getByText(/after account creation/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/import guests, vendors, or events from a spreadsheet/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/remind me to invite my team after setup/i)).toBeInTheDocument();
  });

  it('registers and sets first-login setup wizard preferences', async () => {
    const user = userEvent.setup();
    const { onAuth } = renderAuth();

    await user.click(screen.getByRole('button', { name: /create my venue account/i }));
    await user.type(screen.getByLabelText(/your full name/i), 'Jane Owner');
    await user.type(screen.getByLabelText(/venue \/ organization name/i), 'Willow Creek Estate');
    await user.type(screen.getByLabelText(/email address/i), 'jane@example.com');
    await user.type(screen.getByLabelText(/^password$/i), 'securepass123');
    await user.click(screen.getByLabelText(/import guests, vendors, or events from a spreadsheet/i));
    await user.click(screen.getByLabelText(/remind me to invite my team after setup/i));
    const createButtons = screen.getAllByRole('button', { name: /^create my venue account$/i });
    await user.click(createButtons[createButtons.length - 1]);

    await waitFor(() => expect(onAuth).toHaveBeenCalled());
    expect(localStorage.getItem('wvi_show_owner_setup')).toBe('true');
    expect(localStorage.getItem('wvi_registration_role')).toBe('venue_owner');
    expect(localStorage.getItem('wvi_onboarding_import_spreadsheet')).toBe('true');
    expect(localStorage.getItem('wvi_post_setup_invite_team')).toBe('true');
  });

  it('routes venue managers into manager onboarding and training sandbox copy', async () => {
    const user = userEvent.setup();
    renderAuth();

    await user.click(screen.getByRole('button', { name: /create my venue account/i }));
    await user.click(screen.getByLabelText(/i’m a venue manager/i));
    expect(screen.getByText(/you are here to run operations, coordinate events, and escalate admin\/finance issues/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /start with demo manager workspace/i })).toBeInTheDocument();
  });

  it('guides booked couples and RSVP guests away from creating venue owner workspaces', async () => {
    const user = userEvent.setup();
    renderAuth();

    expect(screen.getByRole('button', { name: /i have a venue invitation link/i })).toBeInTheDocument();
    expect(screen.getByText(/i’m a guest trying to RSVP/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /i have a venue invitation link/i }));
    expect(screen.getByText(/booked couples do not create a venue account/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/venue \/ organization name/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create my wedding hub account/i })).toBeInTheDocument();
  });

  it('makes forgot-password flow functional without exposing account existence', async () => {
    const user = userEvent.setup();
    renderAuth();

    await user.click(screen.getByRole('button', { name: /forgot password/i }));
    expect(screen.getByText(/avoids revealing whether a venue account exists/i)).toBeInTheDocument();
    await user.type(screen.getByLabelText(/email address/i), 'owner@example.com');
    await user.click(screen.getByRole('button', { name: /send password reset link/i }));

    expect(await screen.findByText(/check your email for the password reset link/i)).toBeInTheDocument();
    expect(screen.getByText(/same message whether or not the email exists/i)).toBeInTheDocument();
  });

  it('shows a helpful message (not a raw error code) when sign-in hits a server 500', async () => {
    server.use(http.post('/api/auth/login', () => HttpResponse.json({ error: 'internal-error' }, { status: 500 })));
    const user = userEvent.setup();
    const { onAuth } = renderAuth();

    await user.type(screen.getByLabelText(/email address/i), 'owner@demo.local');
    await user.type(screen.getByLabelText(/^password$/i), 'wedding123');
    await user.click(screen.getByRole('button', { name: /sign in securely/i }));

    expect(await screen.findByText(/server hit an internal error/i)).toBeInTheDocument();
    expect(screen.queryByText(/internal-error/i)).not.toBeInTheDocument();
    expect(onAuth).not.toHaveBeenCalled();
  });
});
