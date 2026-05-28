/**
 * Widget registry. The owner-side Widget Studio reads from here to show
 * "available widgets" and writes the chosen IDs back to the config.
 *
 * Each widget:
 *   - has a stable id ('kpi.booking-conversion')
 *   - declares which slot families it fits (so admins can't put a
 *     "couple portal hero" widget into a venue KPI dashboard)
 *   - has a default size class for grid layouts
 *   - has an optional schema for per-instance options (thresholds, etc.)
 *   - exports a component the WidgetSlot renderer mounts
 *
 * Adding a widget is one entry below; everything else updates automatically.
 */
import type { ReactNode } from 'react';
import { z } from 'zod';
import { StatCard } from '../../ui/StatCard';
import { Sparkline } from '../../ui/Sparkline';

// ─── Widget interface ────────────────────────────────────
export type WidgetSlotFamily = 'venue.dashboard' | 'event.detail' | 'couple.portal' | 'vendor.portal' | 'reports';

export interface WidgetDef<TOpts extends Record<string, unknown> = Record<string, unknown>> {
  id: string;
  name: string;
  category: 'kpi' | 'chart' | 'hero' | 'list' | 'action';
  description: string;
  /** Which slot families allow this widget. */
  fits: ReadonlyArray<WidgetSlotFamily>;
  /** Default grid size when placed; the slot may override. */
  defaultSize: 'sm' | 'md' | 'lg' | 'xl';
  /** Optional zod schema for per-instance options. */
  optionsSchema?: z.ZodType<TOpts>;
  /** Component to render. Receives `options` and ambient hooks (event id, org id) via props. */
  Component: (props: { options?: TOpts; eventId?: string; orgId?: string }) => ReactNode;
}

// ─── Sample widgets (real data wiring lands Day 5+) ─────
// These all use placeholder data right now. Days 5-7 swap in
// queries against the real SDK. The interfaces stay the same.


import { useQuery } from '@tanstack/react-query';
import { sdk } from '../../sdk';
import { Loader2 } from 'lucide-react';

const bookingConversion: WidgetDef = {
  id: 'kpi.booking-conversion',
  name: 'Booking Conversion',
  category: 'kpi',
  description: 'Tours → booked events conversion rate.',
  fits: ['venue.dashboard', 'reports'],
  defaultSize: 'sm',
  optionsSchema: z.object({
    benchmarkPct: z.number().min(0).max(100).optional(),
    period: z.enum(['7d', '30d', '90d', '1y']).optional(),
  }) as never,
  Component: ({ options, orgId }) => {
    // In a real app this would call an aggregation endpoint
    // For Phase 7 we will just use dummy data, or calculate from org events list
    const { data, isLoading } = useQuery({
      queryKey: ['events', orgId],
      queryFn: () => sdk.events.list(orgId as string),
      enabled: !!orgId,
    });
    
    if (isLoading) return <div className="p-4"><Loader2 className="animate-spin w-4 h-4 text-fg-muted" /></div>;

    const total = data?.events.length || 0;
    const booked = data?.events.filter(e => e.status === 'booked' || e.status === 'planning' || e.status === 'completed').length || 0;
    const pct = total === 0 ? 0 : Math.round((booked / total) * 100);

    return (
      <StatCard
        label="Booking conversion"
        value={total === 0 ? '—' : `${pct}%`}
        benchmark={{ label: 'Industry', value: `${(options as { benchmarkPct?: number })?.benchmarkPct ?? 22}%` }}
      />
    );
  },
};

const revenuePerEvent: WidgetDef = {
  id: 'kpi.revenue-per-event',
  name: 'Avg Revenue per Event',
  category: 'kpi',
  description: 'Average booked event value over the selected period.',
  fits: ['venue.dashboard', 'reports'],
  defaultSize: 'sm',
  Component: ({ orgId }) => {
    const { data, isLoading } = useQuery({
      queryKey: ['events', orgId],
      queryFn: () => sdk.events.list(orgId as string),
      enabled: !!orgId,
    });
    
    if (isLoading) return <div className="p-4"><Loader2 className="animate-spin w-4 h-4 text-fg-muted" /></div>;

    const withBudget = data?.events.filter(e => e.budget_cents !== null && e.budget_cents > 0) || [];
    const totalRevenueCents = withBudget.reduce((sum, e) => sum + (e.budget_cents || 0), 0);
    const avg = withBudget.length === 0 ? 0 : totalRevenueCents / withBudget.length;

    return (
      <StatCard
        label="Avg revenue per event"
        value={withBudget.length === 0 ? '—' : `${(avg / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
      />
    );
  },
};

const rsvpVelocity: WidgetDef = {

  id: 'kpi.rsvp-velocity',
  name: 'RSVP Velocity',
  category: 'kpi',
  description: 'RSVP responses received per week.',
  fits: ['venue.dashboard', 'event.detail', 'reports'],
  defaultSize: 'sm',
  Component: () => (
    <StatCard
      label="RSVP velocity"
      value="42"
      description="responses this week"
      trend={{ value: 18, direction: 'up' }}
    />
  ),
};

const vacancy: WidgetDef = {
  id: 'kpi.vacancy',
  name: 'Calendar Vacancy',
  category: 'kpi',
  description: 'Unbooked weekends in the next 90 days.',
  fits: ['venue.dashboard', 'reports'],
  defaultSize: 'sm',
  Component: () => (
    <StatCard
      label="Vacancy"
      value="3"
      description="weekends in next 90d"
      trend={{ value: 50, direction: 'down', isGood: true }}
      benchmark={{ label: 'Comp set', value: '7' }}
    />
  ),
};

const guestCount: WidgetDef = {
  id: 'kpi.guest-count',
  name: 'Guest Count',
  category: 'kpi',
  description: 'Total invited guests for this event.',
  fits: ['event.detail'],
  defaultSize: 'sm',
  Component: () => <StatCard label="Guests invited" value="124" description="68 attending · 12 declined · 44 pending" />,
};

const rsvpRate: WidgetDef = {
  id: 'kpi.rsvp-rate',
  name: 'RSVP Response Rate',
  category: 'kpi',
  description: 'Percentage of invited guests who have responded.',
  fits: ['event.detail'],
  defaultSize: 'sm',
  Component: () => (
    <StatCard
      label="RSVP response rate"
      value="65%"
      trend={{ value: 12, direction: 'up' }}
      benchmark={{ label: 'Industry avg at this stage', value: '52%' }}
    />
  ),
};

const dietaryBreakdown: WidgetDef = {
  id: 'chart.dietary-breakdown',
  name: 'Dietary Breakdown',
  category: 'chart',
  description: 'Pie chart of meal/dietary preferences.',
  fits: ['event.detail'],
  defaultSize: 'md',
  Component: () => (
    <div className="rounded-card border border-border bg-surface p-5">
      <div className="text-xs font-medium uppercase tracking-wider text-fg-subtle">Dietary breakdown</div>
      <div className="mt-4 space-y-2">
        {[
          { label: 'Standard',    pct: 58, color: 'bg-chart-1' },
          { label: 'Vegetarian',  pct: 22, color: 'bg-chart-3' },
          { label: 'Vegan',       pct: 12, color: 'bg-chart-5' },
          { label: 'Gluten-free', pct:  8, color: 'bg-chart-6' },
        ].map((row) => (
          <div key={row.label} className="flex items-center gap-3 text-sm">
            <div className="w-24 text-fg-muted">{row.label}</div>
            <div className="flex-1 h-2 rounded-pill bg-surface-2 overflow-hidden">
              <div className={`h-full ${row.color}`} style={{ width: `${row.pct}%` }} />
            </div>
            <div className="w-10 text-right font-medium tabular-nums">{row.pct}%</div>
          </div>
        ))}
      </div>
    </div>
  ),
};

const timelineDensity: WidgetDef = {
  id: 'chart.timeline-density',
  name: 'Timeline Density',
  category: 'chart',
  description: 'How packed the event-day timeline is, hour-by-hour.',
  fits: ['event.detail'],
  defaultSize: 'md',
  Component: () => (
    <div className="rounded-card border border-border bg-surface p-5">
      <div className="text-xs font-medium uppercase tracking-wider text-fg-subtle">Timeline density</div>
      <div className="mt-4 grid grid-cols-12 gap-1">
        {[2, 1, 1, 4, 3, 6, 8, 5, 3, 2, 1, 0].map((load, i) => (
          <div key={i} className="flex flex-col items-center gap-1">
            <div className="h-16 w-full flex items-end">
              <div className="w-full bg-brand rounded-sm" style={{ height: `${load * 10}%` }} />
            </div>
            <div className="text-[10px] text-fg-subtle">{12 + i}h</div>
          </div>
        ))}
      </div>
    </div>
  ),
};

// ─── Couple-facing widgets ──────────────────────────────
const eventCountdown: WidgetDef = {
  id: 'hero.event-countdown',
  name: 'Event Countdown',
  category: 'hero',
  description: 'Big countdown to the wedding day.',
  fits: ['couple.portal'],
  defaultSize: 'xl',
  Component: () => (
    <div className="text-center py-10">
      <p className="font-display text-7xl tracking-tight">142</p>
      <p className="mt-2 text-fg-muted">days until your wedding</p>
    </div>
  ),
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

// ─── Registry ───────────────────────────────────────────
export const WIDGET_REGISTRY: ReadonlyArray<WidgetDef> = [
  bookingConversion, revenuePerEvent, rsvpVelocity, vacancy,
  guestCount, rsvpRate, dietaryBreakdown, timelineDensity,
  eventCountdown, rsvpCta,
];

export function getWidget(id: string): WidgetDef | undefined {
  return WIDGET_REGISTRY.find((w) => w.id === id);
}

/** Filter the registry to widgets that fit a given slot family. */
export function widgetsForSlot(slotId: string): WidgetDef[] {
  const family = slotId.split('.').slice(0, 2).join('.') as WidgetSlotFamily;
  return WIDGET_REGISTRY.filter((w) => w.fits.includes(family));
}
