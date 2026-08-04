/**
 * TodayView — "What needs my attention right now?"
 *
 * Shows:
 *   1. Events happening today (if any)
 *   2. This week's event schedule (7-day strip)
 *   3. Action items requiring attention (overdue RSVPs, unsigned contracts, unpaid vendors)
 */
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Calendar, CheckCircle2, Clock, DollarSign, FileSignature, Users } from 'lucide-react';
import { sdk } from '../../sdk';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/Card';
import { Badge } from '../../ui/Badge';
import { Button } from '../../ui/Button';
import { Skeleton } from '../../ui/Skeleton';

interface Props { orgId: string }

/**
 * MODULE-05 ST-16: events are stored as venue-local 'YYYY-MM-DD' dates, so
 * "today"/week keys must come from LOCAL date components — toISOString()
 * (UTC) mislabels events for non-UTC venues in the evening hours.
 */
export function localDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function TodayView({ orgId }: Props) {
  const eventsQ = useQuery({
    queryKey: ['events', orgId],
    queryFn: () => sdk.events.list(orgId),
    staleTime: 30_000,
  });

  const vendorsQ = useQuery({
    queryKey: ['vendors', orgId],
    queryFn: () => sdk.vendors.list(orgId),
    staleTime: 60_000,
  });

  const events = eventsQ.data?.events ?? [];
  const vendors = vendorsQ.data?.vendors ?? [];
  const today = new Date();
  const todayStr = localDateKey(today);

  // Events happening today
  const todayEvents = events.filter(e => e.start_date === todayStr);

  // This week's events (next 7 days)
  const weekEvents = useMemo(() => {
    const days: { date: Date; dateStr: string; events: typeof events }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      const ds = localDateKey(d);
      days.push({ date: d, dateStr: ds, events: events.filter(e => e.start_date === ds) });
    }
    return days;
  }, [events, todayStr]);

  // Action items
  const actionItems = useMemo(() => {
    const items: { icon: React.ReactNode; label: string; detail: string; severity: 'warning' | 'info'; href: string }[] = [];

    // Events within 30 days with low RSVP rates
    const upcoming = events.filter(e => {
      if (!e.start_date || e.status === 'completed' || e.status === 'cancelled') return false;
      const daysUntil = Math.ceil((new Date(e.start_date).getTime() - Date.now()) / 86400000);
      return daysUntil > 0 && daysUntil <= 30;
    });

    for (const e of upcoming) {
      const daysUntil = Math.ceil((new Date(e.start_date!).getTime() - Date.now()) / 86400000);
      if (e.guest_count > 0 && daysUntil <= 14) {
        items.push({
          icon: <Users className="h-4 w-4 text-warning" />,
          label: `${e.title}: ${daysUntil} days away`,
          detail: `${e.guest_count} guests expected`,
          severity: 'warning',
          href: `#/events/${e.id}?tab=guests`,
        });
      }
    }

    // RSVP deadline alerts
    for (const e of upcoming) {
      const deadline = (e as any).rsvp_deadline;
      if (deadline) {
        const daysToDeadline = Math.ceil((new Date(deadline).getTime() - Date.now()) / 86400000);
        if (daysToDeadline > 0 && daysToDeadline <= 14) {
          items.push({
            icon: <Users className="h-4 w-4 text-danger" />,
            label: `RSVP deadline in ${daysToDeadline} days: ${e.title}`,
            detail: 'Check response rate and send reminders',
            severity: 'warning' as const,
            href: `#/events/${e.id}?tab=guests`,
          });
        }
      }
    }

    // Vendors with outstanding balances
    const unpaid = vendors.filter(v => {
      const balance = (v.contract_amount_cents ?? 0) - v.amount_paid_cents;
      return balance > 0 && balance >= 10000; // $100+ outstanding
    });
    if (unpaid.length > 0) {
      const totalOutstanding = unpaid.reduce((s, v) => s + ((v.contract_amount_cents ?? 0) - v.amount_paid_cents), 0);
      items.push({
        icon: <DollarSign className="h-4 w-4 text-warning" />,
        label: `${unpaid.length} vendor${unpaid.length > 1 ? 's' : ''} with outstanding balance`,
        detail: `$${(totalOutstanding / 100).toLocaleString()} total remaining`,
        severity: 'warning',
        href: '#/vendors',
      });
    }

    return items;
  }, [events, vendors]);

  if (eventsQ.isLoading) return <Skeleton className="h-48" />;

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  return (
    <div className="space-y-6">
      {/* Today's Events */}
      {todayEvents.length > 0 && (
        <Card className="border-brand/30 bg-brand/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4 text-brand" /> Today's Events
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {todayEvents.map(e => (
              <a key={e.id} href={`#/events/${e.id}`} className="flex items-center justify-between p-3 rounded-lg bg-surface border border-border hover:border-brand/30 transition-colors">
                <div>
                  <div className="font-semibold">{e.title}</div>
                  <div className="text-xs text-fg-muted">{e.guest_count} guests · ${((e.budget_cents ?? 0) / 100).toLocaleString()}</div>
                </div>
                <Badge variant="brand" className="text-[10px]">TODAY</Badge>
              </a>
            ))}
          </CardContent>
        </Card>
      )}

      {/* This Week Strip */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-4 w-4" /> This Week
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-1 overflow-x-auto">
            {weekEvents.map((day, i) => {
              const isToday = i === 0;
              const hasEvents = day.events.length > 0;
              return (
                <div key={i} className={`text-center p-2 rounded-lg transition-colors ${isToday ? 'bg-brand/10 border border-brand/20' : hasEvents ? 'bg-surface-2' : ''}`}>
                  <div className={`text-[10px] font-medium ${isToday ? 'text-brand' : 'text-fg-subtle'}`}>
                    {dayNames[day.date.getDay()]}
                  </div>
                  <div className={`text-lg font-bold ${isToday ? 'text-brand' : 'text-fg'}`}>
                    {day.date.getDate()}
                  </div>
                  <div className="text-[9px] text-fg-subtle">
                    {monthNames[day.date.getMonth()]}
                  </div>
                  {hasEvents && (
                    <div className="mt-1 space-y-0.5">
                      {day.events.slice(0, 2).map(e => (
                        <a key={e.id} href={`#/events/${e.id}`} className="block text-[9px] truncate text-brand hover:underline" title={e.title}>
                          {e.title.length > 12 ? e.title.slice(0, 12) + '…' : e.title}
                        </a>
                      ))}
                      {day.events.length > 2 && (
                        <span className="text-[9px] text-fg-subtle">+{day.events.length - 2} more</span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Action Items */}
      {actionItems.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning" /> Needs Attention
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {actionItems.map((item, i) => (
              <a key={i} href={item.href} className="flex items-start gap-3 p-3 rounded-lg hover:bg-surface-2 transition-colors border border-border/50">
                <span className="mt-0.5 shrink-0">{item.icon}</span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">{item.label}</div>
                  <div className="text-xs text-fg-muted">{item.detail}</div>
                </div>
              </a>
            ))}
          </CardContent>
        </Card>
      )}

      {/* No events today */}
      {todayEvents.length === 0 && actionItems.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center">
            <CheckCircle2 className="h-8 w-8 mx-auto text-success mb-2" />
            <p className="text-fg-muted">All clear! No events today and nothing needs immediate attention.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
