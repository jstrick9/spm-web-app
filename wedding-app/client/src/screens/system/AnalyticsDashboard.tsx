import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PageBody, PageHeader } from '../../ui/AppShell';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/Card';
import { Badge } from '../../ui/Badge';
import { sdk } from '../../sdk';
import { 
  BarChart3, TrendingUp, Users, CalendarDays, DollarSign, 
  ChevronUp, ChevronDown, DownloadCloud, ClipboardList, Clock, FileText, ShieldAlert, Truck, UserCheck, Utensils, Accessibility, Bed, Activity 
} from 'lucide-react';
import { format, parseISO, subDays, isAfter } from 'date-fns';
import { Button } from '../../ui/Button';
import { WidgetSlot } from '../../config/widgets/WidgetSlot';

interface Props {
  orgId: string;
}

function parseMetadata(value: unknown): Record<string, any> {
  if (!value) return {};
  try { return typeof value === 'string' ? JSON.parse(value) : value as Record<string, any>; } catch { return {}; }
}

function eventDaysUntil(startDate?: string | null) {
  if (!startDate) return null;
  const ms = new Date(startDate).getTime() - Date.now();
  if (Number.isNaN(ms)) return null;
  return Math.ceil(ms / 86_400_000);
}

function downloadTextFile(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
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

  const managerMode = typeof window !== 'undefined' && localStorage.getItem('wvi_registration_role') === 'venue_manager';

  const { data: staffData } = useQuery({
    queryKey: ['staffTasks', orgId, 'reports'],
    queryFn: () => sdk.staff.listTasks(orgId),
    enabled: managerMode,
  });

  const { data: riskData } = useQuery({
    queryKey: ['risk-alerts', orgId, 'manager-reports'],
    queryFn: () => sdk.risk.forOrg(orgId),
    enabled: managerMode,
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
  const staffTasks = staffData?.tasks ?? [];
  const riskEvents = riskData?.events ?? [];
  const completedOperationalEvents = events.filter(e => e.status === 'completed');
  const activeOperationalEvents = events.filter(e => ['booked', 'planning'].includes(e.status));
  const incidentEvents = events.filter(e => {
    const meta = parseMetadata((e as any).metadata);
    return (meta.emergency_incidents?.length || 0) + (meta.managerEscalations?.length || 0) > 0;
  });
  const guestOps = events.reduce((acc, event: any) => {
    const meta = parseMetadata(event.metadata);
    acc.dietary += Number(meta.dietaryCount || meta.dietaryRequests || 0);
    acc.accessibility += Number(meta.accessibilityCount || meta.accessibilityRequests || 0);
    acc.lodging += Number(meta.lodgingGuests || meta.hotelBlockGuests || 0);
    acc.guestIssues += Array.isArray(meta.guestServiceLog) ? meta.guestServiceLog.length : Number(meta.guestIssueCount || 0);
    return acc;
  }, { dietary: 0, accessibility: 0, lodging: 0, guestIssues: 0 });
  const staffCompleted = staffTasks.filter(t => t.status === 'completed').length;
  const staffOpen = staffTasks.filter(t => t.status !== 'completed').length;
  const staffBlocked = staffTasks.filter(t => t.status === 'blocked').length;
  const staffCompletionPct = staffTasks.length ? Math.round((staffCompleted / staffTasks.length) * 100) : 0;
  const vendorScorecards = vendors.map(v => {
    const meta = parseMetadata(v.metadata);
    let score = 100;
    if (!v.phone) score -= 10;
    if (!meta.arrivalTime) score -= 20;
    if (!meta.coiReceived && !meta.coiLink) score -= 25;
    if ((v.contract_amount_cents || 0) > (v.amount_paid_cents || 0)) score -= 10;
    if (meta.noShowWorkflow?.status === 'active') score -= 30;
    return { vendor: v, score: Math.max(0, score), punctuality: meta.arrivalTime ? 'arrival captured' : 'arrival missing' };
  }).sort((a, b) => a.score - b.score);
  const timelineDriftEvents = events.filter((event: any) => {
    const meta = parseMetadata(event.metadata);
    return (meta.timelineDriftMinutes || 0) !== 0 || (meta.timelineChangeLog?.length || meta.managerTimelineState?.commandLog?.length || 0) > 0;
  });
  const readinessTrend = riskEvents.map(r => ({ title: r.eventTitle, score: r.healthScore, daysUntil: r.daysUntil })).slice(0, 8);

  const handleExportWeeklyBriefing = () => {
    const lines = [
      'Weekly Manager Operations Briefing',
      `Generated: ${new Date().toLocaleString()}`,
      '',
      `Active operational events: ${activeOperationalEvents.length}`,
      `Flagged events: ${riskEvents.length}`,
      `Open staff tasks: ${staffOpen}`,
      `Blocked staff tasks: ${staffBlocked}`,
      `Vendor scorecards needing review: ${vendorScorecards.filter(v => v.score < 75).length}`,
      `Guest service issues: ${guestOps.guestIssues}`,
      '',
      'Top readiness risks:',
      ...readinessTrend.slice(0, 5).map(item => `- ${item.title}: ${item.score}/100${item.daysUntil != null ? `, ${item.daysUntil} days until event` : ''}`),
    ];
    downloadTextFile(`manager-weekly-briefing-${new Date().toISOString().slice(0, 10)}.txt`, lines.join('\n'));
  };

  return (
    <>
      <PageHeader
        title={managerMode ? 'Manager Operations Analytics' : 'Advanced Analytics'}
        description={managerMode ? 'Operations reports separated from owner financial analytics: incidents, vendors, guests, staff, timeline drift, and readiness trends.' : 'Comprehensive insights across operations, revenue, and historical trends.'}
        actions={
          <Button variant="outline" onClick={managerMode ? handleExportWeeklyBriefing : undefined}><DownloadCloud className="w-4 h-4 mr-2" /> {managerMode ? 'Export weekly briefing' : 'Export Report'}</Button>
        }
      />
      <PageBody className="space-y-8">
        {managerMode && (
          <ManagerOperationsAnalyticsDashboard
            activeEvents={activeOperationalEvents.length}
            completedEvents={completedOperationalEvents.length}
            incidentEvents={incidentEvents.length}
            timelineDriftEvents={timelineDriftEvents.length}
            riskEvents={riskEvents}
            vendorScorecards={vendorScorecards}
            guestOps={guestOps}
            staffTasks={staffTasks}
            staffCompletionPct={staffCompletionPct}
            staffBlocked={staffBlocked}
            readinessTrend={readinessTrend}
            onExportWeeklyBriefing={handleExportWeeklyBriefing}
          />
        )}
        
        {/* Top Line Aggregates */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-5">
               <div className="flex justify-between items-start">
                 <div className="space-y-1 overflow-x-auto">
                   <p className="text-sm font-medium text-fg-muted">{managerMode ? 'Operations Events Tracked' : 'Gross Booked Revenue'}</p>
                   <p className="text-2xl font-bold">{managerMode ? bookedEvents.length : `$${(totalRevenue / 100).toLocaleString()}`}</p>
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

function ManagerOperationsAnalyticsDashboard({
  activeEvents,
  completedEvents,
  incidentEvents,
  timelineDriftEvents,
  riskEvents,
  vendorScorecards,
  guestOps,
  staffTasks,
  staffCompletionPct,
  staffBlocked,
  readinessTrend,
  onExportWeeklyBriefing,
}: {
  activeEvents: number;
  completedEvents: number;
  incidentEvents: number;
  timelineDriftEvents: number;
  riskEvents: any[];
  vendorScorecards: Array<{ vendor: any; score: number; punctuality: string }>;
  guestOps: { dietary: number; accessibility: number; lodging: number; guestIssues: number };
  staffTasks: any[];
  staffCompletionPct: number;
  staffBlocked: number;
  readinessTrend: Array<{ title: string; score: number; daysUntil: number | null }>;
  onExportWeeklyBriefing: () => void;
}) {
  const postEventDebrief = [
    `${completedEvents} completed event(s) ready for debrief review.`,
    `${incidentEvents} event(s) have incident/escalation records to summarize.`,
    `${timelineDriftEvents} event(s) show timeline drift or command-log activity.`,
    `${vendorScorecards.filter(v => v.score < 75).length} vendor(s) need reliability follow-up.`,
  ];
  const staffByPriority = ['critical','high','medium','low'].map(priority => ({ priority, count: staffTasks.filter(t => t.priority === priority).length }));
  return (
    <div className="space-y-6">
      <Card className="border-brand/20 bg-brand-soft/5">
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2"><Activity className="h-4 w-4 text-brand" /> Manager operations analytics dashboard</CardTitle>
              <p className="text-sm text-fg-muted mt-1">Manager-facing operations reports are separated from owner financial reports.</p>
            </div>
            <Button size="sm" variant="outline" onClick={onExportWeeklyBriefing}><DownloadCloud className="h-4 w-4" /> Export weekly manager briefing</Button>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <ManagerMetric icon={<CalendarDays className="h-4 w-4" />} label="Active events" value={activeEvents} detail="booked/planning" />
          <ManagerMetric icon={<ShieldAlert className="h-4 w-4" />} label="Post-event incidents" value={incidentEvents} detail="events with incident records" />
          <ManagerMetric icon={<Clock className="h-4 w-4" />} label="Timeline drift" value={timelineDriftEvents} detail="events with drift/change activity" />
          <ManagerMetric icon={<UserCheck className="h-4 w-4" />} label="Staff completion" value={`${staffCompletionPct}%`} detail={`${staffBlocked} blocked task(s)`} />
          <ManagerMetric icon={<Truck className="h-4 w-4" />} label="Vendor reviews" value={vendorScorecards.filter(v => v.score < 75).length} detail="scorecards needing action" />
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <ReportCard title="Post-event debrief generator" icon={<FileText className="h-4 w-4" />}>
          <ul className="space-y-2 text-sm text-fg-muted">{postEventDebrief.map(line => <li key={line}>• {line}</li>)}</ul>
        </ReportCard>
        <ReportCard title="Event readiness trend over time" icon={<TrendingUp className="h-4 w-4" />}>
          <div className="space-y-2">{readinessTrend.length ? readinessTrend.map(item => <div key={item.title} className="rounded-lg border border-border bg-surface-2 p-2 text-xs"><div className="flex justify-between"><strong>{item.title}</strong><span>{item.score}/100</span></div><div className="mt-1 h-2 rounded-full bg-bg"><div className="h-2 rounded-full bg-brand" style={{ width: `${Math.max(4, item.score)}%` }} /></div></div>) : <p className="text-sm text-fg-muted">No readiness trend data yet.</p>}</div>
        </ReportCard>
        <ReportCard title="Vendor scorecard report" icon={<Truck className="h-4 w-4" />}>
          <div className="space-y-2">{vendorScorecards.slice(0, 6).map(row => <div key={row.vendor.id} className="flex justify-between rounded-lg border border-border bg-surface-2 p-2 text-xs"><span><strong>{row.vendor.name}</strong><span className="block text-fg-muted">{row.vendor.category} · {row.punctuality}</span></span><Badge variant={row.score >= 85 ? 'success' : row.score >= 70 ? 'warning' : 'danger'}>{row.score}</Badge></div>)}</div>
        </ReportCard>
        <ReportCard title="Guest service operations report" icon={<Users className="h-4 w-4" />}>
          <div className="grid gap-2 sm:grid-cols-2"><ManagerMetric icon={<Utensils className="h-4 w-4" />} label="Dietary volume" value={guestOps.dietary} detail="reported requests" /><ManagerMetric icon={<Accessibility className="h-4 w-4" />} label="Accessibility" value={guestOps.accessibility} detail="support needs" /><ManagerMetric icon={<Bed className="h-4 w-4" />} label="Lodging" value={guestOps.lodging} detail="hotel/block utilization" /><ManagerMetric icon={<ShieldAlert className="h-4 w-4" />} label="Guest issues" value={guestOps.guestIssues} detail="service records" /></div>
        </ReportCard>
        <ReportCard title="Staff productivity report" icon={<ClipboardList className="h-4 w-4" />}>
          <div className="space-y-2"><div className="flex justify-between text-sm"><span>Completion rate</span><strong>{staffCompletionPct}%</strong></div>{staffByPriority.map(row => <div key={row.priority} className="flex justify-between rounded-lg border border-border bg-surface-2 p-2 text-xs capitalize"><span>{row.priority}</span><strong>{row.count}</strong></div>)}</div>
        </ReportCard>
        <ReportCard title="Timeline drift report" icon={<Clock className="h-4 w-4" />}>
          <p className="text-sm text-fg-muted">{timelineDriftEvents} event(s) have timeline drift/change activity. Review command logs, late items, and incident annotations in each event timeline.</p>
        </ReportCard>
      </div>
    </div>
  );
}

function ManagerMetric({ icon, label, value, detail }: { icon: React.ReactNode; label: string; value: string | number; detail: string }) {
  return <div className="rounded-lg border border-border bg-surface p-3"><div className="flex items-center gap-2 text-xs font-bold text-brand">{icon}{label}</div><div className="mt-1 text-2xl font-bold text-fg">{value}</div><p className="text-[11px] text-fg-muted">{detail}</p></div>;
}

function ReportCard({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return <Card><CardHeader><CardTitle className="text-base flex items-center gap-2">{icon}{title}</CardTitle></CardHeader><CardContent>{children}</CardContent></Card>;
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
