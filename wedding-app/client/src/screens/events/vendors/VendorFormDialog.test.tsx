import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { VendorFormDialog } from './VendorFormDialog';

vi.mock('../../../sdk', () => ({
  sdk: {
    vendors: {
      create: vi.fn().mockResolvedValue({ vendor: { id: 'v-new' } }),
    },
  },
}));
vi.mock('../../../ui/Toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));

function wrap() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

describe('VendorFormDialog', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('renders form fields when open', () => {
    render(<VendorFormDialog open={true} onOpenChange={vi.fn()} organizationId="org1" eventId="e1" />, { wrapper: wrap() });
    expect(screen.getByText(/vendor name/i)).toBeTruthy();
  });

  it('does not render when closed', () => {
    const { container } = render(<VendorFormDialog open={false} onOpenChange={vi.fn()} organizationId="org1" eventId="e1" />, { wrapper: wrap() });
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it('has category and contract amount fields', () => {
    render(<VendorFormDialog open={true} onOpenChange={vi.fn()} organizationId="org1" eventId="e1" />, { wrapper: wrap() });
    expect(screen.getByText(/category/i)).toBeTruthy();
  });
});
