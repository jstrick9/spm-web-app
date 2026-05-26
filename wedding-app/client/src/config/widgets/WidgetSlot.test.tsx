import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ConfigProvider } from '../ConfigProvider.js';
import { WidgetSlot } from './WidgetSlot.js';

describe('WidgetSlot', () => {
  it('renders the default kpi widgets for the venue dashboard slot', () => {
    render(
      <ConfigProvider>
        <WidgetSlot id="venue.dashboard.kpis" />
      </ConfigProvider>,
    );
    // SYSTEM_DEFAULTS puts 4 KPIs in this slot; one of them is "Booking conversion"
    expect(screen.getByText('Booking conversion')).toBeInTheDocument();
    expect(screen.getByText('Avg revenue per event')).toBeInTheDocument();
  });

  it('respects an org override (slot replacement)', () => {
    render(
      <ConfigProvider
        org={{
          widgets: {
            'venue.dashboard.kpis': { widgets: [{ id: 'kpi.vacancy' }] },
          },
        }}
      >
        <WidgetSlot id="venue.dashboard.kpis" />
      </ConfigProvider>,
    );
    expect(screen.getByText('Vacancy')).toBeInTheDocument();
    expect(screen.queryByText('Booking conversion')).not.toBeInTheDocument();
  });

  it('renders nothing for an unknown slot id', () => {
    const { container } = render(
      <ConfigProvider><WidgetSlot id="nope.no-such-slot" /></ConfigProvider>,
    );
    expect(container.firstChild).toBeNull();
  });

  it('skips unknown widget ids quietly', () => {
    const origWarn = console.warn;
    console.warn = () => {};   // suppress expected dev warning
    render(
      <ConfigProvider
        org={{
          widgets: {
            'venue.dashboard.kpis': { widgets: [{ id: 'bogus.widget' }, { id: 'kpi.vacancy' }] },
          },
        }}
      >
        <WidgetSlot id="venue.dashboard.kpis" />
      </ConfigProvider>,
    );
    console.warn = origWarn;
    expect(screen.getByText('Vacancy')).toBeInTheDocument();
  });

  it('honors per-widget options (benchmarkPct on booking conversion)', () => {
    render(
      <ConfigProvider
        org={{
          widgets: {
            'venue.dashboard.kpis': {
              widgets: [{ id: 'kpi.booking-conversion', options: { benchmarkPct: 17 } }],
            },
          },
        }}
      >
        <WidgetSlot id="venue.dashboard.kpis" />
      </ConfigProvider>,
    );
    expect(screen.getByText('17%')).toBeInTheDocument();
  });
});
