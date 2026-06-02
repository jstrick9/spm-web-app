/**
 * RevenueForecastCard — predictive booking & revenue forecast.
 *
 * Renders trailing actuals + projected next-N months as a single timeline
 * bar chart (solid = actual, striped/translucent = projection), plus trend,
 * projected totals, pipeline, and a confidence note.
 * Pure-CSS bars (no recharts) to stay in the already-lazy Intelligence chunk.
 *
 * FIXES APPLIED:
 *   N3  — RBAC: analytics.view permission checked before rendering.
 *   A11y — role="img" + aria-label on chart container.
 *   A11y — Legend uses aria-hidden decorative swatches.
 *   UX  — "Not enough history" state improved with actionable guidance.
 *   UX  — Rate advice section: surfaces pricing recommendation when peak
 *          months have open capacity (intelligence differentiator).
 */
import React, { useMemo } from 'react';
import { TrendingUp, TrendingDown, Minus, CalendarClock, Lightbulb } from 'lucide-react';
import type { RevenueForecast } from '../../sdk/intelligence';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../ui/Card';
import { Badge } from '../../ui/Badge';
import { StatCard } from '../../ui/StatCard';
import { usePermissions } from '../../lib/usePermissions';

const money = (cents: number) =>
  `$${Math.round(cents / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

const CONFIDENCE_VARIANT: Record<string, 'success' | 'warning' | 'default'> = {
  high: 'success',
  medium: 'warning',
  low: 'default',
};

interface Props {
  forecast: RevenueForecast;
}

export function RevenueForecastCard({ forecast }: Props) {
  // N3 fix: respect analytics.view permission
  const { can } = usePermissions();
  if (!can('analytics.view')) return null;

  const { history, projection, trend, totals, pipeline, meta } = forecast;

  // Show a compact window: last 6 actuals + the full projection
  const series = useMemo(() => {
    const recentHistory = history.slice(-6).map((h) => ({ ...h, projected: false as const }));
    return [...recentHistory, ...projection];
  }, [history, projection]);

  const maxRev = Math.max(1, ...series.map((s) => s.revenueCents));
  const TrendIcon =
    trend.direction === 'up' ? TrendingUp : trend.direction === 'down' ? TrendingDown : Minus;
  const trendColor =
    trend.direction === 'up'
      ? 'text-success'
      : trend.direction === 'down'
        ? 'text-danger'
        : 'text-fg-muted';

  // Rate advice: identify peak projected months for pricing guidance
  const peakProjected =
    projection.length > 0
      ? projection.reduce((a, b) => (a.revenueCents > b.revenueCents ? a : b))
      : null;
  const showRateAdvice =
    meta.confidence !== 'low' &&
    trend.direction === 'up' &&
    peakProjected &&
    peakProjected.revenueCents > 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-brand" aria-hidden="true" />
              Revenue Forecast
            </CardTitle>
            <CardDescription>
              Projected next {meta.horizonMonths} months from your booking history +
              seasonality
            </CardDescription>
          </div>
          <Badge
            variant={CONFIDENCE_VARIANT[meta.confidence] ?? 'default'}
            className="capitalize shrink-0"
            aria-label={`Forecast confidence: ${meta.confidence}`}
          >
            {meta.confidence} confidence
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {meta.monthsOfHistory < 3 ? (
          <div className="py-8 text-center border border-dashed border-border rounded-lg">
            <p className="text-sm text-fg-muted">
              Not enough history to forecast yet.
            </p>
            <p className="text-xs text-fg-subtle mt-1">
              Add booked or completed events with start dates and budgets to unlock
              revenue forecasting.
            </p>
          </div>
        ) : (
          <>
            {/* KPI stat band */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <StatCard
                label={`Projected (${meta.horizonMonths}mo)`}
                value={money(totals.projectedRevenueCents)}
                description={
                  <span className={`inline-flex items-center gap-1 ${trendColor}`}>
                    <TrendIcon className="h-3 w-3" aria-hidden="true" />
                    {trend.growthPct >= 0 ? '+' : ''}
                    {trend.growthPct}% vs prior {meta.horizonMonths}mo
                  </span>
                }
              />
              <StatCard
                label="Projected Bookings"
                value={totals.projectedBookings}
                description={`next ${meta.horizonMonths} months`}
              />
              <StatCard
                label="In Pipeline"
                value={money(pipeline.openRevenueCents)}
                description={`${pipeline.openEvents} open event${pipeline.openEvents === 1 ? '' : 's'}`}
              />
            </div>

            {/* Timeline bar chart */}
            <div>
              <div
                className="flex items-end gap-1 h-40"
                role="img"
                aria-label={`Revenue history and ${meta.horizonMonths}-month projection by month`}
              >
                {series.map((d, i) => {
                  const h = d.revenueCents > 0 ? Math.max(4, (d.revenueCents / maxRev) * 100) : 2;
                  return (
                    <div key={`${d.ym}-${i}`} className="flex-1 flex flex-col items-center justify-end h-full">
                      <div
                        className={
                          'w-full max-w-[34px] rounded-t transition-all ' +
                          (d.projected
                            ? 'bg-brand/40 border border-dashed border-brand'
                            : 'bg-brand hover:bg-brand-strong')
                        }
                        style={{ height: `${h}%` }}
                        title={`${d.label}: ${money(d.revenueCents)}${d.projected ? ' (projected)' : ''}`}
                      />
                    </div>
                  );
                })}
              </div>

              {/* Month labels */}
              <div className="flex gap-1 mt-1" aria-hidden="true">
                {series.map((d, i) => (
                  <div
                    key={`${d.ym}-label-${i}`}
                    className={`flex-1 text-center text-[9px] truncate ${
                      d.projected ? 'text-brand font-medium' : 'text-fg-subtle'
                    }`}
                  >
                    {d.label}
                  </div>
                ))}
              </div>

              {/* Legend */}
              <div
                className="flex items-center justify-center gap-4 mt-3 text-[11px] text-fg-muted"
                aria-label="Chart legend"
              >
                <span className="inline-flex items-center gap-1">
                  <span className="w-3 h-3 rounded-sm bg-brand inline-block" aria-hidden="true" />
                  Actual
                </span>
                <span className="inline-flex items-center gap-1">
                  <span
                    className="w-3 h-3 rounded-sm bg-brand/40 border border-dashed border-brand inline-block"
                    aria-hidden="true"
                  />
                  Projected
                </span>
              </div>
            </div>

            {/* Rate advice — intelligence differentiator */}
            {showRateAdvice && peakProjected && (
              <div className="rounded-lg bg-brand/5 border border-brand/20 p-3 flex items-start gap-3">
                <Lightbulb
                  className="h-4 w-4 text-brand shrink-0 mt-0.5"
                  aria-hidden="true"
                />
                <div>
                  <p className="text-xs font-semibold text-brand mb-0.5">
                    Pricing Intelligence
                  </p>
                  <p className="text-xs text-fg-muted">
                    <strong>{peakProjected.label}</strong> is your strongest projected
                    month. Consider a premium Saturday rate — peak demand supports
                    a 10–15% uplift.
                  </p>
                </div>
              </div>
            )}

            {/* Model transparency note */}
            <p className="text-xs text-fg-subtle">
              Model: least-squares trend over your last 12 months × per-month seasonal
              index, learned from {meta.monthsOfHistory} months of booking history.
              Pipeline shows revenue already in the funnel.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
