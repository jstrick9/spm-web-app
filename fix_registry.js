const fs = require('fs');
const path = 'spm-web-app/wedding-app/client/src/config/widgets/registry.tsx';
let code = fs.readFileSync(path, 'utf8');

const replacement = `
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
        value={total === 0 ? '—' : \`\${pct}%\`}
        benchmark={{ label: 'Industry', value: \`\${(options as { benchmarkPct?: number })?.benchmarkPct ?? 22}%\` }}
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
        value={withBudget.length === 0 ? '—' : \`$\${(avg / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}\`}
      />
    );
  },
};

const rsvpVelocity: WidgetDef = {
`;

code = code.replace(/const bookingConversion: WidgetDef = \{[\s\S]*?const rsvpVelocity: WidgetDef = \{/, replacement);

fs.writeFileSync(path, code);
