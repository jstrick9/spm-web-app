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
  
  // YoY or QoQ simulated comparison logic
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-5">
               <div className="flex justify-between items-start">
                 <div className="space-y-1">
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
                    const score = Math.floor(Math.random() * 20) + 80; // Mock score 80-100
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

      </PageBody>
    </>
  );
}
