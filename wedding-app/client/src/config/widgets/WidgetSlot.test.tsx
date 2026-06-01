import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConfigProvider } from '../ConfigProvider.js';
import { WidgetSlot } from './WidgetSlot.js';

// The widget registry components use useQuery internally so we need
// to mock the SDK to avoid real network calls, AND wrap in QueryClientProvider.
vi.mock('../../sdk', () => ({
  sdk: {
    events: {
      list: vi.fn().mockResolvedValue({ events: [], counts: {} }),
    },
  },
}));

function Wrapper({ children, org }: { children: React.ReactNode; org?: any }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return (
    <QueryClientProvider client={qc}>
      <ConfigProvider org={org}>{children}</ConfigProvider>
    </QueryClientProvider>
  );
}

describe('WidgetSlot', () => {
  it('renders the default kpi widgets for the venue dashboard slot', () => {
    render(
      <Wrapper>
        <WidgetSlot id="venue.dashboard.kpis" />
      </Wrapper>,
    );
    // SYSTEM_DEFAULTS puts 4 KPIs in this slot; one of them is "Booking conversion"
    expect(screen.getByText('Booking conversion')).toBeInTheDocument();
    expect(screen.getByText('Avg revenue per event')).toBeInTheDocument();
  });

  it('respects an org override (slot replacement)', () => {
    render(
      <Wrapper org={{
        widgets: {
          'venue.dashboard.kpis': { widgets: [{ id: 'kpi.vacancy' }] },
        },
      }}>
        <WidgetSlot id="venue.dashboard.kpis" />
      </Wrapper>,
    );
    expect(screen.getByText('Vacancy')).toBeInTheDocument();
    expect(screen.queryByText('Booking conversion')).not.toBeInTheDocument();
  });

  it('renders nothing for an unknown slot id', () => {
    const { container } = render(
      <Wrapper><WidgetSlot id="nope.no-such-slot" /></Wrapper>,
    );
    expect(container.firstChild).toBeNull();
  });

  it('skips unknown widget ids quietly', () => {
    const origWarn = console.warn;
    console.warn = () => {};   // suppress expected dev warning
    render(
      <Wrapper org={{
        widgets: {
          'venue.dashboard.kpis': { widgets: [{ id: 'bogus.widget' }, { id: 'kpi.vacancy' }] },
        },
      }}>
        <WidgetSlot id="venue.dashboard.kpis" />
      </Wrapper>,
    );
    console.warn = origWarn;
    expect(screen.getByText('Vacancy')).toBeInTheDocument();
  });

  it('honors per-widget options (benchmarkPct on booking conversion)', () => {
    render(
      <Wrapper org={{
        widgets: {
          'venue.dashboard.kpis': {
            widgets: [{ id: 'kpi.booking-conversion', options: { benchmarkPct: 17 } }],
          },
        },
      }}>
        <WidgetSlot id="venue.dashboard.kpis" />
      </Wrapper>,
    );
    expect(screen.getByText('17%')).toBeInTheDocument();
  });
});
