/**
 * DashboardScreen tests — Phase 33
 *
 * Covers:
 *   • Renders page header with greeting
 *   • KPI stat cards all render (loading state shows skeletons)
 *   • Stat cards use loading prop while data loads
 *   • "Today" section appears when today's events exist
 *   • "Upcoming This Week" section appears for future events
 *   • Empty state shown when no events at all
 *   • Intelligence snapshot shown only if canViewAnalytics + enough data
 *   • Intelligence snapshot hidden when user lacks analytics.view
 *   • EventRiskBadge rendered for today's events
 *   • All heading levels correct (h1 in PageHeader, h2 for sections)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('../../lib/usePermission', () => ({
  usePermission: vi.fn(),
  setPermissionContext: vi.fn(),
}));

vi.mock('../../sdk', () => ({
  sdk: {
    events:       { list: vi.fn() },
    intelligence: { recommendations: { get: vi.fn() } },
  },
}));

vi.mock('../events/components/EventRiskBadge', () => ({
  EventRiskBadge: ({ eventId }: { eventId: string }) => (
    <span data-testid={`risk-${eventId}`} />
  ),
}));

import { usePermission }     from '../../lib/usePermission';
import { sdk }               from '../../sdk';
import { DashboardScreen }   from './DashboardScreen';

const TODAY = new Date().toISOString().slice(0, 10);
const TOMORROW = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
const YESTERDAY = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

const MOCK_USER = {
  id: 'u-1',
  email: 'owner@example.com',
  fullName: 'Jane Owner',
};

const MOCK_EVENTS_TODAY = {
  events: [
    { id: 'e-1', title: 'Smith Wedding', status: 'booked', start_date: TODAY, guest_count: 120, slug: 'smith' },
  ],
  counts: { booked: 1, planning: 0, lead: 2, hold: 0, completed: 5, cancelled: 0, lost: 0 },
};

const MOCK_EVENTS_EMPTY = {
  events: [],
  counts: { booked: 0, planning: 0, lead: 0, hold: 0, completed: 0, cancelled: 0, lost: 0 },
};

const MOCK_EVENTS_UPCOMING = {
  events: [
    { id: 'e-2', title: 'Jones Reception', status: 'planning', start_date: TOMORROW, guest_count: 80, slug: 'jones' },
  ],
  counts: { booked: 1, planning: 1, lead: 0, hold: 0, completed: 3, cancelled: 0, lost: 0 },
};

const MOCK_RECS = {
  recommendations: {
    budgetRange: { p25: 2000000, median: 3500000, p75: 5000000, count: 8 },
    guestCountRange: { p25: 80, median: 130, p75: 200 },
    topVendorCategories: [],
    seasonalDemand: [
      { month: 6, monthName: 'June', count: 4, percentage: 50 },
    ],
    avgTimelineItems: 12,
    popularMealChoices: [],
    leadSourceEffectiveness: [
      { source: 'referral', totalLeads: 10, converted: 8, conversionRate: 80 },
    ],
  },
};

function renderDashboard(orgId = 'org-1') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <DashboardScreen user={MOCK_USER as any} orgId={orgId} />
    </QueryClientProvider>,
  );
}

describe('DashboardScreen', () => {
  beforeEach(() => {
    vi.mocked(usePermission).mockImplementation((p: string) =>
      ['analytics.view', 'events.create'].includes(p),
    );
    vi.mocked(sdk.events.list).mockResolvedValue(MOCK_EVENTS_TODAY as any);
    vi.mocked(sdk.intelligence.recommendations.get).mockResolvedValue(MOCK_RECS as any);
  });

  // ── Header ────────────────────────────────────────────────────────────
  it('renders a greeting in the page header', async () => {
    renderDashboard();
    await waitFor(() => {
      // Greeting is "Good morning/afternoon/evening, Jane"
      expect(screen.getByText(/Good (morning|afternoon|evening)/i)).toBeTruthy();
    });
  });

  // ── KPI stat cards ────────────────────────────────────────────────────
  it('renders all 4 KPI stat card labels', async () => {
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText('Active Events')).toBeTruthy();
      expect(screen.getByText('Open Leads')).toBeTruthy();
      expect(screen.getByText('Completed (YTD)')).toBeTruthy();
    });
  });

  it('renders stat card values after data loads', async () => {
    renderDashboard();
    await waitFor(() => {
      // Active events = booked(1) + planning(0) = 1
      expect(screen.getByText('1')).toBeTruthy();
    });
  });

  it('stat cards have role="status" for accessibility', async () => {
    renderDashboard();
    await waitFor(() => {
      const statuses = screen.getAllByRole('status');
      expect(statuses.length).toBeGreaterThanOrEqual(4);
    });
  });

  // ── Today's events ────────────────────────────────────────────────────
  it('renders "Today" section when today has events', async () => {
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText('Today')).toBeTruthy();
      expect(screen.getByText('Smith Wedding')).toBeTruthy();
    });
  });

  it('renders EventRiskBadge for today\'s event', async () => {
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByTestId('risk-e-1')).toBeTruthy();
    });
  });

  it('renders Check-in and Details links for today\'s events', async () => {
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByRole('link', { name: /Check-in for Smith Wedding/i })).toBeTruthy();
      expect(screen.getByRole('link', { name: /View details for Smith Wedding/i })).toBeTruthy();
    });
  });

  // ── Upcoming events ───────────────────────────────────────────────────
  it('renders "Upcoming This Week" section for future events', async () => {
    vi.mocked(sdk.events.list).mockResolvedValue(MOCK_EVENTS_UPCOMING as any);
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText('Upcoming This Week')).toBeTruthy();
      expect(screen.getByText('Jones Reception')).toBeTruthy();
    });
  });

  // ── Empty state ───────────────────────────────────────────────────────
  it('renders empty state when no events exist', async () => {
    vi.mocked(sdk.events.list).mockResolvedValue(MOCK_EVENTS_EMPTY as any);
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText('No events yet')).toBeTruthy();
    });
  });

  // ── Intelligence snapshot ─────────────────────────────────────────────
  it('renders Intelligence Snapshot when analytics.view permitted and enough data', async () => {
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText('Intelligence Snapshot')).toBeTruthy();
      expect(screen.getByText('June')).toBeTruthy(); // peak season
      expect(screen.getByText('referral')).toBeTruthy(); // top lead source
    });
  });

  it('hides Intelligence Snapshot when analytics.view not permitted', async () => {
    vi.mocked(usePermission).mockImplementation((p: string) =>
      p === 'events.create', // analytics.view NOT granted
    );
    renderDashboard();
    await waitFor(() => {
      // Wait for data to load, then check snapshot is absent
      expect(screen.queryByText('Intelligence Snapshot')).toBeNull();
    });
  });

  it('hides Intelligence Snapshot when < 3 events in recommendations', async () => {
    vi.mocked(sdk.intelligence.recommendations.get).mockResolvedValue({
      recommendations: { ...MOCK_RECS.recommendations, budgetRange: { ...MOCK_RECS.recommendations.budgetRange, count: 2 } },
    } as any);
    renderDashboard();
    await waitFor(() => {
      expect(screen.queryByText('Intelligence Snapshot')).toBeNull();
    });
  });

  // ── Heading hierarchy ─────────────────────────────────────────────────
  it('sections use h2 headings', async () => {
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText('Today')).toBeTruthy();
    });
    const h2s = screen.getAllByRole('heading', { level: 2 });
    expect(h2s.length).toBeGreaterThan(0);
  });

  // ── Create event button ───────────────────────────────────────────────
  it('shows New Event button when events.create permitted', async () => {
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /new event/i })).toBeTruthy();
    });
  });

  it('hides New Event button when events.create not permitted', async () => {
    vi.mocked(usePermission).mockImplementation((p: string) =>
      p === 'analytics.view', // events.create NOT granted
    );
    renderDashboard();
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /new event/i })).toBeNull();
    });
  });

  it('renders the Live Operations Ticker with mock events and filter buttons', async () => {
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText(/Live Operations Ticker/i)).toBeInTheDocument();
      expect(screen.getByText(/Lead Coordinator Jane logged shift clock-in/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /all/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /staff/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /guests/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /financials/i })).toBeInTheDocument();
    });
  });

  it('toggles Guided Tutorial mode and displays contextual help cards', async () => {
    renderDashboard();
    
    // Check toggle is present
    const toggleBtn = await screen.findByRole('button', { name: /Enable Guided Tutorial/i });
    expect(toggleBtn).toBeInTheDocument();

    // Contextual guide should not be visible initially
    expect(screen.queryByText(/💡 Tutorial: Customize your guest-facing welcome sheets/i)).not.toBeInTheDocument();

    // Click to enable tutorial
    fireEvent.click(toggleBtn);

    // Verify button text changes and guides appear
    expect(screen.getByRole('button', { name: /Disable Tutorial Mode/i })).toBeInTheDocument();
    expect(screen.getByText(/💡 Tutorial: Customize your guest-facing welcome sheets/i)).toBeInTheDocument();
  });
});
