import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EventVendorsTab } from './EventVendorsTab';
import { vendorsSdk } from '../../../sdk/vendors';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '../../../ui/Toast';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } }
});

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
    }
  }
}));

// Also need to mock vendorsSdk explicitly since VendorPaymentDialog imports it directly
vi.mock('../../../sdk/vendors', () => ({
  vendorsSdk: {
    addPayment: vi.fn(),
    list: vi.fn(),
    create: vi.fn(),
  }
}));

describe('EventVendorsTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const TestWrapper = ({ children }: any) => (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        {children}
      </ToastProvider>
    </QueryClientProvider>
  );

  it('renders vendors and contract totals', async () => {
    render(<EventVendorsTab eventId="evt-1" organizationId="org-1" />, { wrapper: TestWrapper });
    
    expect(await screen.findByText('Acme Catering')).toBeInTheDocument();
    expect(screen.getByText('Snap Pics')).toBeInTheDocument();
    
    // Totals
    expect(screen.getByText('2')).toBeInTheDocument(); // total vendors
    expect(screen.getAllByText('$5,000.00')[0]).toBeInTheDocument();
    expect(screen.getByText('Paid: $1,000')).toBeInTheDocument();
  });
  
  it('filters by search text', async () => {
    render(<EventVendorsTab eventId="evt-1" organizationId="org-1" />, { wrapper: TestWrapper });
    
    expect(await screen.findByText('Acme Catering')).toBeInTheDocument();
    
    const searchInput = screen.getByPlaceholderText('Search vendors...');
    fireEvent.change(searchInput, { target: { value: 'Photo' } });
    
    expect(screen.queryByText('Acme Catering')).not.toBeInTheDocument();
    expect(screen.getByText('Snap Pics')).toBeInTheDocument();
  });

  it('allows logging a payment', async () => {
    (vendorsSdk.addPayment as any).mockResolvedValue({ payment: { id: 'p1' } });
    
    render(<EventVendorsTab eventId="evt-1" organizationId="org-1" />, { wrapper: TestWrapper });
    
    expect(await screen.findByText('Acme Catering')).toBeInTheDocument();
    
    const paymentBtns = screen.getAllByRole('button', { name: /Log Payment/i });
    fireEvent.click(paymentBtns[0]);
    
    expect(screen.getByText('Log Payment for Acme Catering')).toBeInTheDocument();
    
    const amountInput = screen.getByPlaceholderText('$0.00');
    fireEvent.change(amountInput, { target: { value: '1000' } });
    
    const submitBtn = screen.getByRole('button', { name: /Record Payment/i });
    fireEvent.click(submitBtn);
  });
});
