import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { VendorCommunicationsHub } from './VendorCommunicationsHub';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '../../../../ui/Toast';

vi.mock('../../../../sdk', () => ({
  sdk: {
    vendors: {
      list: vi.fn().mockResolvedValue({
        vendors: [
          { id: 'v1', name: 'DJ Snake', category: 'Entertainment' },
          { id: 'v2', name: 'Acme Catering', category: 'Catering' }
        ]
      }),
    }
  }
}));

// Mock the API client for direct message calls
vi.mock('../../../../sdk/client', () => ({
  api: {
    get: vi.fn().mockResolvedValue({ messages: [] }),
    post: vi.fn().mockResolvedValue({ message: { id: 'm1' } }),
  },
}));

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>
      <ToastProvider>{children}</ToastProvider>
    </QueryClientProvider>
  );
}

describe('VendorCommunicationsHub', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('renders vendor list and messaging UI', async () => {
    render(<VendorCommunicationsHub eventId="evt-1" organizationId="org-1" />, { wrapper: makeWrapper() });
    expect(await screen.findByText('DJ Snake')).toBeInTheDocument();
    expect(screen.getByText('Acme Catering')).toBeInTheDocument();
    expect(screen.getByText('Communications Hub')).toBeInTheDocument();
  });

  it('switches to broadcast mode', async () => {
    render(<VendorCommunicationsHub eventId="evt-1" organizationId="org-1" />, { wrapper: makeWrapper() });
    await screen.findByText('DJ Snake');

    const broadcastBtn = screen.getByRole('button', { name: /Broadcast/i });
    fireEvent.click(broadcastBtn);

    await waitFor(() => {
      expect(screen.getByText('Broadcast Announcement')).toBeInTheDocument();
    });
  });

  it('shows empty state when no messages', async () => {
    render(<VendorCommunicationsHub eventId="evt-1" organizationId="org-1" />, { wrapper: makeWrapper() });
    await screen.findByText('DJ Snake');

    await waitFor(() => {
      expect(screen.getByText(/No messages yet/)).toBeInTheDocument();
    });
  });
});
