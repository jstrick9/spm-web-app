import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { EventRiskCard } from './EventRiskCard';

const forEventMock = vi.fn();
vi.mock('../../sdk', () => ({ sdk: { risk: { forEvent: (...a: unknown[]) => forEventMock(...a) } } }));

function wrap() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

beforeEach(() => vi.clearAllMocks());

describe('EventRiskCard', () => {
  it('renders alerts + health score when risks exist', async () => {
    forEventMock.mockResolvedValue({ risk: {
      eventId: 'e1', eventTitle: 'E', startDate: '2026-01-01', daysUntil: 7, healthScore: 55,
      alerts: [
        { id: 'e1:unsigned_contracts', kind: 'unsigned_contracts', severity: 'critical', title: 'Unsigned contracts near event', detail: '1 of 2 unsigned.', href: '#/events/e1?tab=contracts' },
        { id: 'e1:no_vendors', kind: 'no_vendors', severity: 'warning', title: 'No vendors booked', detail: 'none attached', href: '#/events/e1?tab=vendors' },
      ],
    }});
    render(<EventRiskCard eventId="e1" />, { wrapper: wrap() });
    expect(await screen.findByText('Event Health')).toBeInTheDocument();
    expect(screen.getByText('55')).toBeInTheDocument();
    expect(screen.getByText('At risk')).toBeInTheDocument();
    expect(screen.getByText('Unsigned contracts near event')).toBeInTheDocument();
    expect(screen.getByText('No vendors booked')).toBeInTheDocument();
  });

  it('shows an all-clear when there are no alerts', async () => {
    forEventMock.mockResolvedValue({ risk: {
      eventId: 'e1', eventTitle: 'E', startDate: null, daysUntil: null, healthScore: 100, alerts: [],
    }});
    render(<EventRiskCard eventId="e1" />, { wrapper: wrap() });
    expect(await screen.findByText(/No risks detected/i)).toBeInTheDocument();
  });
});
