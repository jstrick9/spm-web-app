/**
 * DashboardScreen + EventPipelineSummary — extracted from App.tsx for maintainability.
 */
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Calendar, Home, Palette, Truck, Users } from 'lucide-react';
import { BarChart } from 'lucide-react';
import { sdk } from '../../sdk';
import type { SdkUser } from '../../sdk/types';
import { PageBody, PageHeader } from '../../ui/AppShell';
import { Button } from '../../ui/Button';
import { Badge } from '../../ui/Badge';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/Card';
import { EmptyState } from '../../ui/EmptyState';
import { Skeleton } from '../../ui/Skeleton';
import { WidgetSlot } from '../../config/widgets/WidgetSlot';
import { TodayView } from './TodayView';

export function DashboardScreen({ user, orgId }: { user: SdkUser; orgId: string | null }) {
  return (
    <>
      <PageHeader
        title={<>Welcome back, <span className="font-display">{user.fullName ?? user.email.split('@')[0]}</span></>}
        description="A snapshot of your venue's performance."
      />
      <PageBody>
        {orgId ? (
          <>
            {/* KPI widgets — wired to real data */}
            <WidgetSlot id="venue.dashboard.kpis" orgId={orgId} />

            {/* Phase 41: Today intelligence view */}
            <div className="mt-6">
              <TodayView orgId={orgId} />
            </div>

            {/* Event Pipeline + Quick Actions */}
            <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                <EventPipelineSummary orgId={orgId} />
              </div>
              <div className="space-y-6">
                <Card>
                  <CardHeader><CardTitle className="text-base">Quick Actions</CardTitle></CardHeader>
                  <CardContent className="space-y-2">
                    <a href="#/events" className="block"><Button variant="outline" className="w-full justify-start"><Calendar className="h-4 w-4 mr-2" /> View Events Pipeline</Button></a>
                    <a href="#/guests" className="block"><Button variant="outline" className="w-full justify-start"><Users className="h-4 w-4 mr-2" /> Browse All Guests</Button></a>
                    <a href="#/vendors" className="block"><Button variant="outline" className="w-full justify-start"><Truck className="h-4 w-4 mr-2" /> Vendor Directory</Button></a>
                    <a href="#/reports" className="block"><Button variant="outline" className="w-full justify-start"><BarChart className="h-4 w-4 mr-2" /> Analytics Report</Button></a>
                    <a href="#/system/platform" className="block"><Button variant="outline" className="w-full justify-start"><Palette className="h-4 w-4 mr-2" /> Theme Studio</Button></a>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader><CardTitle className="text-base text-fg-subtle">Keyboard</CardTitle></CardHeader>
                  <CardContent>
                    <p className="text-sm text-fg-subtle">
                      Press <kbd className="rounded border border-border bg-surface-2 px-1 text-[10px]">⌘K</kbd> for quick navigation
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </>
        ) : (
          <EmptyState
            icon={<Home className="h-5 w-5" />}
            title="No organization yet"
            description="Sign in as a venue owner to see your dashboard."
          />
        )}
      </PageBody>
    </>
  );
}

/** Mini event pipeline showing upcoming events by status. */
export function EventPipelineSummary({ orgId }: { orgId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['events', orgId],
    queryFn: () => sdk.events.list(orgId),
  });

  if (isLoading) return <Skeleton className="h-48" />;

  const events = data?.events ?? [];
  const counts = (data?.counts ?? {}) as Record<string, number>;
  const upcoming = events
    .filter(e => e.start_date && e.status !== 'completed' && e.status !== 'cancelled' && e.status !== 'lost')
    .sort((a, b) => (a.start_date ?? '').localeCompare(b.start_date ?? ''))
    .slice(0, 5);

  const totalRevenue = events
    .filter(e => e.status === 'booked' || e.status === 'planning' || e.status === 'completed')
    .reduce((s, e) => s + (e.budget_cents ?? 0), 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Event Pipeline</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Pipeline status bar */}
        <div className="flex items-center gap-1 text-xs">
          {['lead', 'hold', 'booked', 'planning', 'completed'].map(status => {
            const count = counts[status] ?? 0;
            if (count === 0) return null;
            const colors: Record<string, string> = {
              lead: 'bg-chart-1', hold: 'bg-chart-4', booked: 'bg-chart-2',
              planning: 'bg-chart-3', completed: 'bg-chart-5',
            };
            return (
              <div key={status} className="flex items-center gap-1">
                <span className={`inline-block w-2.5 h-2.5 rounded-full ${colors[status] ?? 'bg-surface-2'}`} />
                <span className="text-fg-muted capitalize">{status}</span>
                <span className="font-medium">{count}</span>
              </div>
            );
          })}
          {events.length > 0 && (
            <span className="ml-auto text-fg-subtle">
              Pipeline: ${(totalRevenue / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </span>
          )}
        </div>

        {/* Upcoming events list */}
        {upcoming.length === 0 ? (
          <p className="text-sm text-fg-muted py-4 text-center">No upcoming events. <a href="#/events" className="text-brand underline">Create one →</a></p>
        ) : (
          <div className="space-y-2">
            {upcoming.map(e => (
              <a key={e.id} href={`#/events/${e.id}`} className="flex items-center justify-between p-3 rounded-lg hover:bg-surface-2/50 transition-colors border border-border/50 group">
                <div className="min-w-0">
                  <div className="font-medium text-sm truncate group-hover:text-brand transition-colors">{e.title}</div>
                  <div className="text-xs text-fg-muted mt-0.5">
                    {e.start_date} · {e.guest_count} guests
                    {e.budget_cents != null && ` · $${(e.budget_cents / 100).toLocaleString()}`}
                  </div>
                </div>
                <Badge variant={e.status === 'booked' ? 'success' : e.status === 'lead' ? 'warning' : 'default'} className="text-[10px] capitalize shrink-0">
                  {e.status}
                </Badge>
              </a>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Login / Register ───────────────────────────────────────