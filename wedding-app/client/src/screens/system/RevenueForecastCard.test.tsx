import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RevenueForecastCard } from './RevenueForecastCard';
import type { RevenueForecast } from '../../sdk/intelligence';

function makeForecast(over: Partial<RevenueForecast> = {}): RevenueForecast {
  const history = Array.from({ length: 24 }, (_, i) => ({
    ym: `2024-${String((i % 12) + 1).padStart(2, '0')}`,
    label: `M${i}`,
    bookings: i >= 12 ? 2 : 0,
    revenueCents: i >= 12 ? 200000 : 0,
  }));
  return {
    history,
    projection: Array.from({ length: 6 }, (_, i) => ({
      ym: `2026-0${i + 1}`, label: `P${i}`, bookings: 3, revenueCents: 300000,
      projected: true as const, seasonalIndex: 1 + i * 0.1,
    })),
    trend: { direction: 'up', monthlySlopeCents: 5000, growthPct: 18 },
    totals: { trailingRevenueCents: 1200000, projectedRevenueCents: 1800000, trailingBookings: 12, projectedBookings: 18 },
    pipeline: { openEvents: 3, openRevenueCents: 900000 },
    meta: { monthsOfHistory: 12, horizonMonths: 6, confidence: 'high' },
    ...over,
  };
}

describe('RevenueForecastCard', () => {
  it('renders projected revenue, growth, pipeline, and confidence', () => {
    render(<RevenueForecastCard forecast={makeForecast()} />);
    expect(screen.getByText('Revenue Forecast')).toBeInTheDocument();
    expect(screen.getByText('$18,000')).toBeInTheDocument();          // projected revenue
    expect(screen.getByText(/\+18% vs prior/)).toBeInTheDocument();   // growth
    expect(screen.getByText('$9,000')).toBeInTheDocument();           // pipeline revenue
    expect(screen.getByText('3 open events')).toBeInTheDocument();
    expect(screen.getByText(/high confidence/i)).toBeInTheDocument();
    expect(screen.getByText('Actual')).toBeInTheDocument();
    expect(screen.getByText('Projected')).toBeInTheDocument();
  });

  it('shows an empty-state when there is too little history', () => {
    render(<RevenueForecastCard forecast={makeForecast({ meta: { monthsOfHistory: 1, horizonMonths: 6, confidence: 'low' } })} />);
    expect(screen.getByText(/Not enough history to forecast/i)).toBeInTheDocument();
  });
});
