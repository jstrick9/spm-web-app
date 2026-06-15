import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '../../ui/Toast';
import { EventHealthCommandCenter } from './EventHealthCommandCenter';
import { sdk } from '../../sdk';
import { usePermission } from '../../lib/usePermission';

vi.mock('../../lib/usePermission', () => ({ usePermission: vi.fn() }));

vi.mock('../../sdk', () => ({
  sdk: {
    auth: { me: vi.fn().mockResolvedValue({ user: { id: 'manager-1', email: 'manager@example.com' } }) },
    healthCommand: {
      get: vi.fn().mockResolvedValue({
        commandCenter: {
          summary: {
            openEvents: 2, flaggedEvents: 2, criticalActions: 1, highActions: 2, mediumActions: 0, lowActions: 0,
            avgHealthScore: 76, forecastConfidence: 'high', projectedRevenueCents: 1000000, pipelineRevenueCents: 500000,
            lowReliabilityVendors: 1, guestDuplicateClusters: 1, rsvpLagEvents: 1, timelineIncompleteEvents: 1,
          },
          actions: [
            { id: 'timeline:e1', priority: 'critical', source: 'timeline_completeness', title: 'Build run sheet', detail: 'Timeline missing.', href: '#/events/e1?tab=timeline', eventId: 'e1', eventTitle: 'Wedding A', impact: 'Timeline risk', confidence: 'high', relatedSignals: ['timeline'] },
            { id: 'payment:p1', priority: 'critical', source: 'payments', title: 'Payment milestone overdue', detail: 'Payment overdue.', href: '#/events/e1?tab=budget', eventId: 'e1', eventTitle: 'Wedding A', impact: 'Cashflow risk', confidence: 'high', relatedSignals: ['payment'] },
            { id: 'contract:c1', priority: 'high', source: 'contracts', title: 'Contract missing signature', detail: 'Contract sent.', href: '#/events/e1?tab=contracts', eventId: 'e1', eventTitle: 'Wedding A', impact: 'Legal risk', confidence: 'medium', relatedSignals: ['contract'] },
          ],
          resolvedActions: [{ actionId: 'risk:old', status: 'resolved', note: 'Vendor confirmed backup.', updatedAt: '2026-06-09T10:00:00.000Z' }],
        },
      }),
      updateActionState: vi.fn().mockResolvedValue({ state: {} }),
    },
  },
}));

function renderCenter() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <ToastProvider>
        <EventHealthCommandCenter orgId="org-1" />
      </ToastProvider>
    </QueryClientProvider>,
  );
}

describe('EventHealthCommandCenter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.mocked(usePermission).mockImplementation((permission: string) => permission !== 'budget.view' && permission !== 'contracts.view');
  });

  it('renders manager operations health center and hides owner-only finance/legal alerts without permission', async () => {
    localStorage.setItem('wvi_registration_role', 'venue_manager');
    renderCenter();

    expect(await screen.findByText('Manager Operations Health Center')).toBeInTheDocument();
    expect(screen.getByText('Daily manager briefing')).toBeInTheDocument();
    expect(screen.getByText('Escalation rules engine')).toBeInTheDocument();
    expect(screen.getByText('Event-day command alert board')).toBeInTheDocument();
    expect(screen.getByText('Resolution analytics')).toBeInTheDocument();
    expect(screen.getByText('Build run sheet')).toBeInTheDocument();
    expect(screen.queryByText('Payment milestone overdue')).not.toBeInTheDocument();
    expect(screen.queryByText('Contract missing signature')).not.toBeInTheDocument();
    expect(screen.getByText(/Why this matters operationally/i)).toBeInTheDocument();
    expect(screen.getByText(/High confidence: multiple current signals/i)).toBeInTheDocument();
    expect(screen.getByText(/Manager SLA target/i)).toBeInTheDocument();
    expect(screen.getByText('Resolved action learning summary')).toBeInTheDocument();
  });

  it('supports assigned-to-me and owner/admin escalation actions', async () => {
    localStorage.setItem('wvi_registration_role', 'venue_manager');
    renderCenter();

    const filter = await screen.findByRole('button', { name: /Assigned to me\/my team/i });
    fireEvent.click(filter);
    expect(screen.getByText('Build run sheet')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Escalate owner\/admin/i }));
    await waitFor(() => {
      expect(sdk.healthCommand.updateActionState).toHaveBeenCalledWith('org-1', 'timeline:e1', expect.objectContaining({ note: expect.stringContaining('Escalated') }));
    });
  });
});
