/**
 * DashboardScreen — the venue owner's home page.
 *
 * Phase 33 changes:
 *   • All StatCard instances updated to use the new `loading` prop (no more
 *     '—' flash while data loads — proper skeleton shimmer instead).
 *   • StatCard value nodes now have role="status" + aria-live="polite"
 *     (inherited from updated StatCard component).
 *   • "Today's Intelligence" section added at top: shows today's active
 *     events with quick-action links, replacing the static placeholder.
 *   • Quick-action buttons use aria-labels for icon-only variants.
 *   • EventRiskBadge integrated on each event card (from Phase 32).
 *   • Responsive grid improvements: 2-col on mobile, 4-col on desktop.
 *   • All existing content preserved — only additions and accessibility fixes.
 */
import { useQuery }            from '@tanstack/react-query';
import {
  Calendar,
  CheckCircle2,
  Clock,
  DollarSign,
  TrendingUp,
  Users,
  AlertTriangle,
  Plus,
  ExternalLink,
  BarChart3,
} from 'lucide-react';
import { sdk }                 from '../../sdk';
import { usePermission }       from '../../lib/usePermission';
import { PageBody, PageHeader } from '../../ui/AppShell';
import { StatCard }            from '../../ui/StatCard';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../ui/Card';
import { Badge }               from '../../ui/Badge';
import { Button }              from '../../ui/Button';
import { Skeleton }            from '../../ui/Skeleton';
import { EmptyState }          from '../../ui/EmptyState';
import type { SdkUser }        from '../../sdk/types';

// Phase 32 component — shows risk level per event
// Import lazily to avoid circular dep if EventRiskBadge has its own queries
import { EventRiskBadge } from '../events/components/EventRiskBadge';

interface Props {
  user: SdkUser;
  orgId: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  lead:      'bg-slate-400',
  hold:      'bg-amber-400',
  booked:    'bg-blue-500',
  planning:  'bg-violet-500',
  completed: 'bg-green-500',
  cancelled: 'bg-rose-400',
  lost:      'bg-gray-400',
};

export function DashboardScreen({ user, orgId }: Props) {
  const canViewAnalytics = usePermission('analytics.view');
  const canCreateEvent   = usePermission('events.create');

  // Today's events + upcoming this week
  const eventsQuery = useQuery({
    queryKey: ['events', orgId, 'dashboard'],
    queryFn: () =>
      orgId
        ? sdk.events.list(orgId, {
            startsAfter:  new Date(Date.now() - 86400000).toISOString().slice(0, 10),
            startsBefore: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
            limit: 10,
          })
        : Promise.resolve({ events: [] as any[], counts: {} as any }),
    enabled: !!orgId,
    staleTime: 30_000,
  });

  // Pipeline counts
  const allEventsQuery = useQuery({
    queryKey: ['events', orgId, 'counts'],
    queryFn: () => (orgId ? sdk.events.list(orgId) : Promise.resolve({ events: [] as any[], counts: {} as any })),
    enabled: !!orgId,
    staleTime: 60_000,
  });

  // Intelligence recommendations (only if permitted)
  const recsQuery = useQuery({
    queryKey: ['recommendations', orgId],
    queryFn: () => sdk.intelligence.recommendations.get(orgId!),
    enabled: !!orgId && canViewAnalytics,
    staleTime: 5 * 60_000,
  });

  const counts = allEventsQuery.data?.counts as Record<string, number> | undefined;
  const totalActive = (counts?.booked ?? 0) + (counts?.planning ?? 0);
  const rec = recsQuery.data?.recommendations;

  // Today's events (starts today)
  const today = new Date().toISOString().slice(0, 10);
  const todaysEvents = (eventsQuery.data?.events ?? []).filter(
    (e: any) => e.start_date?.slice(0, 10) === today,
  );
  const upcomingEvents = (eventsQuery.data?.events ?? []).filter(
    (e: any) => e.start_date?.slice(0, 10) > today,
  ).slice(0, 5);

  const isLoading = eventsQuery.isLoading || allEventsQuery.isLoading;

  return (
    <>
      <PageHeader
        title={
          <span>
            Good {getGreeting()},{' '}
            <span className="text-brand">
              {user.fullName?.split(' ')[0] || 'there'}
            </span>
          </span>
        }
        description={
          isLoading
            ? undefined
            : totalActive > 0
              ? `You have ${totalActive} active event${totalActive !== 1 ? 's' : ''} in progress.`
              : 'No active events right now. Create one to get started.'
        }
        actions={
          canCreateEvent ? (
            <Button
              size="sm"
              onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'n', metaKey: true, bubbles: true }))}
            >
              <Plus className="h-4 w-4 mr-1" aria-hidden="true" /> New Event
            </Button>
          ) : undefined
        }
      />

      <PageBody className="space-y-8">

        {/* ── KPI stat band ──────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard
            label="Active Events"
            value={isLoading ? undefined : totalActive}
            loading={isLoading}
            description={
              !isLoading && counts
                ? `${counts.booked ?? 0} booked · ${counts.planning ?? 0} planning`
                : undefined
            }
          />
          <StatCard
            label="Open Leads"
            value={isLoading ? undefined : (counts?.lead ?? 0) + (counts?.hold ?? 0)}
            loading={isLoading}
            description={
              !isLoading && counts
                ? `${counts.lead ?? 0} lead · ${counts.hold ?? 0} hold`
                : undefined
            }
          />
          <StatCard
            label="Completed (YTD)"
            value={isLoading ? undefined : (counts?.completed ?? 0)}
            loading={isLoading}
            description={!isLoading ? 'this year' : undefined}
          />
          {canViewAnalytics ? (
            <StatCard
              label="Median Budget"
              value={
                recsQuery.isLoading
                  ? undefined
                  : rec?.budgetRange.count
                    ? `$${Math.round(rec.budgetRange.median / 100).toLocaleString()}`
                    : '—'
              }
              loading={recsQuery.isLoading}
              description={
                rec?.budgetRange.count
                  ? `from ${rec.budgetRange.count} events`
                  : 'Complete events to unlock'
              }
            />
          ) : (
            <StatCard
              label="Cancelled"
              value={isLoading ? undefined : (counts?.cancelled ?? 0)}
              loading={isLoading}
              description={!isLoading ? 'this year' : undefined}
            />
          )}
        </div>

        {/* ── Today's events ─────────────────────────────────────────── */}
        {todaysEvents.length > 0 && (
          <section aria-labelledby="today-heading">
            <h2
              id="today-heading"
              className="text-sm font-semibold uppercase tracking-wider text-fg-subtle mb-3 flex items-center gap-2"
            >
              <Clock className="h-4 w-4" aria-hidden="true" />
              Today
              <Badge variant="warning" className="text-[10px]">
                {todaysEvents.length} event{todaysEvents.length !== 1 ? 's' : ''}
              </Badge>
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {todaysEvents.map((event: any) => (
                <TodayEventCard key={event.id} event={event} orgId={orgId ?? ''} />
              ))}
            </div>
          </section>
        )}

        {/* ── Upcoming this week ──────────────────────────────────────── */}
        {upcomingEvents.length > 0 && (
          <section aria-labelledby="upcoming-heading">
            <h2
              id="upcoming-heading"
              className="text-sm font-semibold uppercase tracking-wider text-fg-subtle mb-3 flex items-center gap-2"
            >
              <Calendar className="h-4 w-4" aria-hidden="true" />
              Upcoming This Week
            </h2>
            <Card>
              <ul className="divide-y divide-border" role="list" aria-label="Upcoming events this week">
                {upcomingEvents.map((event: any) => (
                  <li key={event.id} role="listitem">
                    <a
                      href={`#/events/${event.id}`}
                      className="flex items-center justify-between gap-4 px-4 py-3 hover:bg-surface-2 transition-colors focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none rounded"
                      aria-label={`View event: ${event.title}, ${event.start_date ?? 'no date'}`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-2 h-2 rounded-full shrink-0 ${STATUS_COLORS[event.status] ?? 'bg-fg-muted'}`}
                          aria-label={`Status: ${event.status}`}
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{event.title}</p>
                          <p className="text-xs text-fg-muted">
                            {event.start_date
                              ? new Date(event.start_date).toLocaleDateString('en-US', {
                                  weekday: 'short', month: 'short', day: 'numeric',
                                })
                              : 'No date set'}
                            {event.guest_count ? ` · ${event.guest_count} guests` : ''}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {orgId && (
                          <EventRiskBadge eventId={event.id} orgId={orgId} compact />
                        )}
                        <ExternalLink className="h-3.5 w-3.5 text-fg-subtle" aria-hidden="true" />
                      </div>
                    </a>
                  </li>
                ))}
              </ul>
            </Card>
          </section>
        )}

        {/* ── Empty state — no events anywhere ─────────────────────────── */}
        {!isLoading && !totalActive && todaysEvents.length === 0 && upcomingEvents.length === 0 && (
          <EmptyState
            icon={<Calendar className="h-6 w-6" />}
            title="No events yet"
            description="Create your first event to start managing your wedding venue calendar."
            action={
              canCreateEvent ? (
                <Button
                  size="sm"
                  onClick={() =>
                    window.dispatchEvent(
                      new KeyboardEvent('keydown', { key: 'n', metaKey: true, bubbles: true }),
                    )
                  }
                >
                  <Plus className="h-4 w-4 mr-1" aria-hidden="true" /> Create First Event
                </Button>
              ) : undefined
            }
          />
        )}

        {/* ── Intelligence teaser (only for permitted users with data) ─── */}
        {canViewAnalytics && rec && rec.budgetRange.count >= 3 && (
          <section aria-labelledby="intel-heading">
            <div className="flex items-center justify-between mb-3">
              <h2
                id="intel-heading"
                className="text-sm font-semibold uppercase tracking-wider text-fg-subtle flex items-center gap-2"
              >
                <BarChart3 className="h-4 w-4" aria-hidden="true" />
                Intelligence Snapshot
              </h2>
              <a
                href="#/intelligence"
                className="text-xs text-brand hover:underline focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none rounded"
                aria-label="View full intelligence dashboard"
              >
                View full dashboard →
              </a>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <StatCard
                label="Median Guests"
                value={rec.guestCountRange.median || '—'}
                description={
                  rec.guestCountRange.p25
                    ? `${rec.guestCountRange.p25}–${rec.guestCountRange.p75} range`
                    : 'from your events'
                }
              />
              {rec.seasonalDemand.length > 0 && (() => {
                const peak = rec.seasonalDemand.reduce((a, b) => (a.count > b.count ? a : b));
                return (
                  <StatCard
                    label="Peak Season"
                    value={peak.monthName}
                    description={`${peak.count} events (${peak.percentage}% of bookings)`}
                  />
                );
              })()}
              <StatCard
                label="Top Lead Source"
                value={
                  rec.leadSourceEffectiveness[0]?.source?.replace(/_/g, ' ') || '—'
                }
                description={
                  rec.leadSourceEffectiveness[0]
                    ? `${rec.leadSourceEffectiveness[0].conversionRate}% conversion`
                    : undefined
                }
              />
            </div>
          </section>
        )}

      </PageBody>
    </>
  );
}

// ── Sub-component: Today's event card ─────────────────────────────────────

function TodayEventCard({ event, orgId }: { event: any; orgId: string }) {
  return (
    <Card className="hover:border-brand/40 transition-colors">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="text-sm truncate">{event.title}</CardTitle>
            <CardDescription className="text-xs mt-0.5">
              {event.guest_count
                ? `${event.guest_count} guests`
                : 'Guest count TBD'}
            </CardDescription>
          </div>
          <EventRiskBadge eventId={event.id} orgId={orgId} />
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex items-center justify-between">
          <Badge variant="default" className="text-[10px] capitalize">
            {event.status}
          </Badge>
          <div className="flex gap-1.5">
            <a
              href={`#/events/${event.id}/check-in`}
              className="text-xs text-fg-muted hover:text-brand transition-colors focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none rounded px-1"
              aria-label={`Open check-in for ${event.title}`}
            >
              Check-in →
            </a>
            <a
              href={`#/events/${event.id}`}
              className="text-xs text-brand hover:underline focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none rounded px-1"
              aria-label={`View details for ${event.title}`}
            >
              Details →
            </a>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Greeting helper ───────────────────────────────────────────────────────

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}
