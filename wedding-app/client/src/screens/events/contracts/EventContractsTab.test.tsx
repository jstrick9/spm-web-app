import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { EventContractsTab } from './EventContractsTab';

vi.mock('../../../sdk', () => ({
  sdk: {
    events: { get: vi.fn().mockResolvedValue({ event: { id: 'e1', title: 'Wedding', metadata: '{}' } }), update: vi.fn().mockResolvedValue({ event: {} }) },
    contracts: {
      financialLegal: vi.fn().mockResolvedValue({ financialLegal: { escalations: [], goNoGoFlags: [], obligationExtracts: [], paymentDueRisk: { overdue: 1, dueSoon: 0, pendingCents: 120000 } } }),
      createFinancialLegalEscalation: vi.fn().mockResolvedValue({ escalation: {} }),
      createGoNoGoFlag: vi.fn().mockResolvedValue({ flag: {} }),
      extractObligations: vi.fn().mockResolvedValue({ extracts: [] }),
      list: vi.fn().mockResolvedValue({
        contracts: [
          { id: 'c1', title: 'Venue Agreement', status: 'signed', recipient_name: 'Sarah', amount_cents: 1000000, sent_at: '2026-01-01', signed_at: '2026-01-05', signature: 'Sarah Smith', content: 'Load-in starts at 10am. Insurance COI required. Noise curfew and overtime fees apply.', created_at: '2026-01-01' },
          { id: 'c2', title: 'Catering Addendum', status: 'sent', recipient_name: 'Sarah', amount_cents: 850000, sent_at: '2026-01-10', signed_at: null, signature: null, content: '', created_at: '2026-01-10' },
          { id: 'c3', title: 'Photo Package', status: 'draft', recipient_name: 'Bob', amount_cents: 300000, sent_at: null, signed_at: null, signature: null, content: '', created_at: '2026-01-12' },
        ],
      }),
      create: vi.fn().mockResolvedValue({ contract: { id: 'c4' } }),
      send: vi.fn().mockResolvedValue({ contract: { id: 'c3', status: 'sent' } }),
      sign: vi.fn().mockResolvedValue({ contract: { id: 'c2', status: 'signed' } }),
      delete: vi.fn().mockResolvedValue(undefined),
    },
  },
}));

vi.mock('../../../ui/Toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('../../../lib/usePermission', () => ({
  usePermission: () => true,
}));

function wrap() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe('EventContractsTab', () => {
  beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); });

  it('renders KPI tiles', async () => {
    render(<EventContractsTab eventId="e1" />, { wrapper: wrap() });
    await waitFor(() => {
      expect(screen.getByText('Total Active')).toBeTruthy();
      expect(screen.getByText('Pending Signature')).toBeTruthy();
      expect(screen.getByText('Fully Executed')).toBeTruthy();
    });
  });

  it('renders contract cards from server', async () => {
    render(<EventContractsTab eventId="e1" />, { wrapper: wrap() });
    await waitFor(() => {
      expect(screen.getByText('Venue Agreement')).toBeTruthy();
      expect(screen.getByText('Catering Addendum')).toBeTruthy();
      expect(screen.getByText('Photo Package')).toBeTruthy();
    });
  });

  it('shows status badges', async () => {
    render(<EventContractsTab eventId="e1" />, { wrapper: wrap() });
    await waitFor(() => {
      expect(screen.getByText('Signed')).toBeTruthy();
      expect(screen.getByText('Sent')).toBeTruthy();
      expect(screen.getByText('Draft')).toBeTruthy();
    });
  });

  it('shows Send button for draft contracts', async () => {
    render(<EventContractsTab eventId="e1" />, { wrapper: wrap() });
    await waitFor(() => {
      expect(screen.getByText('Send')).toBeTruthy();
    });
  });

  it('renders manager operations obligations and go-no-go checklist', async () => {
    localStorage.setItem('wvi_registration_role', 'venue_manager');
    render(<EventContractsTab eventId="e1" />, { wrapper: wrap() });
    await waitFor(() => {
      expect(screen.getByText('Manager contract operations summary')).toBeInTheDocument();
      expect(screen.getByText('Operations obligations extractor')).toBeInTheDocument();
      expect(screen.getByText('Legal / financial go-no-go checklist')).toBeInTheDocument();
      expect(screen.getAllByText(/Load-in \/ strike/i).length).toBeGreaterThanOrEqual(1);
    });
  });

  it('shows New Contract button when user has manage permission', async () => {
    render(<EventContractsTab eventId="e1" />, { wrapper: wrap() });
    await waitFor(() => {
      expect(screen.getByText('New Contract')).toBeTruthy();
    });
  });
});
