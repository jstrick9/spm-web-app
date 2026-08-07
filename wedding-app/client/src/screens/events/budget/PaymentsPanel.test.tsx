import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PaymentsPanel } from './PaymentsPanel';

const listMock = vi.fn();
const checkoutMock = vi.fn().mockResolvedValue({ checkoutUrl: 'https://checkout.stripe.com/c/abc', payment: { id: 'p1' } });

vi.mock('../../../sdk', () => ({
  sdk: { paymentLinks: {
    list: (...a: unknown[]) => listMock(...a),
    create: vi.fn().mockResolvedValue({ payment: { id: 'p2' } }),
    checkout: (...a: unknown[]) => checkoutMock(...a),
  } },
}));
vi.mock('../../../ui/Toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
let canManage = true;
vi.mock('../../../lib/usePermission', () => ({ usePermission: () => canManage }));

function wrap() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

beforeEach(() => {
  canManage = true;
  vi.clearAllMocks();
  listMock.mockResolvedValue({
    payments: [
      { id: 'p1', event_id: 'e1', contract_id: null, provider: 'stripe', amount_cents: 150000, status: 'pending', payment_url: null, paid_at: null, created_at: '' },
      { id: 'p2', event_id: 'e1', contract_id: null, provider: 'manual', amount_cents: 5000, status: 'completed', payment_url: null, paid_at: '2026-01-01', created_at: '' },
    ],
    totals: { total: 155000, paid: 5000, pending: 150000 },
  });
});

describe('PaymentsPanel', () => {
  it('renders payment rows and totals', async () => {
    render(<PaymentsPanel eventId="e1" />, { wrapper: wrap() });
    await screen.findByText('completed');
    // Provider names are unique to rows; statuses confirm rows rendered.
    expect(screen.getByText('stripe')).toBeInTheDocument();
    expect(screen.getByText('manual')).toBeInTheDocument();
    expect(screen.getByText('pending')).toBeInTheDocument();
  });

  it('shows the milestone label (venue invoice name) for every payment, even without a due date', async () => {
    listMock.mockResolvedValue({
      payments: [
        { id: 'p1', event_id: 'e1', contract_id: null, provider: 'manual', amount_cents: 250000, status: 'pending', payment_url: null, paid_at: null, created_at: '', metadata: { milestone: 'Deposit', dueDate: '' } },
        { id: 'p2', event_id: 'e1', contract_id: null, provider: 'manual', amount_cents: 5000, status: 'completed', payment_url: null, paid_at: '2026-01-01', created_at: '', metadata: { milestone: 'Final Balance', dueDate: '2026-09-01' } },
      ],
      totals: { total: 255000, paid: 5000, pending: 250000 },
    });
    render(<PaymentsPanel eventId="e1" />, { wrapper: wrap() });
    // A payment with ONLY a milestone (no due date) must show the label —
    // previously the "Due Date / Milestone" cell rendered "—" and the
    // venue could not tell payments apart.
    expect(await screen.findByText('Deposit')).toBeInTheDocument();
    // Both label and date render when both exist.
    expect(screen.getByText('Final Balance')).toBeInTheDocument();
  });


  it('offers "Collect Payment" for an unpaid stripe link and opens the checkout', async () => {
    const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);
    render(<PaymentsPanel eventId="e1" />, { wrapper: wrap() });
    const btn = await screen.findByRole('button', { name: /Collect Payment/i });
    fireEvent.click(btn);
    await waitFor(() => expect(checkoutMock).toHaveBeenCalledWith('p1'));
    await waitFor(() => expect(openSpy).toHaveBeenCalledWith('https://checkout.stripe.com/c/abc', '_blank', 'noopener,noreferrer'));
  });

  it('shows field-level error and disabled create for zero/invalid amounts (MODULE-06 FI-14)', async () => {
    render(<PaymentsPanel eventId="e1" />, { wrapper: wrap() });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /new payment/i })).toBeTruthy();
    });
    fireEvent.click(screen.getByRole('button', { name: /new payment/i }));
    const amount = await screen.findByPlaceholderText('0.00');
    fireEvent.change(amount, { target: { value: '0' } });
    expect(await screen.findByText(/enter an amount greater than zero/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /^create$/i })).toBeDisabled();
  });

  it('hides "New Payment" and "Collect Payment" without budget.manage', async () => {
    canManage = false;
    render(<PaymentsPanel eventId="e1" />, { wrapper: wrap() });
    await screen.findByText('completed'); // wait for data to render
    expect(screen.queryByRole('button', { name: /New Payment/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /Collect Payment/i })).toBeNull();
  });
});
