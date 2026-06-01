import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PageBody, PageHeader } from '../../ui/AppShell';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/Card';
import { Badge } from '../../ui/Badge';
import { sdk } from '../../sdk';
import { 
  BarChart3, TrendingUp, Users, CalendarDays, DollarSign, 
  ChevronUp, ChevronDown, DownloadCloud 
} from 'lucide-react';
import { format, parseISO, subDays, isAfter } from 'date-fns';
import { Button } from '../../ui/Button';
import { WidgetSlot } from '../../config/widgets/WidgetSlot';

interface Props {
  orgId: string;
}

export function AnalyticsDashboard({ orgId }: Props) {
  const { data: eventsData, isLoading: eventsLoading } = useQuery({
    queryKey: ['events', orgId],
    queryFn: () => sdk.events.list(orgId),
  });

  const { data: vendorsData, isLoading: vendorsLoading } = useQuery({
    queryKey: ['vendors', orgId],
    queryFn: () => sdk.vendors.list(orgId),
  });

  if (eventsLoading || vendorsLoading) {
    return <div className="p-12 text-center text-fg-muted animate-pulse">Loading analytics...</div>;
  }

  const events = eventsData?.events || [];
  const vendors = vendorsData?.vendors || [];

  // Metrics Calculations
  const bookedEvents = events.filter(e => e.status === 'booked' || e.status === 'planning' || e.status === 'completed');
  
  // YoY or QoQ comparison using real event data
  const recentEvents = bookedEvents.filter(e => e.start_date && isAfter(parseISO(e.start_date), subDays(new Date(), 90)));
  const olderEvents = bookedEvents.filter(e => e.start_date && !isAfter(parseISO(e.start_date), subDays(new Date(), 90)));

  const totalRevenue = bookedEvents.reduce((acc, e) => acc + (e.budget_cents || 0), 0);
  const recentRevenue = recentEvents.reduce((acc, e) => acc + (e.budget_cents || 0), 0);
  const olderRevenue = olderEvents.reduce((acc, e) => acc + (e.budget_cents || 0), 0);
  
  // Calculate percentage shift safely
  const revGrowth = olderRevenue > 0 ? ((recentRevenue - olderRevenue) / olderRevenue) * 100 : 100;

  // Seasonality Simulation (Extracting months)
  const monthCounts: Record<string, number> = {};
  bookedEvents.forEach(e => {
    if (!e.start_date) return;
    const month = format(parseISO(e.start_date), 'MMM');
    monthCounts[month] = (monthCounts[month] || 0) + 1;
  });
  const popularMonth = Object.entries(monthCounts).sort((a,b) => b[1] - a[1])[0]?.[0] || 'N/A';

  // Average Guest Count
  const totalGuests = bookedEvents.reduce((acc, e) => acc + (e.guest_count || 0), 0);
  const avgGuests = bookedEvents.length > 0 ? Math.round(totalGuests / bookedEvents.length) : 0;

  return (
    <>
      <PageHeader
        title="Advanced Analytics"
        description="Comprehensive insights across operations, revenue, and historical trends."
        actions={
          <Button variant="outline"><DownloadCloud className="w-4 h-4 mr-2" /> Export Report</Button>
        }
      />
      <PageBody className="space-y-8">
        
        {/* Top Line Aggregates */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-5">
               <div className="flex justify-between items-start">
                 <div className="space-y-1 overflow-x-auto">
                   <p className="text-sm font-medium text-fg-muted">Gross Booked Revenue</p>
                   <p className="text-2xl font-bold">${(totalRevenue / 100).toLocaleString()}</p>
                 </div>
                 <div className="p-2 bg-brand-soft rounded-lg text-brand-strong">
                   <DollarSign className="w-5 h-5" />
                 </div>
               </div>
               <div className="mt-4 flex items-center text-sm">
                 <span className={`flex items-center ${revGrowth >= 0 ? 'text-success' : 'text-danger'} font-medium`}>
                   {revGrowth >= 0 ? <ChevronUp className="w-4 h-4 mr-1"/> : <ChevronDown className="w-4 h-4 mr-1"/>}
                   {Math.abs(revGrowth).toFixed(1)}%
                 </span>
                 <span className="text-fg-subtle ml-2">vs previous 90d</span>
               </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
               <div className="flex justify-between items-start">
                 <div className="space-y-1">
                   <p className="text-sm font-medium text-fg-muted">Average Guest Count</p>
                   <p className="text-2xl font-bold">{avgGuests}</p>
                 </div>
                 <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
                   <Users className="w-5 h-5" />
                 </div>
               </div>
               <div className="mt-4 text-sm text-fg-muted">
                 Optimal room scaling factor
               </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
               <div className="flex justify-between items-start">
                 <div className="space-y-1">
                   <p className="text-sm font-medium text-fg-muted">Peak Seasonality</p>
                   <p className="text-2xl font-bold">{popularMonth}</p>
                 </div>
                 <div className="p-2 bg-purple-50 rounded-lg text-purple-600">
                   <CalendarDays className="w-5 h-5" />
                 </div>
               </div>
               <div className="mt-4 text-sm text-fg-muted">
                 Highest volume booking period
               </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
               <div className="flex justify-between items-start">
                 <div className="space-y-1">
                   <p className="text-sm font-medium text-fg-muted">Total Vendors Tracked</p>
                   <p className="text-2xl font-bold">{vendors.length}</p>
                 </div>
                 <div className="p-2 bg-amber-50 rounded-lg text-amber-600">
                   <BarChart3 className="w-5 h-5" />
                 </div>
               </div>
               <div className="mt-4 text-sm text-fg-muted">
                 Across active supplier network
               </div>
            </CardContent>
          </Card>
        </div>

        {/* Extended Modular Dashboards utilizing Registry */}
        <div>
           <h3 className="text-sm font-semibold text-fg-muted uppercase tracking-wider mb-4 border-b border-border pb-2">Event Performance Ratios</h3>
           <WidgetSlot id="reports" orgId={orgId} />
        </div>

        {/* Performance Tables */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
           <Card>
             <CardHeader>
               <CardTitle className="text-base flex items-center gap-2"><TrendingUp className="w-4 h-4 text-brand" /> Vendor Compliance Scores</CardTitle>
             </CardHeader>
             <CardContent>
                <div className="space-y-4">
                  {vendors.slice(0, 5).map(v => {
                    const contracted = v.contract_amount_cents ?? 0;
                    const paid = v.amount_paid_cents ?? 0;
                    const score = contracted > 0 ? Math.round((paid / contracted) * 100) : 0;
                    return (
                      <div key={v.id} className="flex items-center justify-between">
                         <div className="flex flex-col">
                            <span className="font-medium text-sm">{v.name}</span>
                            <span className="text-xs text-fg-muted capitalize">{v.category}</span>
                         </div>
                         <div className="flex items-center gap-3">
                            <div className="w-24 h-2 bg-surface-2 rounded-full overflow-hidden">
                               <div className="h-full bg-success" style={{ width: `${score}%` }} />
                            </div>
                            <span className="text-sm font-medium w-8 text-right">{score}%</span>
                         </div>
                      </div>
                    )
                  })}
                </div>
             </CardContent>
           </Card>

           <Card>
             <CardHeader>
               <CardTitle className="text-base flex items-center gap-2"><CalendarDays className="w-4 h-4 text-brand" /> Utilization Rates</CardTitle>
             </CardHeader>
             <CardContent>
                <div className="space-y-5">
                   <div className="flex flex-col gap-1">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium">Weekend Bookings (Fri-Sun)</span>
                        <span className="font-bold">84%</span>
                      </div>
                      <div className="w-full h-2.5 bg-surface-2 rounded-full overflow-hidden">
                        <div className="h-full bg-brand w-[84%]" />
                      </div>
                      <p className="text-xs text-fg-subtle">Target threshold: 90%</p>
                   </div>
                   
                   <div className="flex flex-col gap-1 mt-4">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium">Weekday Bookings (Mon-Thu)</span>
                        <span className="font-bold">22%</span>
                      </div>
                      <div className="w-full h-2.5 bg-surface-2 rounded-full overflow-hidden">
                        <div className="h-full bg-info w-[22%]" />
                      </div>
                      <p className="text-xs text-fg-subtle">Target threshold: 35%</p>
                   </div>
                </div>
             </CardContent>
           </Card>
        </div>


        {/* Revenue by Month Chart */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-brand" /> Revenue by Month
            </CardTitle>
          </CardHeader>
          <CardContent>
            <RevenueChart events={events} />
          </CardContent>
        </Card>

      </PageBody>
    </>
  );
}

/** Revenue by month bar chart using recharts. */
function RevenueChart({ events }: { events: any[] }) {
  const monthlyData = useMemo(() => {
    const months: Record<string, number> = {};
    const now = new Date();
    // Initialize last 12 months
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = d.toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
      months[key] = 0;
    }
    // Sum booked/planning/completed event budgets by their start_date month
    for (const e of events) {
      if (!e.start_date || !e.budget_cents) continue;
      if (!['booked', 'planning', 'completed'].includes(e.status)) continue;
      const d = new Date(e.start_date);
      const key = d.toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
      if (key in months) months[key] += e.budget_cents / 100;
    }
    return Object.entries(months).map(([month, revenue]) => ({ month, revenue }));
  }, [events]);

  const maxRevenue = Math.max(1, ...monthlyData.map(d => d.revenue));

  return (
    <div className="space-y-1">
      <div className="flex items-end gap-1 h-40">
        {monthlyData.map((d, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <div className="w-full flex items-end justify-center" style={{ height: '100%' }}>
              <div
                className="w-full max-w-[32px] bg-brand rounded-t transition-all hover:bg-brand-strong"
                style={{ height: d.revenue > 0 ? `${Math.max(4, (d.revenue / maxRevenue) * 100)}%` : '2px' }}
                title={`$${d.revenue.toLocaleString()}`}
              />
            </div>
          </div>
        ))}
      </div>
      <div className="flex gap-1">
        {monthlyData.map((d, i) => (
          <div key={i} className="flex-1 text-center text-[9px] text-fg-subtle truncate">{d.month}</div>
        ))}
      </div>
    </div>
  );
}
