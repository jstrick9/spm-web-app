import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RiskAlertsCard } from './RiskAlertsCard';

const forOrgMock = vi.fn();
vi.mock('../../sdk', () => ({ sdk: { risk: { forOrg: (...a: unknown[]) => forOrgMock(...a) } } }));
vi.mock('../../lib/usePermission', () => ({
  usePermission: () => true,
}));

function wrap() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

beforeEach(() => vi.clearAllMocks());

describe('RiskAlertsCard', () => {
  it('lists risky events with their top alerts', async () => {
    forOrgMock.mockResolvedValue({ events: [
      { eventId: 'e1', eventTitle: 'Risky Wedding', startDate: '2026-01-01', daysUntil: 3, healthScore: 40,
        alerts: [
          { id: 'e1:unsigned_contracts', kind: 'unsigned_contracts', severity: 'critical', title: 'Unsigned contracts near event', detail: '1 unsigned.', href: '#/events/e1?tab=contracts' },
        ] },
    ]});
    render(<RiskAlertsCard orgId="org1" />, { wrapper: wrap() });
    expect(await screen.findByText('Events Needing Attention')).toBeInTheDocument();
    expect(screen.getByText('Risky Wedding')).toBeInTheDocument();
    expect(screen.getByText('40')).toBeInTheDocument();
    expect(screen.getByText(/Unsigned contracts near event/)).toBeInTheDocument();
  });

  it('renders nothing when there are no at-risk events', async () => {
    forOrgMock.mockResolvedValue({ events: [] });
    const { container } = render(<RiskAlertsCard orgId="org1" />, { wrapper: wrap() });
    await waitFor(() => expect(forOrgMock).toHaveBeenCalled());
    expect(container.textContent).not.toMatch(/Events Needing Attention/i);
  });
});
