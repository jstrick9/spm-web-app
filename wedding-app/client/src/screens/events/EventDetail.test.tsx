import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { EventDetail } from './EventDetail';

vi.mock('../../lib/router', () => ({
  useRouter: () => ({ navigate: vi.fn(), query: new URLSearchParams(), path: '/events/e1' }),
}));

vi.mock('../../lib/usePermission', () => ({
  usePermissions: () => {
    const r: Record<string, boolean> = {};
    ['guests.view','invites.view','feedback.view','timeline.view','vendors.view',
     'budget.view','contracts.view','gallery.view','staff.view','messages.view',
     'layouts.view','portal.config.manage','events.edit'].forEach(p => r[p] = true);
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
      get: vi.fn().mockResolvedValue({ event: {
        id: 'e1', organization_id: 'org1', title: 'Smith Wedding', slug: 'smith-wedding',
        status: 'booked', start_date: '2026-09-12', end_date: '2026-09-12',
        guest_count: 120, budget_cents: 4500000, primary_contact_user_id: null,
        metadata: '{}', created_at: '2026-01-01',
      }}),
      duplicate: vi.fn().mockResolvedValue({ event: { id: 'e-copy', title: 'Smith Wedding (Copy)' } }),
    },
    guests: { list: vi.fn().mockResolvedValue({ guests: [], counts: { pending: 30, attending: 60, declined: 10, maybe: 20 } }) },
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
  beforeEach(() => { vi.clearAllMocks(); });

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
      expect(screen.getByText('Guests')).toBeTruthy();
      expect(screen.getByText('Budget')).toBeTruthy();
      expect(screen.getByText('Settings')).toBeTruthy();
    });
  });

  it('renders action buttons including Duplicate', async () => {
    render(<EventDetail eventId="e1" user={{ id: 'u1', email: 'test@x.com' }} />, { wrapper: wrap() });
    await waitFor(() => {
      expect(screen.getByText('View guest portal')).toBeTruthy();
      expect(screen.getByText('Print Run Sheet')).toBeTruthy();
      expect(screen.getByText('Duplicate')).toBeTruthy();
    });
  });
});
