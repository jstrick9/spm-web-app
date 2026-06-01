import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { VendorCheckInApp } from './VendorCheckInApp';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '../../ui/Toast';

vi.mock('html5-qrcode', () => ({
  Html5QrcodeScanner: class {
    render(onSuccess: any) {
      const reader = document.getElementById('reader');
      if (reader) {
        const btn = document.createElement('button');
        btn.innerHTML = 'Simulate Scan';
        btn.onclick = () => onSuccess('v1');
        reader.appendChild(btn);
      }
    }
    clear() {}
  }
}));

vi.mock('../../sdk', () => ({
  sdk: {
    vendors: {
      list: vi.fn().mockResolvedValue({
        vendors: [
          { id: 'v1', name: 'DJ Snake', category: 'Entertainment' },
          { id: 'v2', name: 'Food Co', category: 'Catering' }
        ]
      }),
    },
    checkins: {
      list: vi.fn().mockResolvedValue({
        checkins: [],
        statusMap: {},
        counts: { expected: 0, arrived: 0, completed: 0, departed: 0 },
      }),
      update: vi.fn().mockResolvedValue({
        checkin: { id: 'c1', vendor_id: 'v1', status: 'arrived', checked_in_at: new Date().toISOString() }
      }),
    },
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

describe('VendorCheckInApp', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('renders vendor list and check-in controls', async () => {
    render(<VendorCheckInApp eventId="evt-1" organizationId="org-1" />, { wrapper: makeWrapper() });
    expect(await screen.findByText('DJ Snake')).toBeInTheDocument();
    expect(screen.getByText('Food Co')).toBeInTheDocument();
    expect(screen.getByText('Vendor Check-In')).toBeInTheDocument();
  });

  it('shows Mark Arrived button for expected vendors', async () => {
    render(<VendorCheckInApp eventId="evt-1" organizationId="org-1" />, { wrapper: makeWrapper() });
    await screen.findByText('DJ Snake');

    const arriveButtons = screen.getAllByText('Mark Arrived');
    expect(arriveButtons.length).toBeGreaterThanOrEqual(1);
  });

  it('has scan button', async () => {
    render(<VendorCheckInApp eventId="evt-1" organizationId="org-1" />, { wrapper: makeWrapper() });
    await screen.findByText('DJ Snake');
    expect(screen.getByRole('button', { name: /Scan/i })).toBeInTheDocument();
  });

  it('has filter buttons', async () => {
    render(<VendorCheckInApp eventId="evt-1" organizationId="org-1" />, { wrapper: makeWrapper() });
    await screen.findByText('DJ Snake');
    expect(screen.getByText(/All Vendors/)).toBeInTheDocument();
    expect(screen.getByText(/Expected/)).toBeInTheDocument();
    expect(screen.getByText(/On-Site/)).toBeInTheDocument();
  });
});
