import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TodayView } from './TodayView';

// vi.mock factories are hoisted — cannot reference variables declared below.
// Use inline date calculations instead.
vi.mock('../../sdk', () => ({
  sdk: {
    events: {
      list: vi.fn().mockResolvedValue({
        events: [
          { id: 'e1', title: 'Smith Wedding', status: 'booked', start_date: new Date().toISOString().slice(0, 10), guest_count: 120, budget_cents: 5000000 },
          { id: 'e2', title: 'Davis Reception', status: 'planning', start_date: new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10), guest_count: 80, budget_cents: 3000000 },
        ],
        counts: {},
      }),
    },
    vendors: {
      list: vi.fn().mockResolvedValue({
        vendors: [
          { id: 'v1', name: 'DJ', contract_amount_cents: 200000, amount_paid_cents: 100000 },
          { id: 'v2', name: 'Florist', contract_amount_cents: 300000, amount_paid_cents: 300000 },
        ],
      }),
    },
  },
}));

function wrap() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

describe('TodayView', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('shows today event card', async () => {
    render(<TodayView orgId="org1" />, { wrapper: wrap() });
    await waitFor(() => {
      expect(screen.getByText("Today's Events")).toBeTruthy();
      expect(screen.getByText('Smith Wedding')).toBeTruthy();
    });
  });

  it('renders this week strip', async () => {
    render(<TodayView orgId="org1" />, { wrapper: wrap() });
    await waitFor(() => {
      expect(screen.getByText('This Week')).toBeTruthy();
    });
  });

  it('shows vendor payment attention items', async () => {
    render(<TodayView orgId="org1" />, { wrapper: wrap() });
    await waitFor(() => {
      expect(screen.getByText('Needs Attention')).toBeTruthy();
      expect(screen.getByText(/outstanding balance/i)).toBeTruthy();
    });
  });

  it('renders TODAY badge for current events', async () => {
    render(<TodayView orgId="org1" />, { wrapper: wrap() });
    await waitFor(() => {
      expect(screen.getByText('TODAY')).toBeTruthy();
    });
  });
});
