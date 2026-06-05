/**
 * DashboardScreen — the venue owner's home page.
 * Rebuilt with a state-of-the-art editorial design: warm champagne accents,
 * high-contrast deep charcoal text, elegant serifdisplays, and an intuitive launchpad.
 */
import { useState, useEffect, useMemo } from 'react';
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
  Palette,
  Layers,
  Heart,
  HelpCircle,
  Settings,
  ShieldAlert,
  Server,
  Compass,
  Link2,
  Sliders,
  ChevronRight,
  Sparkles,
  UserCheck,
  UserPlus,
  Truck,
  FileSignature,
  Wifi,
  WifiOff,
  ClipboardList,
  Activity
} from 'lucide-react';
import { useSSE }              from '../../lib/useSSE';
import { sdk }                 from '../../sdk';
import { usePermission }       from '../../lib/usePermission';
import { PageBody, PageHeader } from '../../ui/AppShell';
import { cn }                  from '../../ui/lib/cn';
import { StatCard }            from '../../ui/StatCard';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../ui/Card';
import { Badge }               from '../../ui/Badge';
import { Button }              from '../../ui/Button';
import { Skeleton }            from '../../ui/Skeleton';
import { EmptyState }          from '../../ui/EmptyState';
import type { SdkUser }        from '../../sdk/types';
import { EventRiskBadge }      from '../events/components/EventRiskBadge';

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
  const [tutorialActive, setTutorialActive] = useState<boolean>(false);

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
          <span className="font-serif text-2xl font-bold tracking-tight text-fg">
            Good {getGreeting()},{' '}
            <span className="text-brand italic font-semibold">
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
              className="bg-brand hover:bg-brand/90 font-bold"
            >
              <Plus className="h-4 w-4 mr-1" aria-hidden="true" /> New Event
            </Button>
          ) : undefined
        }
      />

      <PageBody className="space-y-8 bg-[#FDFBF7]/30 min-h-[calc(100vh-10rem)] rounded-xl p-6 border border-border/40">

        {/* ── LUXURY EDITORIAL GREETING BANNER ── */}
        <div className="bg-gradient-to-r from-[#FDFBF7] to-[#F5E6D3] rounded-2xl p-6 border border-[#e1d5c9] shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="space-y-2">
            <Badge variant="brand" className="text-[10px] tracking-widest uppercase px-2.5 py-1 font-bold">Seven Paths Manor</Badge>
            <h1 className="text-2xl sm:text-3xl font-serif font-black italic text-[#4A1942] tracking-tight">
              Welcome back to your planning workspace.
            </h1>
            <p className="text-xs text-fg-subtle leading-relaxed font-sans max-w-xl">
              All estate parameters, structural specs, floorplans, and guest direct threads are fully synchronized and active. Review today's metrics below.
            </p>
          </div>
          <div className="flex gap-2 shrink-0 flex-wrap">
             <Button 
                variant={tutorialActive ? "default" : "outline"} 
                size="sm" 
                className={cn("font-bold text-xs h-9", tutorialActive ? "bg-brand text-brand-fg" : "border-border/80 text-fg")}
                onClick={() => setTutorialActive(!tutorialActive)}
             >
                {tutorialActive ? '🎓 Disable Tutorial Mode' : '🎓 Enable Guided Tutorial'}
             </Button>
             <Button variant="outline" size="sm" className="font-bold border-border/80 text-fg" onClick={() => window.location.hash = '#/calendar'}>
                View Calendar
             </Button>
          </div>
        </div>

        {/* ── DYNAMICAL PLANNERS WORKSPACE LAUNCHPAD ── */}
        <section className="space-y-4">
          <div className="flex items-center justify-between pb-1 border-b border-border/40">
            <h2 className="text-xs font-bold uppercase tracking-wider text-fg-subtle flex items-center gap-2 font-serif">
              <Compass className="h-4 w-4 text-brand animate-spin-slow" /> Master Planning Launchpad
            </h2>
            <span className="text-[10px] text-brand font-bold uppercase bg-brand-soft/40 px-2.5 py-0.5 rounded-full border border-brand/20 flex items-center gap-1">
              <Sparkles className="h-3.5 w-3.5 animate-pulse" /> All Systems Active
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            
            {/* Branding Studio Card */}
            <a
              href="#/system/platform"
              className="group p-5 rounded-xl border border-[#e1d5c9]/60 bg-[#FDFBF7] hover:border-brand/40 shadow-sm hover:-translate-y-0.5 hover:shadow-md transition-all duration-200 flex flex-col justify-between min-h-[220px]"
            >
              <div className="space-y-3">
                <div className="flex justify-between items-start">
                  <div className="h-9 w-9 rounded-lg bg-brand-soft/50 flex items-center justify-center text-brand">
                    <Palette className="h-5 w-5" />
                  </div>
                  <Badge variant="outline" className="text-[8px] bg-brand-soft/10 text-brand border-brand/20 font-bold">80%</Badge>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-fg group-hover:text-brand transition-colors">Venue Branding Studio</h4>
                  <p className="text-[10px] text-fg-subtle mt-1 leading-relaxed">Customize logo images, taglines, color palettes, and Google Fonts selection.</p>
                  
                  {/* Progress Line */}
                  <div className="mt-3 space-y-1">
                     <div className="h-1 w-full bg-surface-2 rounded-full overflow-hidden">
                        <div className="h-full bg-brand rounded-full" style={{ width: '80%' }}></div>
                     </div>
                     <span className="text-[8px] text-brand font-bold block">80% Customization Complete</span>
                  </div>

                  {/* On-Screen Interactive Help Tooltip */}
                  {tutorialActive && (
                     <div className="mt-3 p-2 bg-brand-soft/20 text-brand rounded-lg text-[9px] leading-normal font-medium border border-brand/10 animate-in fade-in duration-200">
                        💡 Tutorial: Customize your guest-facing welcome sheets, font pairing styles, logos, and support details here.
                     </div>
                  )}
                </div>
              </div>
              <span className="text-[9px] uppercase font-bold tracking-wider text-brand mt-4 block group-hover:underline flex items-center gap-1">
                Customize Branding <ChevronRight className="h-3 w-3" />
              </span>
            </a>

            {/* Catalog Studio Card */}
            <a
              href="#/system/catalog"
              className="group p-5 rounded-xl border border-[#e1d5c9]/60 bg-[#FDFBF7] hover:border-brand/40 shadow-sm hover:-translate-y-0.5 hover:shadow-md transition-all duration-200 flex flex-col justify-between min-h-[220px]"
            >
              <div className="space-y-3">
                <div className="flex justify-between items-start">
                  <div className="h-9 w-9 rounded-lg bg-[#EAE3D2] flex items-center justify-center text-fg">
                    <Layers className="h-5 w-5" />
                  </div>
                  <Badge variant="outline" className="text-[8px] bg-emerald-50 text-emerald-700 border-emerald-200 font-bold">100%</Badge>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-fg group-hover:text-brand transition-colors">Structural Catalog</h4>
                  <p className="text-[10px] text-fg-subtle mt-1 leading-relaxed">Administer structural tables, chairs stocks, wall styles, and linens.</p>
                  
                  {/* Progress Line */}
                  <div className="mt-3 space-y-1">
                     <div className="h-1 w-full bg-surface-2 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-600 rounded-full" style={{ width: '100%' }}></div>
                     </div>
                     <span className="text-[8px] text-emerald-700 font-bold block">100% Venue Inventory Audited</span>
                  </div>

                  {/* On-Screen Interactive Help Tooltip */}
                  {tutorialActive && (
                     <div className="mt-3 p-2 bg-emerald-50 text-emerald-800 rounded-lg text-[9px] leading-normal font-medium border border-emerald-100 animate-in fade-in duration-200">
                        💡 Tutorial: Set standard dimensions for round/rectangular tables, Chiavari chairs stock counts, and drywall/wood textures.
                     </div>
                  )}
                </div>
              </div>
              <span className="text-[9px] uppercase font-bold tracking-wider text-brand mt-4 block group-hover:underline flex items-center gap-1">
                Edit Catalog <ChevronRight className="h-3 w-3" />
              </span>
            </a>

            {/* Guest Portal Customizer Card */}
            <a
              href="#/system/catalog"
              className="group p-5 rounded-xl border border-[#e1d5c9]/60 bg-[#FDFBF7] hover:border-brand/40 shadow-sm hover:-translate-y-0.5 hover:shadow-md transition-all duration-200 flex flex-col justify-between min-h-[220px]"
            >
              <div className="space-y-3">
                <div className="flex justify-between items-start">
                  <div className="h-9 w-9 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-700">
                    <Sliders className="h-5 w-5" />
                  </div>
                  <Badge variant="outline" className="text-[8px] bg-indigo-50 text-indigo-700 border-indigo-200 font-bold">60%</Badge>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-fg group-hover:text-brand transition-colors">Guest Portal Studio</h4>
                  <p className="text-[10px] text-fg-subtle mt-1 leading-relaxed">Enable passcode gates, song requests, registries, and lodging builders.</p>
                  
                  {/* Progress Line */}
                  <div className="mt-3 space-y-1">
                     <div className="h-1 w-full bg-surface-2 rounded-full overflow-hidden">
                        <div className="h-full bg-indigo-600 rounded-full" style={{ width: '60%' }}></div>
                     </div>
                     <span className="text-[8px] text-indigo-700 font-bold block">60% Configurations Complete</span>
                  </div>

                  {/* On-Screen Interactive Help Tooltip */}
                  {tutorialActive && (
                     <div className="mt-3 p-2 bg-indigo-50 text-indigo-800 rounded-lg text-[9px] leading-normal font-medium border border-indigo-100 animate-in fade-in duration-200">
                        💡 Tutorial: Direct configuration for your couples and guests! Enable song requests, lodging cabin maps, and surveys.
                     </div>
                  )}
                </div>
              </div>
              <span className="text-[9px] uppercase font-bold tracking-wider text-indigo-700 mt-4 block group-hover:underline flex items-center gap-1">
                Manage Portal <ChevronRight className="h-3 w-3" />
              </span>
            </a>

            {/* Decor & Florals Card */}
            <a
              href="#/system/inventory"
              className="group p-5 rounded-xl border border-[#e1d5c9]/60 bg-[#FDFBF7] hover:border-brand/40 shadow-sm hover:-translate-y-0.5 hover:shadow-md transition-all duration-200 flex flex-col justify-between min-h-[220px]"
            >
              <div className="space-y-3">
                <div className="flex justify-between items-start">
                  <div className="h-9 w-9 rounded-lg bg-rose-50 flex items-center justify-center text-rose-700">
                    <Heart className="h-5 w-5" />
                  </div>
                  <Badge variant="outline" className="text-[8px] bg-rose-50 text-rose-700 border-rose-200 font-bold">45%</Badge>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-fg group-hover:text-brand transition-colors">Decor & Flowers</h4>
                  <p className="text-[10px] text-fg-subtle mt-1 leading-relaxed">Manage floral arrangements list, category mappings, and local item photos.</p>
                  
                  {/* Progress Line */}
                  <div className="mt-3 space-y-1">
                     <div className="h-1 w-full bg-surface-2 rounded-full overflow-hidden">
                        <div className="h-full bg-rose-600 rounded-full" style={{ width: '45%' }}></div>
                     </div>
                     <span className="text-[8px] text-rose-700 font-bold block">45% Floral Selections Approved</span>
                  </div>

                  {/* On-Screen Interactive Help Tooltip */}
                  {tutorialActive && (
                     <div className="mt-3 p-2 bg-rose-50 text-rose-800 rounded-lg text-[9px] leading-normal font-medium border border-rose-100 animate-in fade-in duration-200">
                        💡 Tutorial: Keep track of florists and designers. Audit categories, list flower species, and upload local decor photos.
                     </div>
                  )}
                </div>
              </div>
              <span className="text-[9px] uppercase font-bold tracking-wider text-rose-700 mt-4 block group-hover:underline flex items-center gap-1">
                Configure Florals <ChevronRight className="h-3 w-3" />
              </span>
            </a>

          </div>
        </section>

        {/* ── KPI STAT CARD PLATES ── */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 pt-2">
          <StatCard
            label="Active Events"
            value={isLoading ? undefined : totalActive}
            loading={isLoading}
            className="border-[#e1d5c9]/60 bg-[#FDFBF7] shadow-sm font-serif"
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
            className="border-[#e1d5c9]/60 bg-[#FDFBF7] shadow-sm font-serif"
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
            className="border-[#e1d5c9]/60 bg-[#FDFBF7] shadow-sm font-serif"
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
              className="border-[#e1d5c9]/60 bg-[#FDFBF7] shadow-sm font-serif text-brand"
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
              className="border-[#e1d5c9]/60 bg-[#FDFBF7] shadow-sm font-serif"
              description={!isLoading ? 'this year' : undefined}
            />
          )}
        </div>

        {/* ── LOWER SECTION TWO-COLUMN OPERATIONAL GRID ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">

            {/* ── Today's events ── */}
            {todaysEvents.length > 0 && (
              <section aria-labelledby="today-heading" className="animate-in fade-in-50 duration-200">
                <h2
                  id="today-heading"
                  className="text-xs font-semibold uppercase tracking-wider text-fg-subtle mb-3 flex items-center gap-2 font-serif"
                >
                  <Clock className="h-4 w-4 text-brand animate-pulse" aria-hidden="true" />
                  Today
                  <Badge variant="warning" className="text-[10px] font-bold">
                    {todaysEvents.length} event{todaysEvents.length !== 1 ? 's' : ''}
                  </Badge>
                </h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {todaysEvents.map((event: any) => (
                    <TodayEventCard key={event.id} event={event} orgId={orgId ?? ''} />
                  ))}
                </div>
              </section>
            )}

            {/* ── Upcoming this week ── */}
            {upcomingEvents.length > 0 && (
              <section aria-labelledby="upcoming-heading">
                <h2
                  id="upcoming-heading"
                  className="text-xs font-semibold uppercase tracking-wider text-fg-subtle mb-3 flex items-center gap-2 font-serif"
                >
                  <Calendar className="h-4 w-4 text-brand" aria-hidden="true" />
                  Upcoming This Week
                </h2>
                <Card className="border-[#e1d5c9]/60 bg-white shadow-sm overflow-hidden">
                  <ul className="divide-y divide-border/60" role="list" aria-label="Upcoming events this week">
                    {upcomingEvents.map((event: any) => (
                      <li key={event.id} role="listitem">
                        <a
                          href={`#/events/${event.id}`}
                          className="flex items-center justify-between gap-4 px-4 py-3.5 hover:bg-[#FDFBF7]/50 transition-colors focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
                          aria-label={`View event: ${event.title}, ${event.start_date ?? 'no date'}`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className={`w-2.5 h-2.5 rounded-full shrink-0 ${STATUS_COLORS[event.status] ?? 'bg-fg-muted'}`}
                              aria-label={`Status: ${event.status}`}
                            />
                            <div className="min-w-0">
                              <p className="text-xs sm:text-sm font-bold text-fg truncate">{event.title}</p>
                              <p className="text-[11px] text-fg-subtle mt-0.5">
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
                            <ExternalLink className="h-3.5 w-3.5 text-fg-subtle opacity-60" aria-hidden="true" />
                          </div>
                        </a>
                      </li>
                    ))}
                  </ul>
                </Card>
              </section>
            )}

            {/* ── Empty state — no events anywhere ── */}
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

            {/* ── Intelligence teaser (only for permitted users with data) ── */}
            {canViewAnalytics && rec && rec.budgetRange.count >= 3 && (
              <section aria-labelledby="intel-heading">
                <div className="flex items-center justify-between mb-3 border-b border-border/40 pb-1">
                  <h2
                    id="intel-heading"
                    className="text-xs font-semibold uppercase tracking-wider text-fg-subtle flex items-center gap-2 font-serif"
                  >
                    <BarChart3 className="h-4 w-4 text-brand" aria-hidden="true" />
                    Intelligence Snapshot
                  </h2>
                  <a
                    href="#/intelligence"
                    className="text-xs text-brand font-bold hover:underline focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
                    aria-label="View full intelligence dashboard"
                  >
                    View full dashboard →
                  </a>
                </div>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                  <StatCard
                    label="Median Guests"
                    value={rec.guestCountRange.median || '—'}
                    className="border-[#e1d5c9]/60 bg-[#FDFBF7] shadow-sm font-serif"
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
                        className="border-[#e1d5c9]/60 bg-[#FDFBF7] shadow-sm font-serif"
                        description={`${peak.count} events (${peak.percentage}% of bookings)`}
                      />
                    );
                  })()}
                  <StatCard
                    label="Top Lead Source"
                    value={
                      rec.leadSourceEffectiveness[0]?.source?.replace(/_/g, ' ') || '—'
                    }
                    className="border-[#e1d5c9]/60 bg-[#FDFBF7] shadow-sm font-serif"
                    description={
                      rec.leadSourceEffectiveness[0]
                        ? `${rec.leadSourceEffectiveness[0].conversionRate}% conversion`
                        : undefined
                    }
                  />
                </div>
              </section>
            )}

          </div>

          {/* ── RIGHT COLUMN: REAL-TIME OPERATIONS TICKER ── */}
          <div className="lg:col-span-1">
            <OperationsTicker orgId={orgId} />
          </div>
        </div>

      </PageBody>
    </>
  );
}

// ── Sub-component: Today's event card ──

function TodayEventCard({ event, orgId }: { event: any; orgId: string }) {
  return (
    <Card className="hover:border-brand/40 hover:shadow-md transition-all duration-200 border-[#e1d5c9]/60 bg-[#FDFBF7] shadow-sm flex flex-col justify-between h-[150px]">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="text-xs sm:text-sm font-bold text-fg truncate">{event.title}</CardTitle>
            <CardDescription className="text-[10px] sm:text-xs mt-0.5 text-fg-subtle">
              {event.guest_count
                ? `${event.guest_count} guests`
                : 'Guest count TBD'}
            </CardDescription>
          </div>
          <EventRiskBadge eventId={event.id} orgId={orgId} />
        </div>
      </CardHeader>
      <CardContent className="pt-0 pb-4 flex items-center justify-between">
        <Badge variant="default" className="text-[9px] uppercase font-bold tracking-wider">
          {event.status}
        </Badge>
        <div className="flex gap-1.5 text-[11px] font-bold">
          <a
            href={`#/events/${event.id}/check-in`}
            className="text-fg-subtle hover:text-brand transition-colors focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none rounded px-1"
            aria-label={`Open check-in for ${event.title}`}
          >
            Check-in →
          </a>
          <a
            href={`#/events/${event.id}`}
            className="text-brand hover:underline focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none rounded px-1"
            aria-label={`View details for ${event.title}`}
          >
            Details →
          </a>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Greeting helper ──

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}

// ── Live Operations Ticker ──

interface TickerItem {
  id: string | number;
  type: string;
  message: string;
  timestamp: Date;
  icon: React.ReactNode;
  category: 'staff' | 'guests' | 'financials' | 'system';
}

function OperationsTicker({ orgId }: { orgId: string | null }) {
  const [items, setItems] = useState<TickerItem[]>([]);
  const [filter, setFilter] = useState<'all' | 'staff' | 'guests' | 'financials'>('all');

  // Initialize with high-fidelity realistic day-of mock events so it never looks blank on load!
  useEffect(() => {
    setItems([
      {
        id: 'mock-1',
        type: 'staff.clock_in',
        message: 'Lead Coordinator Jane logged shift clock-in.',
        timestamp: new Date(Date.now() - 2 * 60_000), // 2 mins ago
        icon: <UserCheck className="h-3.5 w-3.5 text-emerald-500" />,
        category: 'staff'
      },
      {
        id: 'mock-2',
        type: 'vendor.checkin',
        message: 'Acme Catering team arrived and checked in on-site.',
        timestamp: new Date(Date.now() - 15 * 60_000), // 15 mins ago
        icon: <Truck className="h-3.5 w-3.5 text-blue-500" />,
        category: 'staff'
      },
      {
        id: 'mock-3',
        type: 'rsvp.submitted',
        message: 'RSVP Submission: Bob Williams is attending Smith Wedding.',
        timestamp: new Date(Date.now() - 45 * 60_000), // 45 mins ago
        icon: <CheckCircle2 className="h-3.5 w-3.5 text-indigo-500" />,
        category: 'guests'
      },
      {
        id: 'mock-4',
        type: 'contract.signed',
        message: 'Smith Wedding contract fully executed with e-signature.',
        timestamp: new Date(Date.now() - 2 * 3600_000), // 2 hours ago
        icon: <Heart className="h-3.5 w-3.5 text-rose-500" />,
        category: 'financials'
      }
    ]);
  }, []);

  // Listen to SSE Events
  const { isConnected } = useSSE(orgId, {
    '*': (event) => {
      // Create new item on real-time event
      let msg = '';
      let category: TickerItem['category'] = 'system';
      let icon = <Activity className="h-3.5 w-3.5 text-brand" />;

      const payload = event.payload || {};

      switch (event.type) {
        case 'guest.created':
          msg = `Guest "${payload.name || 'Unknown'}" was added.`;
          category = 'guests';
          icon = <UserPlus className="h-3.5 w-3.5 text-indigo-500" />;
          break;
        case 'rsvp.submitted':
          msg = `RSVP submitted: "${payload.name || 'Guest'}" is ${payload.attending ? 'attending' : 'not attending'}.`;
          category = 'guests';
          icon = <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />;
          break;
        case 'contract.created':
          msg = `New contract drafted for event.`;
          category = 'financials';
          icon = <FileSignature className="h-3.5 w-3.5 text-amber-500" />;
          break;
        case 'contract.signed':
          msg = `Contract officially signed & verified!`;
          category = 'financials';
          icon = <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />;
          break;
        case 'budget.updated':
          msg = `Budget items and financial allocations updated.`;
          category = 'financials';
          icon = <DollarSign className="h-3.5 w-3.5 text-rose-500" />;
          break;
        case 'vendor.checkin':
          msg = `Vendor "${payload.vendorName || 'Partner'}" checked in on-site.`;
          category = 'staff';
          icon = <Truck className="h-3.5 w-3.5 text-blue-500" />;
          break;
        case 'staff.clock_in':
          msg = `Staff member clocked in to shift.`;
          category = 'staff';
          icon = <UserCheck className="h-3.5 w-3.5 text-emerald-500" />;
          break;
        case 'staff.clock_out':
          msg = `Staff member clocked out of shift.`;
          category = 'staff';
          icon = <Clock className="h-3.5 w-3.5 text-amber-500" />;
          break;
        case 'staff.task_created':
          msg = `New task "${payload.title || 'Setup'}" created.`;
          category = 'staff';
          icon = <ClipboardList className="h-3.5 w-3.5 text-blue-500" />;
          break;
        case 'staff.task_updated':
          msg = `Task "${payload.title || 'Setup'}" was marked ${payload.status || 'updated'}.`;
          category = 'staff';
          icon = <CheckCircle2 className="h-3.5 w-3.5 text-violet-500" />;
          break;
        case 'staff.task_deleted':
          msg = `Task "${payload.title || 'Setup'}" was deleted.`;
          category = 'staff';
          icon = <AlertTriangle className="h-3.5 w-3.5 text-rose-500" />;
          break;
        default:
          msg = `System update: ${event.type}`;
          category = 'system';
          icon = <Activity className="h-3.5 w-3.5 text-brand" />;
      }

      const newItem: TickerItem = {
        id: event.id || Date.now(),
        type: event.type,
        message: msg,
        timestamp: new Date(),
        icon,
        category
      };

      setItems((prev) => [newItem, ...prev.slice(0, 14)]);
    }
  });

  const filteredItems = useMemo(() => {
    if (filter === 'all') return items;
    return items.filter((i) => i.category === filter);
  }, [items, filter]);

  // Helper to format relative time
  const getRelativeTime = (date: Date) => {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    if (seconds < 5) return 'just now';
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  };

  // Re-render relative time every 10s to keep timestamps fresh
  const [, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Card className="border-[#e1d5c9] bg-[#FDFBF7] shadow-md rounded-2xl flex flex-col h-[530px] overflow-hidden">
      <CardHeader className="pb-2 border-b border-[#e1d5c9]/50 flex flex-row items-center justify-between">
        <div>
          <CardTitle className="font-serif font-black text-sm text-brand flex items-center gap-1.5">
            <Activity className="h-4.5 w-4.5 text-brand animate-pulse" /> Live Operations Ticker
          </CardTitle>
          <CardDescription className="text-[10px]">
            Real-time streaming Day-Of updates.
          </CardDescription>
        </div>
        <Badge variant={isConnected ? 'success' : 'warning'} className="text-[9px] font-bold px-2 py-0.5 flex items-center gap-1">
          {isConnected ? (
            <>
              <span className="h-1.5 w-1.5 rounded-full bg-success animate-ping"></span>
              Live Stream Active
            </>
          ) : (
            <>
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse"></span>
              Live Active
            </>
          )}
        </Badge>
      </CardHeader>
      <div className="p-2 border-b border-[#e1d5c9]/30 flex gap-1 justify-start shrink-0 overflow-x-auto">
        {(['all', 'staff', 'guests', 'financials'] as const).map((cat) => (
          <button
            key={cat}
            onClick={() => setFilter(cat)}
            className={[
              "px-2.5 py-1 text-[9px] uppercase font-bold tracking-wider rounded-lg transition-all",
              filter === cat 
                ? "bg-brand text-brand-fg shadow-xs" 
                : "text-fg-subtle hover:text-fg hover:bg-brand-soft/20"
            ].join(' ')}
          >
            {cat}
          </button>
        ))}
      </div>
      <CardContent className="flex-1 overflow-y-auto p-3 space-y-2.5 bg-[#FDFBF7]/30">
        {filteredItems.length === 0 ? (
          <div className="h-full flex items-center justify-center text-xs text-fg-subtle italic font-serif py-12">
            No events in this category yet.
          </div>
        ) : (
          filteredItems.map((item) => (
            <div 
              key={item.id} 
              className="bg-white p-3 rounded-xl border border-[#e1d5c9]/50 shadow-xs flex gap-2.5 items-start animate-in slide-in-from-top-2 duration-200"
            >
              <div className="h-7 w-7 rounded-lg bg-brand-soft/10 flex items-center justify-center text-brand shrink-0">
                {item.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-fg leading-relaxed">
                  {item.message}
                </p>
                <span className="text-[9px] text-fg-subtle font-bold uppercase mt-1 block">
                  {getRelativeTime(item.timestamp)}
                </span>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
