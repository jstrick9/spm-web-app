import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { EventVendorsTab } from './EventVendorsTab';
import { vendorsSdk } from '../../../sdk/vendors';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '../../../ui/Toast';

vi.mock('../../../sdk', () => ({
  sdk: {
    vendors: {
      addPayment: vi.fn(),
      list: vi.fn().mockResolvedValue({ 
        vendors: [
          { id: 'v1', name: 'Acme Catering', category: 'Catering', contract_amount_cents: 500000, amount_paid_cents: 100000 },
          { id: 'v2', name: 'Snap Pics', category: 'Photography', email: 'snap@pics.com' }
        ] 
      })
    },
    vendorScoring: {
      matches: vi.fn().mockResolvedValue({ matches: [] }),
      scores: vi.fn().mockResolvedValue({ scores: [] }),
    }
  }
}));

vi.mock('../../../sdk/vendors', () => ({
  vendorsSdk: {
    addPayment: vi.fn(),
    list: vi.fn(),
    create: vi.fn(),
  }
}));

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>
      <ToastProvider>{children}</ToastProvider>
    </QueryClientProvider>
  );
}

describe('EventVendorsTab', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('renders vendors', async () => {
    render(<EventVendorsTab eventId="evt-1" organizationId="org-1" />, { wrapper: makeWrapper() });
    const acmeItems = await screen.findAllByText('Acme Catering');
    expect(acmeItems.length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Snap Pics').length).toBeGreaterThanOrEqual(1);
  });
  
  it('has a search input for filtering vendors', async () => {
    render(<EventVendorsTab eventId="evt-1" organizationId="org-1" />, { wrapper: makeWrapper() });
    await screen.findAllByText('Acme Catering');
    
    // Search inputs are present
    const searchInputs = screen.getAllByPlaceholderText('Search vendors...');
    expect(searchInputs.length).toBeGreaterThanOrEqual(1);
    
    // Typing into search doesn't crash
    fireEvent.change(searchInputs[0], { target: { value: 'Photo' } });
    // Snap Pics should still be visible (it matches "Photo" via category)
    expect(screen.getAllByText('Snap Pics').length).toBeGreaterThanOrEqual(1);
  });

  it('allows logging a payment', async () => {
    (vendorsSdk.addPayment as any).mockResolvedValue({ payment: { id: 'p1' } });
    
    render(<EventVendorsTab eventId="evt-1" organizationId="org-1" />, { wrapper: makeWrapper() });
    await screen.findAllByText('Acme Catering');
    
    const paymentBtns = screen.getAllByRole('button', { name: /Log Payment/i });
    fireEvent.click(paymentBtns[0]);
    
    await waitFor(() => {
      expect(screen.getByText(/Log Payment for/i)).toBeInTheDocument();
    });
  });
});
