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
      createPortalToken: vi.fn().mockResolvedValue({ token: 'secure-token', tokenId: 'tok-1', expiresAt: '2026-12-31T00:00:00.000Z' }),
      revokePortalToken: vi.fn().mockResolvedValue(undefined),
      listPortalTokens: vi.fn().mockResolvedValue({ tokens: [] }),
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
  beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); });

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

  it('renders manager vendor-specific layout packet review', async () => {
    localStorage.setItem('wvi_registration_role', 'venue_manager');
    render(<EventVendorsTab eventId="evt-1" organizationId="org-1" />, { wrapper: makeWrapper() });

    expect(await screen.findByText('Vendor-specific layout packet review')).toBeInTheDocument();
    expect(screen.getByText(/Review vendor zones, power, load-in path/i)).toBeInTheDocument();
    expect(screen.getByText(/No layout-sensitive vendors detected yet/i)).toBeInTheDocument();
  });

  it('allows logging a payment', async () => {
    (vendorsSdk.addPayment as any).mockResolvedValue({ payment: { id: 'p1' } });
    
    render(<EventVendorsTab eventId="evt-1" organizationId="org-1" />, { wrapper: makeWrapper() });
    await screen.findAllByText('Acme Catering');
    
    const paymentBtns = screen.getAllByRole('button', { name: /Log Pay/i });
    fireEvent.click(paymentBtns[0]);
    
    await waitFor(() => {
      expect(screen.getByText(/Log Payment for/i)).toBeInTheDocument();
    });
  });

  it('renders a Remind button for non-compliant vendors and copies portal link on click', async () => {
    // Mock navigator.clipboard
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock
      }
    });

    render(<EventVendorsTab eventId="evt-1" organizationId="org-1" />, { wrapper: makeWrapper() });
    
    // Find Remind button and click
    const remindBtns = await screen.findAllByRole('button', { name: /Remind/i });
    expect(remindBtns.length).toBeGreaterThanOrEqual(1);
    
    fireEvent.click(remindBtns[0]);

    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledWith(expect.stringContaining('token=secure-token'));
    });
  });
});
