import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { EventDetail } from './EventDetail';

const routerState = vi.hoisted(() => ({
  query: new URLSearchParams(),
  navigate: vi.fn(),
}));

const permissionState = vi.hoisted(() => ({
  permissions: {} as Record<string, boolean>,
}));

const ALL_PERMISSIONS = [
  'guests.view','invites.view','feedback.view','timeline.view','vendors.view',
  'budget.view','contracts.view','gallery.view','staff.view','messages.view',
  'layouts.view','portal.config.manage','portal.guest.view','events.edit',
  'events.create','vendors.checkin.view','calendar.view',
];

function grantAll() {
  permissionState.permissions = Object.fromEntries(ALL_PERMISSIONS.map((p) => [p, true]));
}

vi.mock('../../lib/router', () => ({
  useRouter: () => ({ navigate: routerState.navigate, query: routerState.query, path: '/events/e1' }),
}));

vi.mock('../../lib/usePermission', () => ({
  usePermissions: (ids: readonly string[]) => {
    const r: Record<string, boolean> = {};
    ids.forEach((p) => { r[p] = permissionState.permissions[p] === true; });
    return r;
  },
}));

vi.mock('../../config/ConfigProvider', () => ({
  ConfigProvider: ({ children }: any) => children,
  useTheme: () => ({}),
  useBranding: () => ({ platformName: 'WVI', logoUrl: null }),
  useNavItems: () => [],
  useFeatureEnabled: () => true,
  useWidgetSlot: () => [],
  usePlatformConfig: () => ({ setPreviewOverride: vi.fn(), previewActive: false }),
}));

vi.mock('../../config/widgets/WidgetSlot', () => ({
  WidgetSlot: () => <div data-testid="widget-slot">Widgets</div>,
}));

vi.mock('../../ui/Toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock('../../sdk', () => ({
  sdk: {
    events: {
      list: vi.fn().mockResolvedValue({ events: [], counts: {} }),
      update: vi.fn().mockResolvedValue({ event: {} }),
      get: vi.fn().mockResolvedValue({ event: {
        id: 'e1', organization_id: 'org1', title: 'Smith Wedding', slug: 'smith-wedding',
        status: 'booked', start_date: '2026-09-12', end_date: '2026-09-12',
        guest_count: 120, budget_cents: 4500000, primary_contact_user_id: null,
        metadata: '{}', created_at: '2026-01-01',
      }}),
      duplicate: vi.fn().mockResolvedValue({ event: { id: 'e-copy', title: 'Smith Wedding (Copy)' } }),
    },
    guests: { list: vi.fn().mockResolvedValue({ guests: [], counts: { pending: 30, attending: 60, declined: 10, maybe: 20 } }), guestHelpRequests: vi.fn().mockResolvedValue({ requests: [], counts: { open: 0, inReview: 0, resolved: 0, closed: 0 } }), updateGuestHelpRequest: vi.fn().mockResolvedValue({ request: {} }) },
    healthCommand: { get: vi.fn().mockResolvedValue({ commandCenter: { actions: [], summary: {}, resolvedActions: [] } }) },
    staff: { listTasks: vi.fn().mockResolvedValue({ tasks: [{ id: 'task1', title: 'Setup', status: 'not-started', priority: 'critical' }] }) },
    vendors: { list: vi.fn().mockResolvedValue({ vendors: [{ id: 'v1', name: 'DJ Co', category: 'DJ', metadata: '{}' }] }) },
    layouts: { list: vi.fn().mockResolvedValue({ layouts: [] }) },
    roles: { listRoles: vi.fn().mockResolvedValue({ roles: [] }) },
    risk: { forEvent: vi.fn().mockResolvedValue({ risk: { eventId: 'e1', eventTitle: 'Smith Wedding', startDate: null, daysUntil: null, healthScore: 100, alerts: [] } }) },
  },
}));

function wrap() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

describe('EventDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    routerState.query = new URLSearchParams();
    grantAll();
  });


  it('renders manager event operations import/export center in manager mode', async () => {
    localStorage.setItem('wvi_registration_role', 'venue_manager');
    render(<EventDetail eventId="e1" user={{ id: 'u1', email: 'test@x.com' }} />, { wrapper: wrap() });
    await waitFor(() => {
      expect(screen.getByText('Event operations import/export center')).toBeTruthy();
      expect(screen.getByText('Event operations import wizard')).toBeTruthy();
      expect(screen.getByText('Import preview with operational warnings')).toBeTruthy();
      expect(screen.getByText('Export PDF/ZIP packet')).toBeTruthy();
      expect(screen.getByText('Export JSON packet')).toBeTruthy();
    });
  });

  it('renders event title', async () => {
    render(<EventDetail eventId="e1" user={{ id: 'u1', email: 'test@x.com' }} />, { wrapper: wrap() });
    await waitFor(() => { expect(screen.getByText('Smith Wedding')).toBeTruthy(); });
  });

  it('renders event date and guest count', async () => {
    render(<EventDetail eventId="e1" user={{ id: 'u1', email: 'test@x.com' }} />, { wrapper: wrap() });
    await waitFor(() => {
      expect(screen.getByText('2026-09-12')).toBeTruthy();
      expect(screen.getByText(/120 guests/)).toBeTruthy();
    });
  });

  it('renders Overview tab KPI tiles', async () => {
    render(<EventDetail eventId="e1" user={{ id: 'u1', email: 'test@x.com' }} />, { wrapper: wrap() });
    await waitFor(() => {
      expect(screen.getByText('Guests invited')).toBeTruthy();
      expect(screen.getByText('RSVP response rate')).toBeTruthy();
    });
  });

  it('shows RBAC-allowed tabs', async () => {
    render(<EventDetail eventId="e1" user={{ id: 'u1', email: 'test@x.com' }} />, { wrapper: wrap() });
    await waitFor(() => {
      expect(screen.getByText('Overview')).toBeTruthy();
      expect(screen.queryByText('Guests')).toBeNull();
      expect(screen.getByText('Budget')).toBeTruthy();
      expect(screen.getByText('Settings')).toBeTruthy();
    });
  });

  it('renders action buttons including Duplicate when permissions allow them', async () => {
    render(<EventDetail eventId="e1" user={{ id: 'u1', email: 'test@x.com' }} />, { wrapper: wrap() });
    await waitFor(() => {
      expect(screen.getByText('View guest portal')).toBeTruthy();
      expect(screen.getByText('Print Run Sheet')).toBeTruthy();
      expect(screen.getByText('Duplicate')).toBeTruthy();
      expect(screen.getByText('Vendor Check-In')).toBeTruthy();
    });
  });

  it('hides unauthorized tab triggers and renders AccessDenied for deep-linked unauthorized tabs', async () => {
    grantAll();
    permissionState.permissions['budget.view'] = false;
    routerState.query = new URLSearchParams('tab=budget');

    render(<EventDetail eventId="e1" user={{ id: 'u1', email: 'test@x.com' }} />, { wrapper: wrap() });

    await waitFor(() => {
      expect(screen.getByText('Smith Wedding')).toBeTruthy();
      expect(screen.queryByRole('tab', { name: /Budget/i })).toBeNull();
      expect(screen.getByText(/Budget — Access Restricted/i)).toBeTruthy();
    });
  });

  it('hides action buttons when their permissions are missing', async () => {
    grantAll();
    permissionState.permissions['portal.guest.view'] = false;
    permissionState.permissions['timeline.view'] = false;
    permissionState.permissions['events.create'] = false;
    permissionState.permissions['vendors.checkin.view'] = false;

    render(<EventDetail eventId="e1" user={{ id: 'u1', email: 'test@x.com' }} />, { wrapper: wrap() });

    await waitFor(() => {
      expect(screen.getByText('Smith Wedding')).toBeTruthy();
      expect(screen.queryByText('View guest portal')).toBeNull();
      expect(screen.queryByText('Print Run Sheet')).toBeNull();
      expect(screen.queryByText('Duplicate')).toBeNull();
      expect(screen.queryByText('Vendor Check-In')).toBeNull();
    });
  });
});
