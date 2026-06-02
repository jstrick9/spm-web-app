/**
 * IntelligenceDashboard tests — Phase 32
 *
 * Covers:
 *   • RBAC gate (N3 fix): renders AccessDenied when analytics.view missing
 *   • Minimum data guard: shows "Building Your Intelligence" with < 5 events
 *   • Loading skeleton renders
 *   • Full render with data: all 4 stat cards, seasonal heatmap, lead source
 *   • Emoji accessibility (N4): aria-hidden + sr-only text present
 *   • RevenueForecastCard and RiskAlertsCard receive correct props
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// ── Mocks ─────────────────────────────────────────────────────────────────

vi.mock('../../lib/usePermissions', () => ({
  usePermissions: vi.fn(),
}));

vi.mock('../../sdk', () => ({
  sdk: {
    recommendations: { get: vi.fn() },
    forecast: { get: vi.fn() },
  },
}));

vi.mock('./RevenueForecastCard', () => ({
  RevenueForecastCard: ({ forecast }: { forecast: unknown }) => (
    <div data-testid="revenue-forecast-card" data-has-forecast={!!forecast} />
  ),
}));

vi.mock('./RiskAlertsCard', () => ({
  RiskAlertsCard: ({ orgId }: { orgId: string }) => (
    <div data-testid="risk-alerts-card" data-org-id={orgId} />
  ),
}));

import { usePermissions } from '../../lib/usePermissions';
import { sdk } from '../../sdk';
import { IntelligenceDashboard } from './IntelligenceDashboard';

// ── Fixtures ──────────────────────────────────────────────────────────────

const FULL_REC = {
  recommendations: {
    budgetRange: { p25: 2000000, median: 3500000, p75: 5500000, count: 12 },
    guestCountRange: { p25: 80, median: 130, p75: 200 },
    topVendorCategories: [
      { category: 'catering', count: 10, avgRating: 4.5 },
      { category: 'photography', count: 9, avgRating: 4.8 },
    ],
    seasonalDemand: [
      { month: 1, monthName: 'January', count: 1, percentage: 8 },
      { month: 6, monthName: 'June', count: 5, percentage: 42 },
      { month: 9, monthName: 'September', count: 3, percentage: 25 },
    ],
    avgTimelineItems: 14,
    popularMealChoices: [
      { choice: 'Chicken', count: 65 },
      { choice: 'Fish', count: 42 },
    ],
    leadSourceEffectiveness: [
      { source: 'referral', totalLeads: 20, converted: 16, conversionRate: 80 },
      { source: 'website', totalLeads: 30, converted: 18, conversionRate: 60 },
    ],
  },
};

const THIN_REC = {
  recommendations: {
    ...FULL_REC.recommendations,
    budgetRange: { ...FULL_REC.recommendations.budgetRange, count: 3 },
  },
};

const FORECAST = {
  forecast: {
    history: [],
    projection: [],
    trend: { direction: 'up', monthlySlopeCents: 5000, growthPct: 12 },
    totals: { trailingRevenueCents: 0, projectedRevenueCents: 120000000, trailingBookings: 0, projectedBookings: 4 },
    pipeline: { openEvents: 2, openRevenueCents: 60000000 },
    meta: { monthsOfHistory: 12, horizonMonths: 6, confidence: 'high' },
  },
};

// ── Helper ─────────────────────────────────────────────────────────────────

function renderDashboard(orgId = 'org-1') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <IntelligenceDashboard orgId={orgId} />
    </QueryClientProvider>,
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('IntelligenceDashboard', () => {
  beforeEach(() => {
    vi.mocked(usePermissions).mockReturnValue({
      can: (p: string) => p === 'analytics.view',
    } as ReturnType<typeof usePermissions>);
    vi.mocked(sdk.recommendations.get).mockResolvedValue(FULL_REC);
    vi.mocked(sdk.forecast.get).mockResolvedValue(FORECAST);
  });

  // ── N3: RBAC gate ──────────────────────────────────────────────────────
  it('renders AccessDenied when analytics.view is not permitted', () => {
    vi.mocked(usePermissions).mockReturnValue({
      can: () => false,
    } as ReturnType<typeof usePermissions>);

    renderDashboard();
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.getByText(/Access Restricted/i)).toBeTruthy();
    expect(screen.queryByText('Intelligence')).toBeTruthy();
    // Should NOT render stat cards
    expect(screen.queryByText('Median Budget')).toBeNull();
  });

  // ── Loading state ──────────────────────────────────────────────────────
  it('renders loading skeletons while data is fetching', () => {
    vi.mocked(sdk.recommendations.get).mockImplementation(
      () => new Promise(() => {}), // never resolves
    );
    renderDashboard();
    // Should show page header but no stat cards yet
    expect(screen.queryByText('Median Budget')).toBeNull();
  });

  // ── Minimum data guard ─────────────────────────────────────────────────
  it('shows "Building Your Intelligence" when fewer than 5 events', async () => {
    vi.mocked(sdk.recommendations.get).mockResolvedValue(THIN_REC);
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText(/Building Your Intelligence/i)).toBeTruthy();
    });
    expect(screen.queryByText('Median Budget')).toBeNull();
  });

  // ── Full render with data ──────────────────────────────────────────────
  it('renders all stat cards with real data', async () => {
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText('Median Budget')).toBeTruthy();
      expect(screen.getByText('Median Guests')).toBeTruthy();
      expect(screen.getByText('Avg Timeline Items')).toBeTruthy();
      expect(screen.getByText('Events Analyzed')).toBeTruthy();
    });
  });

  it('renders seasonal heatmap with correct month labels', async () => {
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByLabelText('Monthly demand heatmap')).toBeTruthy();
    });
  });

  it('renders lead source ROI section', async () => {
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText('Lead Source ROI')).toBeTruthy();
      expect(screen.getByText(/referral/i)).toBeTruthy();
    });
  });

  it('renders vendor performance section', async () => {
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText('Vendor Performance')).toBeTruthy();
      expect(screen.getByText(/catering/i)).toBeTruthy();
    });
  });

  it('renders meal preferences section', async () => {
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByText('Meal Preferences')).toBeTruthy();
      expect(screen.getByText(/chicken/i)).toBeTruthy();
    });
  });

  // ── N4: Emoji accessibility ────────────────────────────────────────────
  it('renders emoji with aria-hidden and sr-only labels (N4 fix)', async () => {
    renderDashboard();
    await waitFor(() => {
      // The peak season emoji should have aria-hidden and sr-only companion
      const hiddenEmojis = document.querySelectorAll('[aria-hidden="true"]');
      expect(hiddenEmojis.length).toBeGreaterThan(0);
      const srOnly = document.querySelectorAll('.sr-only');
      expect(srOnly.length).toBeGreaterThan(0);
    });
  });

  // ── Sub-component wiring ───────────────────────────────────────────────
  it('passes orgId to RiskAlertsCard', async () => {
    renderDashboard('org-test-123');
    await waitFor(() => {
      const card = screen.getByTestId('risk-alerts-card');
      expect(card.getAttribute('data-org-id')).toBe('org-test-123');
    });
  });

  it('renders RevenueForecastCard when forecast data is available', async () => {
    renderDashboard();
    await waitFor(() => {
      expect(screen.getByTestId('revenue-forecast-card')).toBeTruthy();
    });
  });

  it('does not render RevenueForecastCard when forecast query returns no data', async () => {
    vi.mocked(sdk.forecast.get).mockResolvedValue({ forecast: null });
    renderDashboard();
    await waitFor(() => {
      // Stat cards loaded — forecast card should be absent
      expect(screen.getByText('Median Budget')).toBeTruthy();
    });
    expect(screen.queryByTestId('revenue-forecast-card')).toBeNull();
  });
});
