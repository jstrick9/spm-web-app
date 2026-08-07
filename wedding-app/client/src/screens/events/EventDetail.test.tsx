import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { EventDetail } from './EventDetail';
import { sdk } from '../../sdk';

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
    guests: { list: vi.fn().mockResolvedValue({ guests: [], counts: { pending: 30, attending: 60, declined: 10, maybe: 20 } }), guestHelpRequests: vi.fn().mockResolvedValue({ requests: [], counts: { open: 0, inReview: 0, resolved: 0, closed: 0 } }), updateGuestHelpRequest: vi.fn().mockResolvedValue({ request: {} }), venueManifest: vi.fn().mockResolvedValue({ guests: [], counts: { attending: 0 } }) },
    healthCommand: { get: vi.fn().mockResolvedValue({ commandCenter: { actions: [], summary: {}, resolvedActions: [] } }) },
    staff: { listTasks: vi.fn().mockResolvedValue({ tasks: [{ id: 'task1', title: 'Setup', status: 'not-started', priority: 'critical' }] }) },
    vendors: { list: vi.fn().mockResolvedValue({ vendors: [{ id: 'v1', name: 'DJ Co', category: 'DJ', metadata: '{}' }] }) },
    layouts: { list: vi.fn().mockResolvedValue({ layouts: [] }) },
    roles: { listRoles: vi.fn().mockResolvedValue({ roles: [] }) },
    risk: { forEvent: vi.fn().mockResolvedValue({ risk: { eventId: 'e1', eventTitle: 'Smith Wedding', startDate: null, daysUntil: null, healthScore: 100, alerts: [] } }) },
    timeline: { setupPacket: vi.fn().mockResolvedValue({ packet: { layout: null, staffing: [], timeline: [], vendorLoadIn: [] } }) },
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
    permissionState.permissions = {};
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
      expect(screen.getByText('September 12, 2026')).toBeTruthy();
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
      expect(screen.getByText('Guests')).toBeTruthy(); // guests.view granted → staff see the tab
      expect(screen.getByText('Budget')).toBeTruthy();
      expect(screen.getByText('Settings')).toBeTruthy();
    });
  });

  it('shows the Guests tab for venue staff with guests.view (regression: was couple-only, staff lost guest help inbox + per-event guest management)', async () => {
    // Staff user (no couple membership on the event). beforeEach grants all
    // permissions including guests.view — the tab must render for them.
    render(<EventDetail eventId="e1" user={{ id: 'u1', email: 'test@x.com' }} />, { wrapper: wrap() });
    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /guests/i })).toBeTruthy();
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

  it('shows an honest failure banner when a section query fails (no silent "No X yet")', async () => {
    grantAll();
    vi.mocked(sdk.guests.venueManifest).mockRejectedValueOnce(new Error('network down'));
    render(<EventDetail eventId="e1" user={{ id: 'u1', email: 'test@x.com' }} />, { wrapper: wrap() });

    await waitFor(() => {
      expect(screen.getByText('Some sections could not load.')).toBeTruthy();
    });
    expect(screen.getByText(/guest manifest/)).toBeTruthy();
    expect(screen.getByRole('button', { name: /Retry failed sections/i })).toBeTruthy();
  });

  it('switches panels when the URL ?tab= changes (back/forward + shared links) — regression: tab state only read the URL at mount', async () => {
    routerState.query = new URLSearchParams('tab=guests');
    const { rerender } = render(<EventDetail eventId="e1" user={{ id: 'u1' } as any} />, { wrapper: wrap() });
    await screen.findByText('Smith Wedding');
    // guests trigger is active (Radix marks the TRIGGER active in jsdom)
    await waitFor(() => {
      const active = document.querySelector('[role="tab"][data-state="active"]');
      expect(active?.textContent).toMatch(/^Guests/);
    });

    // simulate hashchange: user presses browser back/forward to ?tab=timeline
    routerState.query = new URLSearchParams('tab=timeline');
    rerender(<EventDetail eventId="e1" user={{ id: 'u1' } as any} />, { wrapper: wrap() });

    await waitFor(() => {
      const active = document.querySelector('[role="tab"][data-state="active"]');
      expect(active?.textContent).toMatch(/^Timeline/);
    });
  });

  it('falls back to overview when the URL ?tab= is unknown', async () => {
    routerState.query = new URLSearchParams('tab=not-a-real-tab');
    render(<EventDetail eventId="e1" user={{ id: 'u1' } as any} />, { wrapper: wrap() });
    await screen.findByText('Smith Wedding');
    await waitFor(() => {
      const active = document.querySelector('[role="tab"][data-state="active"]');
      expect(active?.textContent).toMatch(/^Overview/);
    });
  });

  it('does not show the failure banner when every section query succeeds', async () => {
    grantAll();
    render(<EventDetail eventId="e1" user={{ id: 'u1', email: 'test@x.com' }} />, { wrapper: wrap() });

    await waitFor(() => {
      expect(screen.getByText('Smith Wedding')).toBeTruthy();
    });
    // Give any failed queries a beat to surface; none should.
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByText('Some sections could not load.')).toBeNull();
  });
});
