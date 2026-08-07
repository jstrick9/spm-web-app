import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { WelcomeModal } from './WelcomeModal';
import { ToastProvider } from '../../ui/Toast';

// saveState writes through the SDK — mock it so tour actions are observable
// and the config round-trip can be simulated (the App sets userConfig from
// the PUT response via onUserConfigChanged).
const putUserPreferences = vi.fn().mockResolvedValue({ config: {} });
vi.mock('../../sdk', () => ({
  sdk: { platformConfig: { putUserPreferences: (...args: unknown[]) => putUserPreferences(...args) } },
}));

import { sdk } from '../../sdk';

function renderWelcome(roleKey: string, props: Partial<React.ComponentProps<typeof WelcomeModal>> = {}) {
  return render(
    <ToastProvider>
      <WelcomeModal
        memberships={[{ roleKey } as any]}
        orgId="org-1"
        userConfig={{}}
        onComplete={vi.fn()}
        {...props}
      />
    </ToastProvider>,
  );
}

describe('WelcomeModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    putUserPreferences.mockResolvedValue({ config: {} });
  });

  it('renders role-specific owner onboarding and allows navigation', async () => {
    renderWelcome('owner');

    expect(await screen.findByText('Start with your venue setup')).toBeInTheDocument();

    const nextBtn = screen.getByRole('button', { name: /Next/i });
    fireEvent.click(nextBtn);

    expect(screen.getByText('Build your event pipeline')).toBeInTheDocument();
  });

  it('filters slides based on role', async () => {
    renderWelcome('vendor');

    expect(await screen.findByText('Your vendor portal')).toBeInTheDocument();
    expect(screen.queryByText('Build your event pipeline')).not.toBeInTheDocument();
  });

  it('renders complete couple onboarding tour for couple role', async () => {
    render(
      <ToastProvider>
        <WelcomeModal
          memberships={[{ roleKey: 'couple', eventId: 'event-1' } as any]}
          orgId="org-1"
          userConfig={{}}
          onComplete={vi.fn()}
        />
      </ToastProvider>,
    );

    expect(await screen.findByText('Your private wedding hub')).toBeInTheDocument();
    expect(screen.getByText(/wedding details, planning checklist/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^Next/i }));
    expect(screen.getByText('What should I do first?')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^Next/i }));
    expect(screen.getByText('Understand how RSVP works')).toBeInTheDocument();
  });

  it('does not reopen when server-side state is completed', () => {
    renderWelcome('owner', {
      userConfig: {
        onboarding: {
          welcomeTourByOrg: {
            'org-1': { status: 'completed', currentSlide: 6, completedSlides: ['owner-venue-setup'] },
          },
        },
      } as any,
    });

    expect(screen.queryByText('Start with your venue setup')).not.toBeInTheDocument();
  });

  it('NEVER opens while the config is still loading, and stays closed when the completed config arrives (no flash)', () => {
    // userConfig === undefined means the preferences fetch is still in
    // flight. The modal must not open in that window at all — previously it
    // flashed open and closed when the config arrived, which let e2e clicks
    // land on the modal under full-suite load.
    const { rerender } = renderWelcome('owner', { userConfig: undefined });
    expect(screen.queryByText('Start with your venue setup')).not.toBeInTheDocument();

    rerender(
      <ToastProvider>
        <WelcomeModal
          memberships={[{ roleKey: 'owner' } as any]}
          orgId="org-1"
          userConfig={{
            onboarding: {
              welcomeTourByOrg: {
                'org-1': { status: 'completed', currentSlide: 6, completedSlides: [] },
              },
            },
          } as any}
          onComplete={vi.fn()}
        />
      </ToastProvider>,
    );

    expect(screen.queryByText('Start with your venue setup')).not.toBeInTheDocument();
    // No tour writes were issued while the config was unknown.
    expect(putUserPreferences).not.toHaveBeenCalled();
  });

  it('closes the tour when the completed config arrives AFTER mount (async load race)', async () => {
    // userConfig loads asynchronously; the first render sees an empty config
    // and opens the tour. When the real (completed) config arrives the modal
    // must close — otherwise users who finished the tour see it re-open on
    // slow loads.
    const { rerender } = renderWelcome('owner');
    expect(await screen.findByText('Start with your venue setup')).toBeInTheDocument();

    rerender(
      <ToastProvider>
        <WelcomeModal
          memberships={[{ roleKey: 'owner' } as any]}
          orgId="org-1"
          userConfig={{
            onboarding: {
              welcomeTourByOrg: {
                'org-1': { status: 'completed', currentSlide: 6, completedSlides: [] },
              },
            },
          } as any}
          onComplete={vi.fn()}
        />
      </ToastProvider>,
    );

    await waitFor(() => expect(screen.queryByText('Start with your venue setup')).not.toBeInTheDocument());
  });

  it('closes the tour when a dismissed config arrives after mount', async () => {
    const { rerender } = renderWelcome('owner');
    expect(await screen.findByText('Start with your venue setup')).toBeInTheDocument();

    rerender(
      <ToastProvider>
        <WelcomeModal
          memberships={[{ roleKey: 'owner' } as any]}
          orgId="org-1"
          userConfig={{
            onboarding: {
              welcomeTourByOrg: {
                'org-1': { status: 'dismissed', currentSlide: 0, completedSlides: [] },
              },
            },
          } as any}
          onComplete={vi.fn()}
        />
      </ToastProvider>,
    );

    await waitFor(() => expect(screen.queryByText('Start with your venue setup')).not.toBeInTheDocument());
  });

  it('dismissing via the close button persists status DISMISSED (not in_progress) so the tour never reappears', async () => {
    const onConfigChanged = vi.fn();
    const { rerender } = renderWelcome('owner', { onUserConfigChanged: onConfigChanged });
    await screen.findByText('Start with your venue setup');

    // The config write for the dismissal: simulate the server response that
    // the App would feed back through onUserConfigChanged.
    putUserPreferences.mockResolvedValue({
      config: {
        onboarding: {
          welcomeTourByOrg: {
            'org-1': { status: 'dismissed', currentSlide: 0, completedSlides: [] },
          },
        },
      } as any,
    });

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(putUserPreferences).toHaveBeenCalled());
    const written = putUserPreferences.mock.calls[0][0] as any;
    expect(written.onboarding.welcomeTourByOrg['org-1'].status).toBe('dismissed');

    // Feed the written config back (as the App does) — the modal must STAY
    // closed and not reopen from the round-trip.
    rerender(
      <ToastProvider>
        <WelcomeModal
          memberships={[{ roleKey: 'owner' } as any]}
          orgId="org-1"
          userConfig={putUserPreferences.mock.results[0].value.config as any}
          onUserConfigChanged={onConfigChanged}
          onComplete={vi.fn()}
        />
      </ToastProvider>,
    );
    expect(screen.queryByText('Start with your venue setup')).not.toBeInTheDocument();
  });

  it('Escape dismisses the tour permanently (writes dismissed, never in_progress)', async () => {
    renderWelcome('owner');
    await screen.findByText('Start with your venue setup');

    // Radix DismissableLayer listens on the document for Escape.
    fireEvent.keyDown(document, { key: 'Escape' });

    await waitFor(() => expect(putUserPreferences).toHaveBeenCalled());
    const written = putUserPreferences.mock.calls[0][0] as any;
    expect(written.onboarding.welcomeTourByOrg['org-1'].status).toBe('dismissed');
  });

  it('"Resume later" closes the tour and the in_progress round-trip does NOT reopen it', async () => {
    const onConfigChanged = vi.fn();
    const { rerender } = renderWelcome('owner', { onUserConfigChanged: onConfigChanged });
    await screen.findByText('Start with your venue setup');

    putUserPreferences.mockResolvedValue({
      config: {
        onboarding: {
          welcomeTourByOrg: {
            'org-1': { status: 'in_progress', currentSlide: 0, completedSlides: [] },
          },
        },
      } as any,
    });

    fireEvent.click(screen.getByRole('button', { name: /resume later/i }));
    await waitFor(() => expect(putUserPreferences).toHaveBeenCalled());

    // The App feeds the PUT response back into userConfig — previously this
    // re-triggered the open effect and the modal reopened instantly, making
    // "Resume later" appear broken.
    rerender(
      <ToastProvider>
        <WelcomeModal
          memberships={[{ roleKey: 'owner' } as any]}
          orgId="org-1"
          userConfig={putUserPreferences.mock.results[0].value.config as any}
          onUserConfigChanged={onConfigChanged}
          onComplete={vi.fn()}
        />
      </ToastProvider>,
    );

    expect(screen.queryByText('Start with your venue setup')).not.toBeInTheDocument();
  });

  it('a mid-tour user (in_progress) still sees the tour reopen on a fresh mount at their saved slide', async () => {
    renderWelcome('owner', {
      userConfig: {
        onboarding: {
          welcomeTourByOrg: {
            'org-1': { status: 'in_progress', currentSlide: 3, completedSlides: ['owner-venue-setup', 'owner-event-pipeline', 'owner-guest-portal'] },
          },
        },
      } as any,
    });

    expect(await screen.findByText('Invite vendors into their portal')).toBeInTheDocument();
  });

  it('finishing the tour persists status completed and closes', async () => {
    renderWelcome('owner');
    await screen.findByText('Start with your venue setup');
    for (let i = 0; i < 6; i++) {
      fireEvent.click(screen.getByRole('button', { name: /^Next/i }));
    }
    await screen.findByText('Learn in short, focused lessons');
    fireEvent.click(screen.getByRole('button', { name: /finish tour/i }));
    await waitFor(() => expect(putUserPreferences).toHaveBeenCalled());
    const written = putUserPreferences.mock.calls[0][0] as any;
    expect(written.onboarding.welcomeTourByOrg['org-1'].status).toBe('completed');
    expect(screen.queryByText('Start with your venue setup')).not.toBeInTheDocument();
  });
});

// keep a reference so the sdk import above is used (mocked)
void sdk;
