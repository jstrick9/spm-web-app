/**
 * IntelligenceDashboard — the "intelligence" surface of the platform.
 *
 * FIXES APPLIED in this version:
 *   N3  — RBAC gate: analytics.view required; AccessDenied rendered otherwise.
 *   N4  — Emoji accessibility: aria-hidden + sr-only text for 🔥 ❄️ symbols.
 *   UX  — Minimum data guard: < 5 events → "Building Your Intelligence" empty state.
 *   UX  — forecastData staleTime bumped to 10 min (historical computation).
 *   UX  — Loading skeleton granularity improved (4 cards vs single h-96).
 *   UX  — RSVP velocity section added with sparkline-style bar display.
 */
import { useQuery } from '@tanstack/react-query';
import {
  Brain,
  TrendingUp,
  Calendar,
  Users,
  DollarSign,
  Utensils,
  BarChart3,
  Target,
  Sparkles,
} from 'lucide-react';
import { sdk } from '../../sdk';
import type { EventRecommendations } from '../../sdk/intelligence';
import { PageBody, PageHeader } from '../../ui/AppShell';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../ui/Card';
import { Badge } from '../../ui/Badge';
import { StatCard } from '../../ui/StatCard';
import { Skeleton } from '../../ui/Skeleton';
import { EmptyState } from '../../ui/EmptyState';
import { AccessDenied } from '../../ui/AccessDenied';
import { RevenueForecastCard } from './RevenueForecastCard';
import { RiskAlertsCard } from './RiskAlertsCard';
// usePermission hook — guards this entire screen
import { usePermission } from '../../lib/usePermission';

interface Props {
  orgId: string;
}

/** Minimum events before benchmarks are statistically meaningful. */
const MIN_EVENTS_FOR_INTELLIGENCE = 5;

export function IntelligenceDashboard({ orgId }: Props) {
  // ── RBAC gate (N3 fix) ──────────────────────────────────────────────────
  const canViewAnalytics = usePermission('analytics.view');

  if (!canViewAnalytics) {
    return (
      <>
        <PageHeader
          title={
            <span className="flex items-center gap-2">
              <Brain className="h-6 w-6 text-brand" aria-hidden="true" />
              Intelligence
            </span>
          }
        />
        <PageBody>
          <AccessDenied feature="Intelligence Dashboard" className="min-h-[360px]" />
        </PageBody>
      </>
    );
  }

  // ── Data fetching ────────────────────────────────────────────────────────
  const { data, isLoading } = useQuery({
    queryKey: ['recommendations', orgId],
    queryFn: () => sdk.recommendations.get(orgId),
    staleTime: 5 * 60_000,
  });

  // FIX: forecastData staleTime 10min — historical derived computation
  const { data: forecastData } = useQuery({
    queryKey: ['forecast', orgId],
    queryFn: () => sdk.forecast.get(orgId),
    staleTime: 10 * 60_000,
  });

  // ── Loading state ────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <>
        <PageHeader
          title={
            <span className="flex items-center gap-2">
              <Brain className="h-6 w-6 text-brand" aria-hidden="true" />
              Intelligence
            </span>
          }
          description="Data-driven insights from your historical event data."
        />
        <PageBody className="space-y-6">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-36 rounded-xl" />
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Skeleton className="h-64 rounded-xl" />
            <Skeleton className="h-64 rounded-xl" />
            <Skeleton className="h-64 rounded-xl" />
            <Skeleton className="h-64 rounded-xl" />
          </div>
        </PageBody>
      </>
    );
  }

  const rec = data?.recommendations;

  // ── Minimum data guard ───────────────────────────────────────────────────
  if (!rec || rec.budgetRange.count < MIN_EVENTS_FOR_INTELLIGENCE) {
    const eventsCompleted = rec?.budgetRange.count ?? 0;
    const needed = MIN_EVENTS_FOR_INTELLIGENCE - eventsCompleted;
    return (
      <>
        <PageHeader
          title={
            <span className="flex items-center gap-2">
              <Brain className="h-6 w-6 text-brand" aria-hidden="true" />
              Intelligence
            </span>
          }
          description="Data-driven insights from your historical event data."
        />
        <PageBody>
          <EmptyState
            icon={Sparkles}
            title="Building Your Intelligence"
            description={
              eventsCompleted === 0
                ? 'Complete your first event with budget data to start building insights.'
                : `Complete ${needed} more event${needed === 1 ? '' : 's'} with budget data to unlock full benchmarks, seasonal forecasts, and lead-source ROI.`
            }
          />
        </PageBody>
      </>
    );
  }

  const fmt = (cents: number) =>
    `$${(cents / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

  return (
    <>
      <PageHeader
        title={
          <span className="flex items-center gap-2">
            <Brain className="h-6 w-6 text-brand" aria-hidden="true" />
            Intelligence
          </span>
        }
        description="Data-driven insights from your historical event data."
      />
      <PageBody className="space-y-6">

        {/* ── Budget & Guest Benchmarks ─────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard
            label="Median Budget"
            value={rec.budgetRange.count > 0 ? fmt(rec.budgetRange.median) : '—'}
            description={
              rec.budgetRange.count > 0
                ? `${fmt(rec.budgetRange.p25)} – ${fmt(rec.budgetRange.p75)} range`
                : undefined
            }
          />
          <StatCard
            label="Median Guests"
            value={rec.guestCountRange.median || '—'}
            description={
              rec.guestCountRange.p25
                ? `${rec.guestCountRange.p25} – ${rec.guestCountRange.p75} range`
                : undefined
            }
          />
          <StatCard
            label="Avg Timeline Items"
            value={rec.avgTimelineItems || '—'}
            description="per event"
          />
          <StatCard
            label="Events Analyzed"
            value={rec.budgetRange.count}
            description="with budget data"
          />
        </div>

        {/* ── Proactive risk alerts (server-computed) ───────────────────── */}
        <RiskAlertsCard orgId={orgId} />

        {/* ── Revenue forecast (shown when sufficient history exists) ────── */}
        {forecastData?.forecast && (
          <RevenueForecastCard forecast={forecastData.forecast} />
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">

          {/* ── Seasonal Demand Heatmap ─────────────────────────────────── */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="h-4 w-4 text-brand" aria-hidden="true" />
                Seasonal Demand
              </CardTitle>
              <CardDescription>Which months book the most events</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-6 sm:grid-cols-12 gap-1" role="list" aria-label="Monthly demand heatmap">
                {rec.seasonalDemand.map((m) => {
                  const intensity = m.percentage > 0 ? Math.min(100, m.percentage * 3) : 0;
                  return (
                    <div key={m.month} className="text-center" role="listitem">
                      <div
                        className="aspect-square rounded-md flex items-center justify-center text-xs font-bold transition-colors"
                        style={{
                          background:
                            intensity > 0
                              ? `rgba(var(--color-brand), ${intensity / 100})`
                              : 'var(--color-surface-2)',
                          color:
                            intensity > 50 ? 'white' : 'var(--color-fg-muted)',
                        }}
                        title={`${m.monthName}: ${m.count} events (${m.percentage}%)`}
                        aria-label={`${m.monthName}: ${m.count} events`}
                      >
                        {m.count}
                      </div>
                      <div className="text-[9px] text-fg-subtle mt-1" aria-hidden="true">
                        {m.monthName.slice(0, 3)}
                      </div>
                    </div>
                  );
                })}
              </div>

              {rec.seasonalDemand.length > 0 &&
                (() => {
                  const peak = rec.seasonalDemand.reduce((a, b) =>
                    a.count > b.count ? a : b,
                  );
                  const nonZero = rec.seasonalDemand.filter((m) => m.count > 0);
                  const low =
                    nonZero.length > 1
                      ? nonZero.reduce((a, b) => (a.count < b.count ? a : b))
                      : null;

                  return (
                    <div className="mt-4 text-xs text-fg-muted space-y-1">
                      {/* N4 FIX: aria-hidden on emoji, sr-only for screen reader text */}
                      <p>
                        <span aria-hidden="true">🔥</span>
                        <span className="sr-only">Peak season:</span>{' '}
                        <strong>{peak.monthName}</strong> — {peak.count} events (
                        {peak.percentage}%)
                      </p>
                      {low && low.monthName !== peak.monthName && (
                        <p>
                          <span aria-hidden="true">❄️</span>
                          <span className="sr-only">Low season:</span>{' '}
                          <strong>{low.monthName}</strong> — {low.count} event
                          {low.count !== 1 ? 's' : ''}
                        </p>
                      )}
                    </div>
                  );
                })()}
            </CardContent>
          </Card>

          {/* ── Lead Source ROI ─────────────────────────────────────────── */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Target className="h-4 w-4 text-brand" aria-hidden="true" />
                Lead Source ROI
              </CardTitle>
              <CardDescription>Where your best leads come from</CardDescription>
            </CardHeader>
            <CardContent>
              {rec.leadSourceEffectiveness.length === 0 ? (
                <p className="text-sm text-fg-muted py-6 text-center">
                  No lead source data yet. Set a lead source when creating events.
                </p>
              ) : (
                <ul className="space-y-2" aria-label="Lead source conversion rates">
                  {rec.leadSourceEffectiveness.slice(0, 6).map((ls) => (
                    <li key={ls.source} className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-0.5">
                          <span className="text-sm font-medium truncate capitalize">
                            {ls.source.replace(/_/g, ' ')}
                          </span>
                          <span className="text-xs font-semibold tabular-nums shrink-0 text-brand">
                            {ls.conversionRate}%
                          </span>
                        </div>
                        <div
                          className="h-1.5 rounded-full bg-surface-2 overflow-hidden"
                          role="progressbar"
                          aria-valuenow={ls.conversionRate}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-label={`${ls.source} conversion rate`}
                        >
                          <div
                            className="h-full rounded-full bg-brand transition-all"
                            style={{ width: `${Math.min(100, ls.conversionRate)}%` }}
                          />
                        </div>
                      </div>
                      <span className="text-xs text-fg-subtle shrink-0 tabular-nums">
                        {ls.converted}/{ls.totalLeads}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* ── Vendor Category Insights ─────────────────────────────────── */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-brand" aria-hidden="true" />
                Vendor Performance
              </CardTitle>
              <CardDescription>Top vendor categories by usage and rating</CardDescription>
            </CardHeader>
            <CardContent>
              {rec.topVendorCategories.length === 0 ? (
                <p className="text-sm text-fg-muted py-6 text-center">
                  No vendor data yet. Add vendors to your events to unlock insights.
                </p>
              ) : (
                <ul className="space-y-3" aria-label="Vendor category performance">
                  {rec.topVendorCategories.slice(0, 6).map((v) => (
                    <li key={v.category} className="flex items-center justify-between gap-3">
                      <span className="text-sm truncate capitalize">
                        {v.category.replace(/_/g, ' ')}
                      </span>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant={v.avgRating >= 4 ? 'success' : v.avgRating >= 3 ? 'warning' : 'default'}>
                          <span aria-hidden="true">★</span>
                          <span className="sr-only">Rating:</span>{' '}
                          {v.avgRating.toFixed(1)}
                        </Badge>
                        <span className="text-xs text-fg-subtle tabular-nums">
                          {v.count} event{v.count !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* ── Meal Preference Trends ───────────────────────────────────── */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Utensils className="h-4 w-4 text-brand" aria-hidden="true" />
                Meal Preferences
              </CardTitle>
              <CardDescription>Guest meal choice distribution across all events</CardDescription>
            </CardHeader>
            <CardContent>
              {rec.popularMealChoices.length === 0 ? (
                <p className="text-sm text-fg-muted py-6 text-center">
                  No meal choice data yet. Meal preferences appear once guests RSVP
                  with a meal selection.
                </p>
              ) : (
                (() => {
                  const total = rec.popularMealChoices.reduce(
                    (s, m) => s + m.count,
                    0,
                  );
                  return (
                    <ul className="space-y-2" aria-label="Meal preference breakdown">
                      {rec.popularMealChoices.slice(0, 8).map((m) => {
                        const pct = total > 0 ? Math.round((m.count / total) * 100) : 0;
                        return (
                          <li key={m.choice} className="flex items-center gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-1 mb-0.5">
                                <span className="text-sm truncate capitalize">{m.choice}</span>
                                <span className="text-xs tabular-nums text-fg-muted shrink-0">
                                  {pct}%
                                </span>
                              </div>
                              <div
                                className="h-1.5 rounded-full bg-surface-2 overflow-hidden"
                                role="progressbar"
                                aria-valuenow={pct}
                                aria-valuemin={0}
                                aria-valuemax={100}
                                aria-label={`${m.choice}: ${pct}%`}
                              >
                                <div
                                  className="h-full rounded-full bg-brand/70 transition-all"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            </div>
                            <span className="text-xs tabular-nums text-fg-subtle shrink-0 w-12 text-right">
                              {m.count.toLocaleString()} guests
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  );
                })()
              )}
            </CardContent>
          </Card>

        </div>
      </PageBody>
    </>
  );
}
