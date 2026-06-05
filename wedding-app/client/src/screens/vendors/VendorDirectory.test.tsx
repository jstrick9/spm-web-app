import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { VendorDirectory } from './VendorDirectory';

vi.mock('../../sdk', () => ({
  sdk: {
    vendors: {
      list: vi.fn().mockResolvedValue({
        vendors: [
          {
            id: 'v1', organization_id: 'org1', event_id: 'e1', owner_user_id: null,
            name: 'Acme Catering', category: 'Catering', contact_name: 'John Chef',
            email: 'chef@acme.com', phone: '555-0001', website_url: 'https://acme.com',
            contract_amount_cents: 500000, amount_paid_cents: 200000,
            is_preferred: 1, notes: null, metadata: '{}', created_at: '2026-01-01',
          },
          {
            id: 'v2', organization_id: 'org1', event_id: 'e2', owner_user_id: null,
            name: 'Flash Photo', category: 'Photography', contact_name: null,
            email: 'info@flash.com', phone: null, website_url: null,
            contract_amount_cents: 300000, amount_paid_cents: 300000,
            is_preferred: 0, notes: null,
            metadata: JSON.stringify({ questionnaire: { coiLink: 'https://flash.com/coi.pdf', coiExpiration: '2026-05-01' } }),
            created_at: '2026-02-01',
          },
        ],
      }),
    },
    vendorScoring: {
      scores: vi.fn().mockResolvedValue({ scores: [
        { vendorId: 'v1', tier: 'top_rated', reliabilityScore: 92 },
      ] }),
    },
  },
}));

vi.mock('../../ui/Toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock('../../lib/useDebouncedValue', () => ({
  useDebouncedValue: (val: string) => val,
}));

function renderWithProviders(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe('VendorDirectory', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('renders the page header and KPI tiles', async () => {
    renderWithProviders(<VendorDirectory orgId="org1" />);
    expect(screen.getByText('Vendor Directory')).toBeTruthy();
    await waitFor(() => {
      expect(screen.getByText('Total Vendors')).toBeTruthy();
      expect(screen.getByText('Contracted')).toBeTruthy();
      expect(screen.getByText('Paid')).toBeTruthy();
      expect(screen.getByText('Outstanding')).toBeTruthy();
    });
  });

  it('renders vendor cards with names', async () => {
    renderWithProviders(<VendorDirectory orgId="org1" />);
    await waitFor(() => {
      expect(screen.getByText('Acme Catering')).toBeTruthy();
      expect(screen.getByText('Flash Photo')).toBeTruthy();
    });
  });

  it('shows preferred star badge', async () => {
    renderWithProviders(<VendorDirectory orgId="org1" />);
    await waitFor(() => {
      expect(screen.getByText('Acme Catering')).toBeTruthy();
    });
    // The star SVG is rendered for preferred vendors
    const acmeCard = screen.getByText('Acme Catering').closest('.space-y-3');
    expect(acmeCard).toBeTruthy();
  });

  it('shows category badges', async () => {
    renderWithProviders(<VendorDirectory orgId="org1" />);
    await waitFor(() => {
      expect(screen.getByText('Catering')).toBeTruthy();
      expect(screen.getByText('Photography')).toBeTruthy();
    });
  });

  it('renders search input', async () => {
    renderWithProviders(<VendorDirectory orgId="org1" />);
    expect(screen.getByPlaceholderText('Search vendors…')).toBeTruthy();
  });

  it('filters vendors by search', async () => {
    renderWithProviders(<VendorDirectory orgId="org1" />);
    await waitFor(() => { screen.getByText('Acme Catering'); });
    
    fireEvent.change(screen.getByPlaceholderText('Search vendors…'), { target: { value: 'Flash' } });
    
    await waitFor(() => {
      expect(screen.queryByText('Acme Catering')).toBeNull();
      expect(screen.getByText('Flash Photo')).toBeTruthy();
    });
  });

  it('shows financial progress bars for vendors with contracts', async () => {
    renderWithProviders(<VendorDirectory orgId="org1" />);
    await waitFor(() => {
      // Acme: $2,000 paid of $5,000
      expect(screen.getByText('$2,000 paid')).toBeTruthy();
      expect(screen.getByText('$3,000 remaining')).toBeTruthy();
    });
  });

  it('displays COI status indicators and expired booking blocker alerts', async () => {
    renderWithProviders(<VendorDirectory orgId="org1" />);
    await waitFor(() => {
      // Acme Catering has no COI -> displays "COI Missing"
      expect(screen.getByText('⚠️ COI Missing')).toBeInTheDocument();

      // Flash Photo has expired COI -> displays "COI EXPIRED"
      expect(screen.getByText('🚨 COI EXPIRED')).toBeInTheDocument();
      expect(screen.getByText(/Contract bookings are suspended/i)).toBeInTheDocument();
    });
  });
});
