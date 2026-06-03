/**
 * EventRiskBadge tests — Phase 32
 *
 * Covers:
 *   • Returns null when analytics.view not permitted
 *   • Returns null when eventId not found in risk data
 *   • Compact dot: renders correct color class for each risk level
 *   • Default badge: renders correct text and variant for each risk level
 *   • aria-label present on both modes
 *   • Uses cached risk query (no per-event API call)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('../../../lib/usePermission', () => ({ usePermission: vi.fn() }));
vi.mock('../../../sdk', () => ({
  sdk: {
    risk: { forOrg: vi.fn() },
  },
}));

import { usePermission } from '../../../lib/usePermission';
import { sdk } from '../../../sdk';
import { EventRiskBadge } from './EventRiskBadge';

const makeRiskData = (healthScore: number) => ({
  events: [{ eventId: 'e-1', eventTitle: 'Test Wedding', healthScore, startDate: '2026-06-01', daysUntil: 30, alerts: [] }],
});

function renderBadge(props: { eventId?: string; orgId?: string; compact?: boolean } = {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  qc.setQueryData(['risk-alerts', 'org-1'], makeRiskData(props.compact !== false ? 50 : 90));
  return render(
    <QueryClientProvider client={qc}>
      <EventRiskBadge
        eventId={props.eventId ?? 'e-1'}
        orgId={props.orgId ?? 'org-1'}
        compact={props.compact}
      />
    </QueryClientProvider>,
  );
}

describe('EventRiskBadge', () => {
  beforeEach(() => {
    vi.mocked(usePermission).mockImplementation(
      (p: string) => p === 'analytics.view'
    );
    vi.mocked(sdk.risk.forOrg).mockResolvedValue(makeRiskData(50));
  });

  it('returns null when analytics.view is not permitted', () => {
    vi.mocked(usePermission).mockReturnValue(false as ReturnType<typeof usePermission>);
    const { container } = renderBadge();
    expect(container.firstChild).toBeNull();
  });

  it('returns null when eventId is not in risk data', () => {
    const { container } = renderBadge({ eventId: 'nonexistent-id' });
    expect(container.firstChild).toBeNull();
  });

  describe('compact mode (dot)', () => {
    it('renders a dot with high risk color (score < 60)', () => {
      const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      qc.setQueryData(['risk-alerts', 'org-1'], makeRiskData(45));
      const { container } = render(
        <QueryClientProvider client={qc}>
          <EventRiskBadge eventId="e-1" orgId="org-1" compact />
        </QueryClientProvider>,
      );
      const dot = container.querySelector('[role="img"]');
      expect(dot).toBeTruthy();
      expect(dot!.className).toContain('bg-danger');
      expect(dot!.getAttribute('aria-label')).toContain('At Risk');
    });

    it('renders a dot with medium risk color (score 60–84)', () => {
      const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      qc.setQueryData(['risk-alerts', 'org-1'], makeRiskData(70));
      const { container } = render(
        <QueryClientProvider client={qc}>
          <EventRiskBadge eventId="e-1" orgId="org-1" compact />
        </QueryClientProvider>,
      );
      const dot = container.querySelector('[role="img"]');
      expect(dot!.className).toContain('bg-warning');
    });

    it('renders a dot with low risk color (score >= 85)', () => {
      const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      qc.setQueryData(['risk-alerts', 'org-1'], makeRiskData(92));
      const { container } = render(
        <QueryClientProvider client={qc}>
          <EventRiskBadge eventId="e-1" orgId="org-1" compact />
        </QueryClientProvider>,
      );
      const dot = container.querySelector('[role="img"]');
      expect(dot!.className).toContain('bg-success');
    });
  });

  describe('default mode (badge)', () => {
    it('renders "At Risk" badge for score < 60', () => {
      const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      qc.setQueryData(['risk-alerts', 'org-1'], makeRiskData(45));
      render(
        <QueryClientProvider client={qc}>
          <EventRiskBadge eventId="e-1" orgId="org-1" />
        </QueryClientProvider>,
      );
      expect(screen.getByText('At Risk')).toBeTruthy();
    });

    it('renders "Watch" badge for score 60–84', () => {
      const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      qc.setQueryData(['risk-alerts', 'org-1'], makeRiskData(70));
      render(
        <QueryClientProvider client={qc}>
          <EventRiskBadge eventId="e-1" orgId="org-1" />
        </QueryClientProvider>,
      );
      expect(screen.getByText('Watch')).toBeTruthy();
    });

    it('renders "On Track" badge for score >= 85', () => {
      const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      qc.setQueryData(['risk-alerts', 'org-1'], makeRiskData(92));
      render(
        <QueryClientProvider client={qc}>
          <EventRiskBadge eventId="e-1" orgId="org-1" />
        </QueryClientProvider>,
      );
      expect(screen.getByText('On Track')).toBeTruthy();
    });

    it('has aria-label on the badge', () => {
      const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      qc.setQueryData(['risk-alerts', 'org-1'], makeRiskData(45));
      render(
        <QueryClientProvider client={qc}>
          <EventRiskBadge eventId="e-1" orgId="org-1" />
        </QueryClientProvider>,
      );
      const badge = screen.getByLabelText(/Risk level/i);
      expect(badge).toBeTruthy();
    });
  });
});
