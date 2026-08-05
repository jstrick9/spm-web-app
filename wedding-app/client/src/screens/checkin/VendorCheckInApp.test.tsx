import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { VendorCheckInApp } from './VendorCheckInApp';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '../../ui/Toast';
import { ApiError } from '../../sdk/client';
import { peek, clear as clearQueue, drain } from '../../dual-write/writeQueue';

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
  beforeEach(async () => {
    vi.clearAllMocks();
    // Restore the default status map — later tests override it per-test.
    const { sdk } = await import('../../sdk');
    (sdk.checkins.list as any).mockResolvedValue({
      checkins: [],
      statusMap: {},
      counts: { expected: 0, arrived: 0, completed: 0, departed: 0 },
    });
    clearQueue();
  });

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

  it('lazy-loads scanner after Scan is tapped and supports simulated QR scan', async () => {
    render(<VendorCheckInApp eventId="evt-1" organizationId="org-1" />, { wrapper: makeWrapper() });
    await screen.findByText('DJ Snake');
    fireEvent.click(screen.getByRole('button', { name: /Scan/i }));
    expect(await screen.findByText(/Loading secure camera scanner/i)).toBeInTheDocument();
    const simulate = await screen.findByRole('button', { name: /Simulate Scan/i });
    fireEvent.click(simulate);
    await waitFor(() => {
      expect(screen.queryByText(/Scan Vendor Pass/i)).not.toBeInTheDocument();
    });
  });

  it('has filter buttons', async () => {
    render(<VendorCheckInApp eventId="evt-1" organizationId="org-1" />, { wrapper: makeWrapper() });
    await screen.findByText('DJ Snake');
    expect(screen.getByText(/All Vendors/)).toBeInTheDocument();
    expect(screen.getByText(/Expected/)).toBeInTheDocument();
    expect(screen.getByText(/On-Site/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Late/ })).toBeInTheDocument();
  });

  it('Late filter shows only vendors explicitly marked late (regression: inverted filter hid them)', async () => {
    const { sdk } = await import('../../sdk');
    (sdk.checkins.list as any).mockResolvedValue({
      checkins: [],
      statusMap: { v1: 'late' },
      counts: { expected: 1, arrived: 0, completed: 0, departed: 0 },
    });
    render(<VendorCheckInApp eventId="evt-1" organizationId="org-1" />, { wrapper: makeWrapper() });
    await screen.findByText('DJ Snake');
    fireEvent.click(screen.getByRole('button', { name: /^Late/ }));
    expect(screen.getByText('DJ Snake')).toBeInTheDocument();
    expect(screen.queryByText('Food Co')).not.toBeInTheDocument();
  });

  it('Mark Late flags an expected vendor as late', async () => {
    const { sdk } = await import('../../sdk');
    render(<VendorCheckInApp eventId="evt-1" organizationId="org-1" />, { wrapper: makeWrapper() });
    await screen.findByText('DJ Snake');
    fireEvent.click(screen.getByRole('button', { name: /Mark DJ Snake as late/i }));
    await waitFor(() => {
      const calls = (sdk.checkins.update as any).mock.calls;
      expect(calls.some((c: unknown[]) => c[0] === 'evt-1' && c[1] === 'v1' && c[2] === 'late')).toBe(true);
    });
  });

  it('late vendors can still be checked in when they arrive', async () => {
    const { sdk } = await import('../../sdk');
    (sdk.checkins.list as any).mockResolvedValue({
      checkins: [],
      statusMap: { v1: 'late' },
      counts: { expected: 0, arrived: 0, completed: 0, departed: 0 },
    });
    render(<VendorCheckInApp eventId="evt-1" organizationId="org-1" />, { wrapper: makeWrapper() });
    await screen.findByText('DJ Snake');
    fireEvent.click(screen.getByRole('button', { name: /Arrived Late/i }));
    await waitFor(() => {
      const calls = (sdk.checkins.update as any).mock.calls;
      expect(calls.some((c: unknown[]) => c[0] === 'evt-1' && c[1] === 'v1' && c[2] === 'arrived')).toBe(true);
    });
  });

  it('queues the update offline and replays it on reconnect (advertised offline retry)', async () => {
    const { sdk } = await import('../../sdk');
    (sdk.checkins.update as any).mockRejectedValueOnce(new ApiError('offline', 0, 'network-error'));
    render(<VendorCheckInApp eventId="evt-1" organizationId="org-1" />, { wrapper: makeWrapper() });
    await screen.findByText('DJ Snake');

    fireEvent.click(screen.getAllByRole('button', { name: /Mark Arrived/i })[0]);
    await waitFor(() => {
      // Offline failure → enqueued, not silently lost
      const q = peek();
      expect(q.some((w) => w.domain === 'vendors' && w.op === 'checkin.update' && (w.payload as any).vendorId === 'v1' && (w.payload as any).status === 'arrived')).toBe(true);
    });
    // Honest success-flavored toast, not "failed"
    await waitFor(() => expect(screen.getByText(/Saved on this device/)).toBeTruthy());

    // Reconnect: queue drains and replays the update in order
    (sdk.checkins.update as any).mockResolvedValue({ checkin: { id: 'c1', vendor_id: 'v1', status: 'arrived' } });
    await drain();
    await waitFor(() => expect(peek()).toHaveLength(0));
    const calls = (sdk.checkins.update as any).mock.calls;
    expect(calls.some((c: unknown[]) => c[0] === 'evt-1' && c[1] === 'v1' && c[2] === 'arrived')).toBe(true);
  });

  it('non-offline failures show the real error message (no false offline promise)', async () => {
    const { sdk } = await import('../../sdk');
    (sdk.checkins.update as any).mockRejectedValueOnce(new ApiError('server', 500, 'internal-error', { error: 'internal-error', message: 'Disk full' }));
    render(<VendorCheckInApp eventId="evt-1" organizationId="org-1" />, { wrapper: makeWrapper() });
    await screen.findByText('DJ Snake');
    fireEvent.click(screen.getAllByRole('button', { name: /Mark Arrived/i })[0]);
    await waitFor(() => expect(screen.getByText(/Status update failed/)).toBeTruthy());
    expect(screen.getByText(/Disk full/)).toBeTruthy();
    expect(peek()).toHaveLength(0);
  });
});
