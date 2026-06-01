import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { VendorPaymentDialog } from './VendorPaymentDialog';

vi.mock('../../../sdk/vendors', () => ({
  vendorsSdk: { addPayment: vi.fn().mockResolvedValue({ payment: { id: 'p1' } }) },
}));
vi.mock('../../../ui/Toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));

function wrap() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

describe('VendorPaymentDialog', () => {
  it('renders payment form when open', () => {
    render(<VendorPaymentDialog open={true} onOpenChange={vi.fn()} vendorId="v1" vendorName="DJ" eventId="e1" />, { wrapper: wrap() });
    expect(screen.getByText(/Log Payment for/i)).toBeTruthy();
  });

  it('does not render when closed', () => {
    const { container } = render(<VendorPaymentDialog open={false} onOpenChange={vi.fn()} vendorId="v1" vendorName="DJ" eventId="e1" />, { wrapper: wrap() });
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it('has amount input', () => {
    render(<VendorPaymentDialog open={true} onOpenChange={vi.fn()} vendorId="v1" vendorName="DJ" eventId="e1" />, { wrapper: wrap() });
    expect(screen.getByPlaceholderText('$0.00')).toBeTruthy();
  });
});
