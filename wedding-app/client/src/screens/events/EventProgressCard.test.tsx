import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { EventProgressCard } from './EventProgressCard';

vi.mock('../../sdk', () => ({
  sdk: {
    events: { get: vi.fn().mockResolvedValue({ event: { id: 'e1', organization_id: 'org1' } }) },
    guests: { list: vi.fn().mockResolvedValue({
      guests: [{ id: 'g1' }, { id: 'g2' }],
      counts: { pending: 1, attending: 1, declined: 0, maybe: 0 },
    })},
    vendors: { list: vi.fn().mockResolvedValue({
      vendors: [{ id: 'v1', contract_amount_cents: 200000 }],
    })},
    timeline: { list: vi.fn().mockResolvedValue({
      items: [{ id: 't1' }, { id: 't2' }, { id: 't3' }],
    })},
    budget: { list: vi.fn().mockResolvedValue({
      items: [{ id: 'b1' }], totals: { planned: 100000, actual: 0, paid: 0 },
    })},
    contracts: { list: vi.fn().mockResolvedValue({
      contracts: [{ id: 'c1', status: 'signed' }],
    })},
  },
}));

function wrap() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

describe('EventProgressCard', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('renders the Event Readiness title', async () => {
    render(<EventProgressCard eventId="e1" />, { wrapper: wrap() });
    await waitFor(() => {
      expect(screen.getByText('Event Readiness')).toBeTruthy();
    });
  });

  it('shows milestone labels', async () => {
    render(<EventProgressCard eventId="e1" />, { wrapper: wrap() });
    await waitFor(() => {
      expect(screen.getByText('Guest list created')).toBeTruthy();
      expect(screen.getByText('RSVPs collected')).toBeTruthy();
      expect(screen.getByText('Vendors booked')).toBeTruthy();
      expect(screen.getByText('Timeline planned')).toBeTruthy();
      expect(screen.getByText('Budget tracked')).toBeTruthy();
      expect(screen.getByText('Contracts signed')).toBeTruthy();
    });
  });

  it('shows progress percentage', async () => {
    render(<EventProgressCard eventId="e1" />, { wrapper: wrap() });
    await waitFor(() => {
      // With mock data: guests=true, rsvp=50%(true), vendors=true, timeline=true(3 items), budget=true, contracts=true
      // That's 6/6 = 100%
      expect(screen.getByText('100%')).toBeTruthy();
    });
  });

  it('shows milestone details', async () => {
    render(<EventProgressCard eventId="e1" />, { wrapper: wrap() });
    await waitFor(() => {
      expect(screen.getByText('2 guests added')).toBeTruthy();
      expect(screen.getByText('3 items scheduled')).toBeTruthy();
    });
  });
});
