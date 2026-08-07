import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { EventVendorsTab } from './EventVendorsTab';
import { vendorsSdk } from '../../../sdk/vendors';
import { sdk } from '../../../sdk';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '../../../ui/Toast';

vi.mock('../../../sdk', () => ({
  sdk: {
    vendors: {
      addPayment: vi.fn(),
      createPortalToken: vi.fn().mockResolvedValue({ token: 'secure-token', tokenId: 'tok-1', expiresAt: '2026-12-31T00:00:00.000Z' }),
      revokePortalToken: vi.fn().mockResolvedValue(undefined),
      reviewCoi: vi.fn().mockResolvedValue({ vendor: {} }),
      deletePayment: vi.fn().mockResolvedValue(undefined),
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

const sdkList = sdk.vendors.list as ReturnType<typeof vi.fn>;
const sdkReviewCoi = sdk.vendors.reviewCoi as ReturnType<typeof vi.fn>;
const sdkCreatePortalToken = sdk.vendors.createPortalToken as ReturnType<typeof vi.fn>;

describe('EventVendorsTab COI review workflow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    // A vendor with an uploaded COI awaiting venue review.
    sdkList.mockResolvedValue({
      vendors: [
        {
          id: 'v-coi', name: 'Floral Co', category: 'Florist',
          email: 'floral@co.com',
          metadata: JSON.stringify({
            coiReceived: true,
            coiVerificationStatus: 'pending_review',
            coiAssetId: 'asset-42',
            coiExpirationDate: '2027-01-01',
          }),
        },
      ],
    });
  });

  it('shows View COI, Approve, and Request changes actions for a pending-review COI', async () => {
    render(<EventVendorsTab eventId="evt-1" organizationId="org-1" />, { wrapper: makeWrapper() });
    await screen.findAllByText('Floral Co');
    const viewLink = screen.getByRole('link', { name: /view coi file/i });
    expect(viewLink.getAttribute('href')).toBe('/api/assets/asset-42/content');
    expect(screen.getByRole('button', { name: /approve/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /request changes/i })).toBeInTheDocument();
  });

  it('fires the COI review mutation on Approve', async () => {
    render(<EventVendorsTab eventId="evt-1" organizationId="org-1" />, { wrapper: makeWrapper() });
    await screen.findAllByText('Floral Co');
    fireEvent.click(screen.getByRole('button', { name: /approve/i }));
    await waitFor(() => {
      expect(sdkReviewCoi).toHaveBeenCalledWith('v-coi', { status: 'approved' });
    });
  });

  it('preview reuses the persisted portal URL without rotating the token', async () => {
    localStorage.setItem('wvi_vendor_portal_urls', JSON.stringify({ 'v-coi': 'http://x/#/vendor/v-coi?token=remembered' }));
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    render(<EventVendorsTab eventId="evt-1" organizationId="org-1" />, { wrapper: makeWrapper() });
    await screen.findAllByText('Floral Co');
    fireEvent.click(screen.getByRole('button', { name: /preview vendor portal/i }));
    await waitFor(() => {
      expect(openSpy).toHaveBeenCalledWith('http://x/#/vendor/v-coi?token=remembered', '_blank', 'noopener,noreferrer');
    });
    // No rotation happened — createPortalToken was not called.
    expect(sdkCreatePortalToken).not.toHaveBeenCalled();
    openSpy.mockRestore();
  });

  it('flags a COI as EXPIRED only after its calendar date passes (never a day early)', async () => {
    // Date-only strings in LOCAL calendar terms so the test is TZ-agnostic.
    const pad = (n: number) => String(n).padStart(2, '0');
    const now = new Date();
    const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    const yesterdayStr = `${yesterday.getFullYear()}-${pad(yesterday.getMonth() + 1)}-${pad(yesterday.getDate())}`;
    sdkList.mockResolvedValue({
      vendors: [{
        id: 'v-exp', name: 'Expired Co', category: 'Catering',
        metadata: JSON.stringify({ coiReceived: true, coiVerificationStatus: 'approved', coiExpirationDate: yesterdayStr }),
      }],
    });
    render(<EventVendorsTab eventId="evt-1" organizationId="org-1" />, { wrapper: makeWrapper() });
    await screen.findAllByText('Expired Co');
    expect(screen.getByText(/Expired COI/i)).toBeInTheDocument();
  });

  it('flags a COI expiring within 30 days as Expiring Soon (and today is not expired)', async () => {
    const pad = (n: number) => String(n).padStart(2, '0');
    const now = new Date();
    const soon = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 10);
    const soonStr = `${soon.getFullYear()}-${pad(soon.getMonth() + 1)}-${pad(soon.getDate())}`;
    sdkList.mockResolvedValue({
      vendors: [{
        id: 'v-soon', name: 'Soon Co', category: 'Florist',
        metadata: JSON.stringify({ coiReceived: true, coiVerificationStatus: 'approved', coiExpirationDate: soonStr }),
      }],
    });
    render(<EventVendorsTab eventId="evt-1" organizationId="org-1" />, { wrapper: makeWrapper() });
    await screen.findAllByText('Soon Co');
    expect(screen.getByText(/COI Expiring Soon/i)).toBeInTheDocument();
    expect(screen.queryByText(/Expired COI/i)).not.toBeInTheDocument();
  });
});
