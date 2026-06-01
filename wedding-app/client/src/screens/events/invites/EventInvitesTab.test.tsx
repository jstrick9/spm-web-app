import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { EventInvitesTab } from './EventInvitesTab';

vi.mock('../../../sdk', () => ({
  sdk: {
    guests: {
      list: vi.fn().mockResolvedValue({
        guests: [
          { id: 'g1', full_name: 'Alice Smith', email: 'alice@test.com', rsvp_status: 'attending' },
          { id: 'g2', full_name: 'Bob Jones', email: 'bob@test.com', rsvp_status: 'pending' },
        ],
        counts: { pending: 1, attending: 1, declined: 0, maybe: 0 },
      }),
    },
    inviteTracking: {
      list: vi.fn().mockResolvedValue({
        tracking: [],
        statusMap: {},
        counts: { notSent: 2, sent: 0, opened: 0, bounced: 0 },
      }),
      bulkSend: vi.fn().mockResolvedValue({ sent: 2 }),
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

describe('EventInvitesTab', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('renders builder view by default with theme options', async () => {
    render(<EventInvitesTab eventId="e1" />, { wrapper: wrap() });
    expect(screen.getByText('Design Invitation')).toBeTruthy();
    expect(screen.getByText('formal')).toBeTruthy();
    expect(screen.getByText('modern')).toBeTruthy();
    expect(screen.getByText('garden')).toBeTruthy();
  });

  it('renders Send to Guests button', async () => {
    render(<EventInvitesTab eventId="e1" />, { wrapper: wrap() });
    expect(screen.getByText('Send to Guests')).toBeTruthy();
  });

  it('switches to tracking view', async () => {
    render(<EventInvitesTab eventId="e1" />, { wrapper: wrap() });
    fireEvent.click(screen.getByText('Track Opens & Sends'));

    await waitFor(() => {
      expect(screen.getByText('Total Guests')).toBeTruthy();
      expect(screen.getByText('Invites Sent')).toBeTruthy();
      expect(screen.getByText('Open Rate')).toBeTruthy();
    });
  });

  it('shows guest list in tracking view', async () => {
    render(<EventInvitesTab eventId="e1" />, { wrapper: wrap() });
    fireEvent.click(screen.getByText('Track Opens & Sends'));

    await waitFor(() => {
      expect(screen.getByText('Alice Smith')).toBeTruthy();
      expect(screen.getByText('Bob Jones')).toBeTruthy();
    });
  });

  it('renders invitation preview with editable blocks', async () => {
    render(<EventInvitesTab eventId="e1" />, { wrapper: wrap() });
    expect(screen.getAllByText('You are joyfully invited to the wedding of').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Sarah & James').length).toBeGreaterThanOrEqual(1);
  });

  it('adds a new text block', async () => {
    render(<EventInvitesTab eventId="e1" />, { wrapper: wrap() });
    
    const addTextBtns = screen.getAllByText('Text');
    fireEvent.click(addTextBtns[addTextBtns.length - 1]); // Click the "Text" add button

    await waitFor(() => {
      expect(screen.getAllByText('Enter text here...').length).toBeGreaterThanOrEqual(1);
    });
  });
});
