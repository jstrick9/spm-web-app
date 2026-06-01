/**
 * Widget registry — Phase 19: all KPI widgets wired to real data.
 *
 * Each widget:
 *   - has a stable id ('kpi.booking-conversion')
 *   - declares which slot families it fits
 *   - has a default size class for grid layouts
 *   - has an optional schema for per-instance options
 *   - exports a component that queries real data via the SDK
 */
import type { ReactNode } from 'react';
import { z } from 'zod';
import { StatCard } from '../../ui/StatCard';
import { useQuery } from '@tanstack/react-query';
import { sdk } from '../../sdk';
import { Loader2 } from 'lucide-react';

// ─── Widget interface ────────────────────────────────────
export type WidgetSlotFamily = 'venue.dashboard' | 'event.detail' | 'couple.portal' | 'vendor.portal' | 'reports';

export interface WidgetDef<TOpts extends Record<string, unknown> = Record<string, unknown>> {
  id: string;
  name: string;
  category: 'kpi' | 'chart' | 'hero' | 'list' | 'action';
  description: string;
  fits: ReadonlyArray<WidgetSlotFamily>;
  defaultSize: 'sm' | 'md' | 'lg' | 'xl';
  optionsSchema?: z.ZodType<TOpts>;
  Component: (props: { options?: TOpts; eventId?: string; orgId?: string }) => ReactNode;
}

function LoadingWidget() {
  return <div className="p-4 flex items-center justify-center"><Loader2 className="animate-spin w-4 h-4 text-fg-muted" /></div>;
}

// ─── KPI: Booking Conversion (real data) ────────────────
const bookingConversion: WidgetDef = {
  id: 'kpi.booking-conversion',
  name: 'Booking Conversion',
  category: 'kpi',
  description: 'Lead → booked conversion rate based on real event pipeline.',
  fits: ['venue.dashboard', 'reports'],
  defaultSize: 'sm',
  optionsSchema: z.object({
    benchmarkPct: z.number().min(0).max(100).optional(),
    period: z.enum(['7d', '30d', '90d', '1y']).optional(),
  }) as never,
  Component: ({ options, orgId }) => {
    const { data, isLoading } = useQuery({
      queryKey: ['events', orgId],
      queryFn: () => sdk.events.list(orgId as string),
      enabled: !!orgId,
    });
    if (isLoading) return <LoadingWidget />;

    const events = data?.events ?? [];
    const total = events.length;
    const booked = events.filter(e =>
      e.status === 'booked' || e.status === 'planning' || e.status === 'completed'
    ).length;
    const pct = total === 0 ? 0 : Math.round((booked / total) * 100);

    return (
      <StatCard
        label="Booking conversion"
        value={total === 0 ? '—' : `${pct}%`}
        description={total > 0 ? `${booked} of ${total} events booked` : undefined}
        benchmark={{ label: 'Industry', value: `${(options as any)?.benchmarkPct ?? 22}%` }}
      />
    );
  },
};

// ─── KPI: Revenue per Event (real data) ─────────────────
const revenuePerEvent: WidgetDef = {
  id: 'kpi.revenue-per-event',
  name: 'Avg Revenue per Event',
  category: 'kpi',
  description: 'Average budget across all events with budgets set.',
  fits: ['venue.dashboard', 'reports'],
  defaultSize: 'sm',
  Component: ({ orgId }) => {
    const { data, isLoading } = useQuery({
      queryKey: ['events', orgId],
      queryFn: () => sdk.events.list(orgId as string),
      enabled: !!orgId,
    });
    if (isLoading) return <LoadingWidget />;

    const withBudget = (data?.events ?? []).filter(e => e.budget_cents != null && e.budget_cents > 0);
    const totalCents = withBudget.reduce((s, e) => s + (e.budget_cents ?? 0), 0);
    const avg = withBudget.length === 0 ? 0 : totalCents / withBudget.length;

    return (
      <StatCard
        label="Avg revenue per event"
        value={withBudget.length === 0 ? '—' : `$${(avg / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
        description={withBudget.length > 0 ? `across ${withBudget.length} events` : undefined}
      />
    );
  },
};

// ─── KPI: RSVP Velocity (real data) ─────────────────────
const rsvpVelocity: WidgetDef = {
  id: 'kpi.rsvp-velocity',
  name: 'RSVP Velocity',
  category: 'kpi',
  description: 'Total RSVPs received across all events.',
  fits: ['venue.dashboard', 'event.detail', 'reports'],
  defaultSize: 'sm',
  Component: ({ orgId }) => {
    const { data, isLoading } = useQuery({
      queryKey: ['org-guests', orgId, '', null, null, 0],
      queryFn: () => sdk.guests.listForOrg(orgId as string, { limit: 1 }),
      enabled: !!orgId,
    });
    if (isLoading) return <LoadingWidget />;

    const counts = data?.counts ?? { attending: 0, declined: 0, maybe: 0, pending: 0 };
    const responded = counts.attending + counts.declined + counts.maybe;
    const total = responded + counts.pending;

    return (
      <StatCard
        label="RSVP velocity"
        value={total === 0 ? '—' : String(responded)}
        description={total > 0 ? `${counts.pending} still pending` : 'No guests yet'}
      />
    );
  },
};

// ─── KPI: Calendar Vacancy (real data) ──────────────────
const vacancy: WidgetDef = {
  id: 'kpi.vacancy',
  name: 'Calendar Vacancy',
  category: 'kpi',
  description: 'Events in pipeline vs completed. Shows booking pipeline health.',
  fits: ['venue.dashboard', 'reports'],
  defaultSize: 'sm',
  Component: ({ orgId }) => {
    const { data, isLoading } = useQuery({
      queryKey: ['events', orgId],
      queryFn: () => sdk.events.list(orgId as string),
      enabled: !!orgId,
    });
    if (isLoading) return <LoadingWidget />;

    const counts = data?.counts ?? {};
    const leads = (counts as any).lead ?? 0;
    const holds = (counts as any).hold ?? 0;
    const active = ((counts as any).booked || 0) + ((counts as any).planning || 0);
    const pipeline = leads + holds;

    return (
      <StatCard
        label="Vacancy"
        value={pipeline === 0 && active === 0 ? '—' : String(pipeline)}
        description={pipeline > 0 ? `${leads} leads, ${holds} on hold` : `${active} active events`}
      />
    );
  },
};

// ─── KPI: Guest Count (event-level, real data) ──────────
const guestCount: WidgetDef = {
  id: 'kpi.guest-count',
  name: 'Guest Count',
  category: 'kpi',
  description: 'Total invited guests for this event.',
  fits: ['event.detail'],
  defaultSize: 'sm',
  Component: ({ eventId }) => {
    const { data, isLoading } = useQuery({
      queryKey: ['guests', eventId],
      queryFn: () => sdk.guests.list(eventId as string),
      enabled: !!eventId,
    });
    if (isLoading) return <LoadingWidget />;

    const counts = data?.counts ?? { pending: 0, attending: 0, declined: 0, maybe: 0 };
    const total = counts.pending + counts.attending + counts.declined + counts.maybe;

    return (
      <StatCard
        label="Guests invited"
        value={total === 0 ? '—' : String(total)}
        description={total > 0 ? `${counts.attending} attending · ${counts.declined} declined · ${counts.pending} pending` : undefined}
      />
    );
  },
};

// ─── KPI: RSVP Response Rate (event-level, real data) ───
const rsvpRate: WidgetDef = {
  id: 'kpi.rsvp-rate',
  name: 'RSVP Response Rate',
  category: 'kpi',
  description: 'Percentage of invited guests who have responded.',
  fits: ['event.detail'],
  defaultSize: 'sm',
  Component: ({ eventId }) => {
    const { data, isLoading } = useQuery({
      queryKey: ['guests', eventId],
      queryFn: () => sdk.guests.list(eventId as string),
      enabled: !!eventId,
    });
    if (isLoading) return <LoadingWidget />;

    const counts = data?.counts ?? { pending: 0, attending: 0, declined: 0, maybe: 0 };
    const total = counts.pending + counts.attending + counts.declined + counts.maybe;
    const responded = counts.attending + counts.declined + counts.maybe;
    const pct = total === 0 ? 0 : Math.round((responded / total) * 100);

    return (
      <StatCard
        label="RSVP response rate"
        value={total === 0 ? '—' : `${pct}%`}
        benchmark={{ label: 'Industry avg', value: '52%' }}
      />
    );
  },
};

// ─── Chart: Dietary Breakdown (real data from guests) ───
const dietaryBreakdown: WidgetDef = {
  id: 'chart.dietary-breakdown',
  name: 'Dietary Breakdown',
  category: 'chart',
  description: 'Breakdown of guest dietary requirements.',
  fits: ['event.detail'],
  defaultSize: 'md',
  Component: ({ eventId }) => {
    const { data, isLoading } = useQuery({
      queryKey: ['guests', eventId],
      queryFn: () => sdk.guests.list(eventId as string),
      enabled: !!eventId,
    });

    const guests = data?.guests ?? [];
    const buckets = new Map<string, number>();
    for (const g of guests) {
      const key = g.dietary_restrictions?.trim() || 'Standard';
      buckets.set(key, (buckets.get(key) ?? 0) + 1);
    }
    const total = guests.length || 1;
    const rows = Array.from(buckets.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);

    const colors = ['bg-chart-1', 'bg-chart-3', 'bg-chart-5', 'bg-chart-6', 'bg-chart-2', 'bg-chart-4'];

    return (
      <div className="rounded-card border border-border bg-surface p-5">
        <div className="text-xs font-medium uppercase tracking-wider text-fg-subtle">Dietary breakdown</div>
        {isLoading ? <LoadingWidget /> : (
          <div className="mt-4 space-y-2">
            {rows.map(([label, count], i) => {
              const pct = Math.round((count / total) * 100);
              return (
                <div key={label} className="flex items-center gap-3 text-sm">
                  <div className="w-24 text-fg-muted truncate">{label}</div>
                  <div className="flex-1 h-2 rounded-pill bg-surface-2 overflow-hidden">
                    <div className={`h-full ${colors[i % colors.length]}`} style={{ width: `${pct}%` }} />
                  </div>
                  <div className="w-10 text-right font-medium tabular-nums">{pct}%</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  },
};

// ─── Chart: Timeline Density ────────────────────────────
const timelineDensity: WidgetDef = {
  id: 'chart.timeline-density',
  name: 'Timeline Density',
  category: 'chart',
  description: 'How packed the event-day timeline is, hour-by-hour.',
  fits: ['event.detail'],
  defaultSize: 'md',
  Component: ({ eventId }) => {
    const { data, isLoading } = useQuery({
      queryKey: ['timeline', eventId],
      queryFn: () => sdk.timeline.list(eventId as string),
      enabled: !!eventId,
    });

    // Build hour buckets 8am-11pm
    const buckets = new Array(16).fill(0);
    for (const item of (data?.items ?? [])) {
      if (item.starts_at) {
        const hour = new Date(item.starts_at).getHours();
        const idx = Math.max(0, Math.min(15, hour - 8));
        buckets[idx]++;
      }
    }
    const maxLoad = Math.max(1, ...buckets);

    return (
      <div className="rounded-card border border-border bg-surface p-5">
        <div className="text-xs font-medium uppercase tracking-wider text-fg-subtle">Timeline density</div>
        {isLoading ? <LoadingWidget /> : (
          <div className="mt-4 grid grid-cols-16 gap-px" style={{ gridTemplateColumns: `repeat(${buckets.length}, 1fr)` }}>
            {buckets.map((load, i) => (
              <div key={i} className="flex flex-col items-center gap-1">
                <div className="h-16 w-full flex items-end">
                  <div className="w-full bg-brand rounded-sm transition-all" style={{ height: `${(load / maxLoad) * 100}%` }} />
                </div>
                <div className="text-[10px] text-fg-subtle">{8 + i}h</div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  },
};

// ─── Couple-facing widgets ──────────────────────────────
const eventCountdown: WidgetDef = {
  id: 'hero.event-countdown',
  name: 'Event Countdown',
  category: 'hero',
  description: 'Big countdown to the wedding day.',
  fits: ['couple.portal'],
  defaultSize: 'xl',
  Component: ({ eventId }) => {
    const { data } = useQuery({
      queryKey: ['event', eventId],
      queryFn: () => sdk.events.get(eventId as string),
      enabled: !!eventId,
    });
    const startDate = data?.event?.start_date;
    const days = startDate
      ? Math.max(0, Math.ceil((new Date(startDate).getTime() - Date.now()) / 86_400_000))
      : null;

    return (
      <div className="text-center py-10">
        <p className="font-display text-7xl tracking-tight">{days ?? '—'}</p>
        <p className="mt-2 text-fg-muted">{days !== null ? 'days until your wedding' : 'Date not set'}</p>
      </div>
    );
  },
};

const rsvpCta: WidgetDef = {
  id: 'hero.rsvp-cta',
  name: 'RSVP Call-to-Action',
  category: 'hero',
  description: 'Encourage guests to RSVP.',
  fits: ['couple.portal'],
  defaultSize: 'lg',
  Component: () => (
    <div className="rounded-card border border-border bg-surface p-5 text-center">
      <p className="font-display text-2xl">We can't wait to celebrate with you.</p>
      <p className="mt-2 text-fg-muted">Please RSVP by August 1.</p>
    </div>
  ),
};

// ─── KPI: Revenue Pipeline Forecast (real data) ────────
const pipelineForecast: WidgetDef = {
  id: 'kpi.pipeline-forecast',
  name: 'Revenue Forecast',
  category: 'kpi',
  description: 'Weighted pipeline value based on event status probability.',
  fits: ['venue.dashboard', 'reports'],
  defaultSize: 'sm',
  Component: ({ orgId }) => {
    const { data, isLoading } = useQuery({
      queryKey: ['events', orgId],
      queryFn: () => sdk.events.list(orgId as string),
      enabled: !!orgId,
    });
    if (isLoading) return <LoadingWidget />;

    const events = data?.events ?? [];
    const weights: Record<string, number> = {
      lead: 0.10, hold: 0.40, booked: 0.90, planning: 0.95, completed: 1.0,
    };

    let weighted = 0;
    let confirmed = 0;
    for (const e of events) {
      const w = weights[e.status] ?? 0;
      const val = (e.budget_cents ?? 0) / 100;
      weighted += val * w;
      if (e.status === 'booked' || e.status === 'planning') confirmed += val;
    }

    return (
      <StatCard
        label="Pipeline forecast"
        value={weighted > 0 ? `$${Math.round(weighted).toLocaleString()}` : '—'}
        description={confirmed > 0 ? `$${Math.round(confirmed).toLocaleString()} confirmed` : 'No events in pipeline'}
      />
    );
  },
};

// ─── Registry ───────────────────────────────────────────
export const WIDGET_REGISTRY: ReadonlyArray<WidgetDef> = [
  bookingConversion, revenuePerEvent, rsvpVelocity, vacancy, pipelineForecast,
  guestCount, rsvpRate, dietaryBreakdown, timelineDensity,
  eventCountdown, rsvpCta,
];

export function getWidget(id: string): WidgetDef | undefined {
  return WIDGET_REGISTRY.find((w) => w.id === id);
}

export function widgetsForSlot(slotId: string): WidgetDef[] {
  const family = slotId.split('.').slice(0, 2).join('.') as WidgetSlotFamily;
  return WIDGET_REGISTRY.filter((w) => w.fits.includes(family));
}
