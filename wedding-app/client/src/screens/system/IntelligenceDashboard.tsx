/**
 * IntelligenceDashboard — the "intelligence" surface of the platform.
 *
 * Shows data-driven insights:
 *   - Seasonal demand heatmap
 *   - Budget/guest benchmarks from historical data
 *   - Lead source effectiveness
 *   - Vendor category insights
 *   - Meal preference trends
 */
import { useQuery } from '@tanstack/react-query';
import { Brain, TrendingUp, Calendar, Users, DollarSign, Utensils, BarChart3, Target } from 'lucide-react';
import { sdk } from '../../sdk';
import type { EventRecommendations } from '../../sdk/intelligence';
import { PageBody, PageHeader } from '../../ui/AppShell';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../ui/Card';
import { Badge } from '../../ui/Badge';
import { StatCard } from '../../ui/StatCard';
import { Skeleton } from '../../ui/Skeleton';

interface Props { orgId: string }

export function IntelligenceDashboard({ orgId }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ['recommendations', orgId],
    queryFn: () => sdk.recommendations.get(orgId),
    staleTime: 5 * 60_000,
  });

  if (isLoading) return <><PageHeader title="Intelligence" /><PageBody><Skeleton className="h-96" /></PageBody></>;

  const rec = data?.recommendations;
  if (!rec) return <><PageHeader title="Intelligence" /><PageBody><p className="text-fg-muted">No data yet.</p></PageBody></>;

  const fmt = (cents: number) => `$${(cents / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

  return (
    <>
      <PageHeader
        title={<span className="flex items-center gap-2"><Brain className="h-6 w-6 text-brand" /> Intelligence</span>}
        description="Data-driven insights from your historical event data."
      />
      <PageBody className="space-y-6">
        {/* Budget & Guest Benchmarks */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Median Budget" value={rec.budgetRange.count > 0 ? fmt(rec.budgetRange.median) : '—'} description={rec.budgetRange.count > 0 ? `${fmt(rec.budgetRange.p25)} – ${fmt(rec.budgetRange.p75)} range` : undefined} />
          <StatCard label="Median Guests" value={rec.guestCountRange.median || '—'} description={rec.guestCountRange.p25 ? `${rec.guestCountRange.p25} – ${rec.guestCountRange.p75} range` : undefined} />
          <StatCard label="Avg Timeline Items" value={rec.avgTimelineItems || '—'} description="per event" />
          <StatCard label="Events Analyzed" value={rec.budgetRange.count} description="with budget data" />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Seasonal Demand Heatmap */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><Calendar className="h-4 w-4 text-brand" /> Seasonal Demand</CardTitle>
              <CardDescription>Which months book the most events</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-6 sm:grid-cols-12 gap-1">
                {rec.seasonalDemand.map(m => {
                  const intensity = m.percentage > 0 ? Math.min(100, m.percentage * 3) : 0;
                  return (
                    <div key={m.month} className="text-center">
                      <div
                        className="aspect-square rounded-md flex items-center justify-center text-xs font-bold transition-colors"
                        style={{
                          background: intensity > 0 ? `rgba(var(--color-brand), ${intensity / 100})` : 'var(--color-surface-2)',
                          color: intensity > 50 ? 'white' : 'var(--color-fg-muted)',
                        }}
                        title={`${m.monthName}: ${m.count} events (${m.percentage}%)`}
                      >
                        {m.count}
                      </div>
                      <div className="text-[9px] text-fg-subtle mt-1">{m.monthName}</div>
                    </div>
                  );
                })}
              </div>
              {rec.seasonalDemand.length > 0 && (() => {
                const peak = rec.seasonalDemand.reduce((a, b) => a.count > b.count ? a : b);
                const low = rec.seasonalDemand.reduce((a, b) => a.count < b.count && a.count > 0 ? a : b);
                return (
                  <div className="mt-4 text-xs text-fg-muted space-y-1">
                    <p>🔥 Peak season: <strong>{peak.monthName}</strong> ({peak.count} events, {peak.percentage}%)</p>
                    {low.count > 0 && <p>❄️ Low season: <strong>{low.monthName}</strong> ({low.count} events)</p>}
                  </div>
                );
              })()}
            </CardContent>
          </Card>

          {/* Lead Source Effectiveness */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><Target className="h-4 w-4 text-brand" /> Lead Source ROI</CardTitle>
              <CardDescription>Where your best leads come from</CardDescription>
            </CardHeader>
            <CardContent>
              {rec.leadSourceEffectiveness.length === 0 ? (
                <p className="text-sm text-fg-muted text-center py-6">No lead source data yet. Add lead sources to events to see conversion analytics.</p>
              ) : (
                <div className="space-y-3">
                  {rec.leadSourceEffectiveness.map(ls => (
                    <div key={ls.source} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium capitalize">{ls.source.replace(/_/g, ' ')}</span>
                        <span className="tabular-nums">{ls.conversionRate}% conversion</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 rounded-full bg-surface-2 overflow-hidden">
                          <div className="h-full bg-brand rounded-full" style={{ width: `${ls.conversionRate}%` }} />
                        </div>
                        <span className="text-[10px] text-fg-subtle tabular-nums">{ls.converted}/{ls.totalLeads}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Top Vendor Categories */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><TrendingUp className="h-4 w-4 text-brand" /> Vendor Insights</CardTitle>
              <CardDescription>Most frequently booked categories</CardDescription>
            </CardHeader>
            <CardContent>
              {rec.topVendorCategories.length === 0 ? (
                <p className="text-sm text-fg-muted text-center py-6">Add vendors to events to see category trends.</p>
              ) : (
                <div className="space-y-2">
                  {rec.topVendorCategories.map((v, i) => (
                    <div key={v.category} className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{['🎵','🌸','📸','🍰','🏠','🎉','💐','🎤','🍷','✨'][i] || '📋'}</span>
                        <span className="text-sm font-medium capitalize">{v.category.replace(/_/g, ' ')}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        {v.avgRating > 0 && (
                          <span className="text-xs text-fg-muted">★ {v.avgRating}</span>
                        )}
                        <Badge variant="default" className="text-[10px]">{v.count} bookings</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Meal Preference Trends */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><Utensils className="h-4 w-4 text-brand" /> Meal Trends</CardTitle>
              <CardDescription>Most popular choices across all events</CardDescription>
            </CardHeader>
            <CardContent>
              {rec.popularMealChoices.length === 0 ? (
                <p className="text-sm text-fg-muted text-center py-6">RSVPs with meal choices will appear here.</p>
              ) : (
                <div className="space-y-2">
                  {rec.popularMealChoices.map(m => (
                    <div key={m.choice} className="flex items-center justify-between text-sm">
                      <span className="capitalize">{m.choice}</span>
                      <span className="font-medium tabular-nums">{m.count} guests</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Data-Driven Recommendations */}
        {rec.budgetRange.count >= 3 && (
          <Card className="border-brand/20 bg-brand/5">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><Brain className="h-4 w-4 text-brand" /> Recommendations for New Events</CardTitle>
              <CardDescription>Based on {rec.budgetRange.count} historical events at your venue</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p>📊 <strong>Budget suggestion:</strong> Most events at your venue budget between {fmt(rec.budgetRange.p25)} and {fmt(rec.budgetRange.p75)}, with a median of {fmt(rec.budgetRange.median)}.</p>
              <p>👥 <strong>Guest count:</strong> Typical events have {rec.guestCountRange.p25}–{rec.guestCountRange.p75} guests (median {rec.guestCountRange.median}).</p>
              {rec.topVendorCategories.length > 0 && (
                <p>🏆 <strong>Top vendors:</strong> Your most-booked categories are {rec.topVendorCategories.slice(0, 3).map(v => v.category).join(', ')}.</p>
              )}
              <p>📋 <strong>Timeline:</strong> Successful events average {rec.avgTimelineItems} timeline items.</p>
              {rec.seasonalDemand.length > 0 && (() => {
                const peak = rec.seasonalDemand.reduce((a, b) => a.count > b.count ? a : b);
                return peak.count > 0 ? <p>📅 <strong>Peak season:</strong> {peak.monthName} is your busiest month ({peak.percentage}% of bookings). Consider premium pricing.</p> : null;
              })()}
            </CardContent>
          </Card>
        )}
      </PageBody>
    </>
  );
}
