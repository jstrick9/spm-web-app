import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { WelcomeModal } from './WelcomeModal';
import { ToastProvider } from '../../ui/Toast';

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
});
