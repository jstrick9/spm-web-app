/**
 * AppShell tests — Phase 33
 *
 * Covers all new accessibility additions and Phase 33 features:
 *   • aria-current="page" on the active sidebar nav link
 *   • aria-label on all icon-only buttons (hamburger, close, brand)
 *   • nav landmark has aria-label="Main navigation"
 *   • Intelligence nav item appears when config includes it
 *   • Skip-to-content link renders
 *   • UserMenu has aria-expanded + aria-haspopup
 *   • Mobile drawer has role="dialog" + aria-modal
 *   • Escape closes the mobile drawer
 *   • PageHeader renders h1 with correct text
 *   • PageBody renders children
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ── Mocks ─────────────────────────────────────────────────────────────────

vi.mock('../config/ConfigProvider', () => ({
  useBranding: () => ({ platformName: 'Wedding Venue Intelligence', logoUrl: null, tagline: 'Every detail intentional', supportEmail: 'support@example.com', websiteUrl: 'https://example.com' }),
  useFeatureEnabled: () => true,
  useNavItems: () => ['dashboard', 'events', 'guests', 'vendors', 'calendar', 'intelligence', 'system'],
}));

vi.mock('./ThemeToggle', () => ({ ThemeToggle: () => <div data-testid="theme-toggle" /> }));
vi.mock('../components/notifications/NotificationCenter', () => ({
  NotificationCenter: () => <div data-testid="notifications" />,
}));

vi.mock('../lib/usePermission', () => ({
  usePermission: () => true,
  usePermissions: <T extends string>(permissions: readonly T[]) => Object.fromEntries(permissions.map((p) => [p, true])),
}));

import { AppShell, PageHeader, PageBody } from './AppShell';
import { ToastProvider } from './Toast';

const MOCK_USER = {
  id: 'u-1',
  email: 'owner@example.com',
  fullName: 'Jane Owner',
  createdAt: '2026-01-01',
};

function renderShell(currentPath = '#/') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <ToastProvider>
        <AppShell
          user={MOCK_USER as any}
          currentPath={currentPath}
          onLogout={vi.fn()}
          onOpenCommandPalette={vi.fn()}
        >
          <div data-testid="content">Page content</div>
        </AppShell>
      </ToastProvider>
    </QueryClientProvider>,
  );
}

describe('AppShell', () => {
  beforeEach(() => { localStorage.clear(); });
  // ── Structure ────────────────────────────────────────────────────────────
  it('renders manager day-of mobile app shell with quick action dock for event paths', () => {
    localStorage.setItem('wvi_registration_role', 'venue_manager');
    renderShell('#/events/evt-1?tab=staff');
    expect(screen.getByLabelText('Manager event-day mobile app shell')).toBeTruthy();
    expect(screen.getByText('Manager Day-of Mode')).toBeTruthy();
    expect(screen.getByText('Run sheet')).toBeTruthy();
    expect(screen.getAllByText('Guests').length).toBeGreaterThan(0);
    expect(screen.getByText('Check-in')).toBeTruthy();
    expect(screen.getByText('Emergency')).toBeTruthy();
    expect(screen.getByText('Voice')).toBeTruthy();
    expect(screen.getByText('Photo')).toBeTruthy();
    expect(screen.getByText('Lock contacts')).toBeTruthy();
    expect(screen.getByText(/Last synced/i)).toBeTruthy();
  });

  it('renders children in main content area', () => {
    renderShell();
    expect(screen.getByTestId('content')).toBeTruthy();
  });

  it('renders branding contact links from configuration', () => {
    renderShell();
    expect(screen.getAllByText('Wedding Venue Intelligence').length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: 'support@example.com' })).toHaveAttribute('href', 'mailto:support@example.com');
    expect(screen.getByRole('link', { name: 'Website' })).toHaveAttribute('href', 'https://example.com');
  });

  // ── Skip link ────────────────────────────────────────────────────────────
  it('renders a skip-to-content link', () => {
    renderShell();
    const skipLink = screen.getByText('Skip to content');
    expect(skipLink).toBeTruthy();
    expect(skipLink.getAttribute('href')).toBe('#main-content');
  });

  // ── Navigation landmark ──────────────────────────────────────────────────
  it('renders nav with aria-label="Main navigation"', () => {
    renderShell();
    const nav = screen.getByRole('navigation', { name: 'Main navigation' });
    expect(nav).toBeTruthy();
  });

  // ── aria-current="page" (Phase 33 fix) ──────────────────────────────────
  it('sets aria-current="page" on the active nav link (dashboard at #/)', () => {
    renderShell('#/');
    const dashLink = screen.getByRole('link', { name: 'Dashboard' });
    expect(dashLink.getAttribute('aria-current')).toBe('page');
  });

  it('sets aria-current="page" on Events when path is #/events', () => {
    renderShell('#/events');
    const eventsLink = screen.getByRole('link', { name: 'Events' });
    expect(eventsLink.getAttribute('aria-current')).toBe('page');
  });

  it('does not leave System selected while a System child is active', () => {
    renderShell('#/system/platform');
    expect(screen.getByRole('link', { name: 'System' }).getAttribute('aria-current')).toBeNull();
  });

  it('does not set aria-current on inactive links', () => {
    renderShell('#/');
    const eventsLink = screen.getByRole('link', { name: 'Events' });
    expect(eventsLink.getAttribute('aria-current')).toBeNull();
  });

  // ── Intelligence nav item ────────────────────────────────────────────────
  it('renders Intelligence nav item when in navItems', () => {
    renderShell();
    expect(screen.getByRole('link', { name: 'Intelligence' })).toBeTruthy();
  });

  it('opens persistent Help Center from the top bar', async () => {
    renderShell();
    fireEvent.click(screen.getByRole('button', { name: /open help center/i }));
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeTruthy();
      expect(screen.getByText('Help Center')).toBeTruthy();
      expect(screen.getAllByText('Events').length).toBeGreaterThan(0);
      expect(screen.getByText('Lead')).toBeTruthy();
      expect(screen.getAllByText(/Recommended next step/i).length).toBeGreaterThan(0);
    });
  });

  // ── Hamburger button ─────────────────────────────────────────────────────
  it('hamburger button has aria-label', () => {
    renderShell();
    const burger = screen.getByRole('button', { name: /open navigation menu/i });
    expect(burger).toBeTruthy();
  });

  it('hamburger button has aria-expanded=false initially', () => {
    renderShell();
    const burger = screen.getByRole('button', { name: /open navigation menu/i });
    expect(burger.getAttribute('aria-expanded')).toBe('false');
  });

  // ── Mobile drawer ────────────────────────────────────────────────────────
  it('opens mobile drawer when hamburger clicked', async () => {
    renderShell();
    const burger = screen.getByRole('button', { name: /open navigation menu/i });
    fireEvent.click(burger);
    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: 'Navigation' })).toBeTruthy();
    });
  });

  it('drawer has role="dialog" and aria-modal="true"', async () => {
    renderShell();
    fireEvent.click(screen.getByRole('button', { name: /open navigation menu/i }));
    await waitFor(() => {
      const dialog = screen.getByRole('dialog');
      expect(dialog.getAttribute('aria-modal')).toBe('true');
    });
  });

  it('close button has aria-label in mobile drawer', async () => {
    renderShell();
    fireEvent.click(screen.getByRole('button', { name: /open navigation menu/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /close navigation menu/i })).toBeTruthy();
    });
  });

  it('Escape key closes the mobile drawer', async () => {
    renderShell();
    fireEvent.click(screen.getByRole('button', { name: /open navigation menu/i }));
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeTruthy();
    });
    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).toBeNull();
    });
  });

  // ── UserMenu ─────────────────────────────────────────────────────────────
  it('user menu button has aria-expanded=false initially', () => {
    renderShell();
    const userBtn = screen.getByRole('button', { name: /user menu for jane owner/i });
    expect(userBtn.getAttribute('aria-expanded')).toBe('false');
  });

  it('user menu button has aria-haspopup="menu"', () => {
    renderShell();
    const userBtn = screen.getByRole('button', { name: /user menu for jane owner/i });
    expect(userBtn.getAttribute('aria-haspopup')).toBe('menu');
  });

  it('opens user menu on click', async () => {
    renderShell();
    const userBtn = screen.getByRole('button', { name: /user menu for jane owner/i });
    fireEvent.click(userBtn);
    await waitFor(() => {
      expect(screen.getByRole('menu')).toBeTruthy();
    });
  });

  it('shows Sign Out in user menu', async () => {
    renderShell();
    fireEvent.click(screen.getByRole('button', { name: /user menu for jane owner/i }));
    await waitFor(() => {
      expect(screen.getByText('Sign Out')).toBeTruthy();
    });
  });

  it('Escape closes the user menu', async () => {
    renderShell();
    fireEvent.click(screen.getByRole('button', { name: /user menu for jane owner/i }));
    await waitFor(() => expect(screen.getByRole('menu')).toBeTruthy());
    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => {
      expect(screen.queryByRole('menu')).toBeNull();
    });
  });
});

// ── PageHeader ───────────────────────────────────────────────────────────

describe('PageHeader', () => {
  it('renders h1 with correct title', () => {
    render(<PageHeader title="Events" />);
    expect(screen.getByRole('heading', { level: 1, name: 'Events' })).toBeTruthy();
  });

  it('renders description when provided', () => {
    render(<PageHeader title="Events" description="Manage your events" />);
    expect(screen.getByText('Manage your events')).toBeTruthy();
  });

  it('renders actions slot', () => {
    render(
      <PageHeader
        title="Events"
        actions={<button data-testid="action-btn">Create</button>}
      />,
    );
    expect(screen.getByTestId('action-btn')).toBeTruthy();
  });

  it('renders back link when backHref provided', () => {
    render(<PageHeader title="Event Detail" backHref="#/events" />);
    const backLink = screen.getByRole('link', { name: 'Go back' });
    expect(backLink.getAttribute('href')).toBe('#/events');
  });
});

// ── PageBody ─────────────────────────────────────────────────────────────

describe('PageBody', () => {
  it('renders children', () => {
    render(<PageBody><div data-testid="child" /></PageBody>);
    expect(screen.getByTestId('child')).toBeTruthy();
  });

  it('applies custom className', () => {
    const { container } = render(<PageBody className="space-y-8"><div /></PageBody>);
    expect((container.firstChild as HTMLElement)?.className).toContain('space-y-8');
  });
});
