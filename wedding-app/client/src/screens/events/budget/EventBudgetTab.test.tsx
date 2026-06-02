import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { EventBudgetTab } from './EventBudgetTab';

vi.mock('../../../sdk', () => ({
  sdk: {
    budget: {
      list: vi.fn().mockResolvedValue({
        items: [
          { id: 'b1', category: 'Venue', title: 'Base Rental', planned_cents: 1000000, actual_cents: 1000000, paid_cents: 500000, vendor_id: null, notes: null, sort_order: 0, created_at: '2026-01-01' },
          { id: 'b2', category: 'Catering', title: 'Dinner', planned_cents: 850000, actual_cents: 900000, paid_cents: 200000, vendor_id: null, notes: null, sort_order: 1, created_at: '2026-01-01' },
        ],
        totals: { planned: 1850000, actual: 1900000, paid: 700000 },
      }),
      create: vi.fn().mockResolvedValue({ item: { id: 'b3' } }),
      delete: vi.fn().mockResolvedValue(undefined),
    },
    paymentLinks: {
      list: vi.fn().mockResolvedValue({ payments: [], totals: { total: 0, paid: 0, pending: 0 } }),
      create: vi.fn().mockResolvedValue({ payment: { id: 'p1' } }),
      checkout: vi.fn().mockResolvedValue({ checkoutUrl: 'https://checkout.stripe.com/x', payment: { id: 'p1' } }),
    },
  },
}));

vi.mock('../../../ui/Toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock('../../../lib/usePermission', () => ({
  usePermission: () => true,
}));

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

describe('EventBudgetTab', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('renders KPI tiles with real totals', async () => {
    render(<EventBudgetTab eventId="evt1" organizationId="org1" />, { wrapper: makeWrapper() });
    await waitFor(() => {
      expect(screen.getByText('Total Planned')).toBeTruthy();
      expect(screen.getByText('Total Actual')).toBeTruthy();
      expect(screen.getByText('Total Paid')).toBeTruthy();
      expect(screen.getByText('Remaining')).toBeTruthy();
    });
  });

  it('renders budget line items', async () => {
    render(<EventBudgetTab eventId="evt1" organizationId="org1" />, { wrapper: makeWrapper() });
    await waitFor(() => {
      expect(screen.getByText('Base Rental')).toBeTruthy();
      expect(screen.getByText('Dinner')).toBeTruthy();
    });
  });

  it('shows category badges', async () => {
    render(<EventBudgetTab eventId="evt1" organizationId="org1" />, { wrapper: makeWrapper() });
    await waitFor(() => {
      expect(screen.getByText('Venue')).toBeTruthy();
      expect(screen.getByText('Catering')).toBeTruthy();
    });
  });

  it('renders Add Item button when user has budget.manage', async () => {
    render(<EventBudgetTab eventId="evt1" organizationId="org1" />, { wrapper: makeWrapper() });
    await waitFor(() => {
      expect(screen.getByText('Add Item')).toBeTruthy();
    });
  });

  it('shows totals row in footer', async () => {
    render(<EventBudgetTab eventId="evt1" organizationId="org1" />, { wrapper: makeWrapper() });
    await waitFor(() => {
      expect(screen.getByText('Totals')).toBeTruthy();
    });
  });
});
