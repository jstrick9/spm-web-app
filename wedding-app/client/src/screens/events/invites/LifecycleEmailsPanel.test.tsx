import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LifecycleEmailsPanel } from './LifecycleEmailsPanel';

const sendMock = vi.fn().mockResolvedValue({
  result: { trigger: 'thank_you', eventId: 'e1', scheduled: 3, skipped: 0 },
});
const logMock = vi.fn().mockResolvedValue({
  emails: [
    { id: 's1', event_id: 'e1', guest_id: 'g1', trigger_type: 'thank_you', recipient_email: 'amy@x.com', subject: 'Thank you Amy!', status: 'sent', error: null, created_at: '', sent_at: '2026-06-01T00:00:00Z' },
  ],
  stats: { pending: 0, sent: 1, failed: 0, skipped: 0 },
});

vi.mock('../../../sdk', () => ({
  sdk: { lifecycleEmails: { log: (...a: unknown[]) => logMock(...a), send: (...a: unknown[]) => sendMock(...a) } },
}));
vi.mock('../../../ui/Toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));

let canSend = true;
vi.mock('../../../lib/usePermission', () => ({ usePermission: () => canSend }));

function wrap() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

describe('LifecycleEmailsPanel', () => {
  beforeEach(() => { vi.clearAllMocks(); canSend = true; });

  it('renders the send log and stats', async () => {
    render(<LifecycleEmailsPanel eventId="e1" />, { wrapper: wrap() });
    expect(await screen.findByText('Thank you Amy!')).toBeInTheDocument();
    expect(screen.getByText('amy@x.com')).toBeInTheDocument();
  });

  it('fires a trigger when a send button is clicked', async () => {
    render(<LifecycleEmailsPanel eventId="e1" />, { wrapper: wrap() });
    const btn = await screen.findByRole('button', { name: /Thank-You/i });
    fireEvent.click(btn);
    await waitFor(() => expect(sendMock).toHaveBeenCalledWith('e1', 'thank_you'));
  });

  it('disables send buttons without invites.send permission', async () => {
    canSend = false;
    render(<LifecycleEmailsPanel eventId="e1" />, { wrapper: wrap() });
    const btn = await screen.findByRole('button', { name: /RSVP Reminder/i });
    expect(btn).toBeDisabled();
    expect(screen.getByText(/don.t have permission/i)).toBeInTheDocument();
  });
});
