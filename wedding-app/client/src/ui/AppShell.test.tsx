import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AppShell, PageHeader, PageBody } from './AppShell';

// Mock config hooks
vi.mock('../config/ConfigProvider', () => ({
  useBranding: () => ({ platformName: 'WVI Test', logoUrl: null }),
  useNavItems: () => [
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'events', label: 'Events' },
    { id: 'guests', label: 'Guests' },
    { id: 'vendors', label: 'Vendors' },
    { id: 'calendar', label: 'Calendar' },
    { id: 'reports', label: 'Reports' },
    { id: 'system', label: 'System' },
  ],
  useFeatureEnabled: () => true,
}));

vi.mock('../components/notifications/NotificationCenter', () => ({
  NotificationCenter: () => <div data-testid="notification-center">🔔</div>,
}));

vi.mock('./ThemeToggle', () => ({
  ThemeToggle: () => <div data-testid="theme-toggle">🌓</div>,
}));

const mockUser = { id: 'u1', email: 'owner@venue.com', fullName: 'Venue Owner' };

describe('AppShell', () => {
  it('renders the brand name in the top bar', () => {
    render(
      <AppShell user={mockUser as any} onLogout={vi.fn()}>
        <div>Content</div>
      </AppShell>
    );
    expect(screen.getByText('WVI Test')).toBeTruthy();
  });

  it('renders sidebar nav items', () => {
    render(
      <AppShell user={mockUser as any} onLogout={vi.fn()}>
        <div>Content</div>
      </AppShell>
    );
    expect(screen.getByText('Dashboard')).toBeTruthy();
    expect(screen.getByText('Events')).toBeTruthy();
    expect(screen.getByText('Guests')).toBeTruthy();
    expect(screen.getByText('Vendors')).toBeTruthy();
    expect(screen.getByText('Calendar')).toBeTruthy();
  });

  it('renders the user menu with user name', () => {
    render(
      <AppShell user={mockUser as any} onLogout={vi.fn()}>
        <div>Content</div>
      </AppShell>
    );
    expect(screen.getByText('Venue Owner')).toBeTruthy();
  });

  it('user menu opens on click and shows Account Settings', () => {
    render(
      <AppShell user={mockUser as any} onLogout={vi.fn()}>
        <div>Content</div>
      </AppShell>
    );
    fireEvent.click(screen.getByLabelText('User menu'));
    expect(screen.getByText('Account Settings')).toBeTruthy();
    expect(screen.getByText('Sign Out')).toBeTruthy();
  });

  it('renders children in the main area', () => {
    render(
      <AppShell user={mockUser as any} onLogout={vi.fn()}>
        <div>My Page Content</div>
      </AppShell>
    );
    expect(screen.getByText('My Page Content')).toBeTruthy();
  });

  it('renders notification center and theme toggle', () => {
    render(
      <AppShell user={mockUser as any} onLogout={vi.fn()}>
        <div>Content</div>
      </AppShell>
    );
    expect(screen.getByTestId('notification-center')).toBeTruthy();
    expect(screen.getByTestId('theme-toggle')).toBeTruthy();
  });
});

describe('PageHeader', () => {
  it('renders title and description', () => {
    render(<PageHeader title="Test Page" description="A description" />);
    expect(screen.getByText('Test Page')).toBeTruthy();
    expect(screen.getByText('A description')).toBeTruthy();
  });

  it('renders action buttons', () => {
    render(<PageHeader title="Page" actions={<button>Action</button>} />);
    expect(screen.getByText('Action')).toBeTruthy();
  });

  it('renders back link', () => {
    render(<PageHeader title="Detail" back={{ label: 'Back', href: '#/list' }} />);
    expect(screen.getByText('Back')).toBeTruthy();
  });
});

describe('PageBody', () => {
  it('renders children', () => {
    render(<PageBody>Body content here</PageBody>);
    expect(screen.getByText('Body content here')).toBeTruthy();
  });
});
