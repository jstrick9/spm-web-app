/**
 * DashboardScreen — the venue owner's home page.
 * Task-first command center for first-time and returning venue owners.
 */
import { useState, useEffect, useMemo } from "react";
import { StaffingCalendar } from './StaffingCalendar';
import { SpaceCalendarGrid } from './SpaceCalendarGrid';
import { conflictedEventIds } from './dashboardUtils';
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Calendar,
  Building2,
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
  MessageSquare,
  Phone,
  Printer,
  Wifi,
  WifiOff,
  ClipboardList,
  Activity,
  Bot,
  BookOpen,
  FileArchive,
  Umbrella,
  Footprints,
  Camera,
  Wrench,
  Wine,
  ParkingCircle,
  Accessibility,
  Flame,
  Handshake,
  Repeat,
  GraduationCap,
  Search,
  CheckSquare,
} from "lucide-react";
import { useSSE } from "../../lib/useSSE";
import { sdk } from "../../sdk";
import { formatDateOnly, parseDateOnly } from "../../lib/formatDate";
import { usePermission } from "../../lib/usePermission";
import { useToast } from "../../ui/Toast";
import { PageBody, PageHeader } from "../../ui/AppShell";
import { cn } from "../../ui/lib/cn";
import { StatCard } from "../../ui/StatCard";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "../../ui/Card";
import { Badge } from "../../ui/Badge";
import { Button } from "../../ui/Button";
import { Skeleton } from "../../ui/Skeleton";
import { EmptyState } from "../../ui/EmptyState";
import type { SdkUser } from "../../sdk/types";
import { EventRiskBadge } from "../events/components/EventRiskBadge";
import { useBranding } from "../../config/ConfigProvider";

interface Props {
  user: SdkUser;
  orgId: string | null;
  userConfig?: any;
  onCreateEvent?: () => void;
}

import { STATUS_COLORS, getGreeting, safeJson } from './dashboardUtils';


// Decomposed widget components (see ./dashboardPanels.tsx).
import { VenueStudioReadiness, OwnerCommandCenter, QuestionCard, SetupProgressWidget, HealthActionsWidget, RevenueSnapshotWidget, UpcomingToursWidget, OnsiteOperationsWidget, MiniWidget, TodayEventCard, OperationsTicker, OnboardingGoLiveChecklist, OwnerSetupChecklist, ManagerCommandCenter, ManagerBestInClassModules, ScaleIcon, ManagerMetric, ManagerPanel, ManagerQueue, ResponsibilityCard, WorkflowLane, ManagerOnboardingChecklist, DashboardSectionNav, OwnerActionCard, TickerItem } from './dashboardPanels';
import { usePrompt } from '../../ui/usePrompt';

export function DashboardScreen({
  user,
  orgId,
  userConfig,
  onCreateEvent,
}: Props) {
  const { ask, askForm, askConfirm, promptNode } = usePrompt();
  const { toast } = useToast();
  const canViewAnalytics = usePermission("reports.view");
  const branding = useBranding();
  const qc = useQueryClient();

  const canCreateEvent = usePermission("events.create");
  const canViewGuests = usePermission("guests.view");
  const canViewVendors = usePermission("vendors.view");
  const canManageVenue = usePermission("venues.manage");
  const canInviteTeam = usePermission("org.members.invite");
  const canViewStaff = usePermission("staff.view");
  const canManageStaff = usePermission("staff.manage");
  const canViewBudget = usePermission("budget.view");
  const canViewContracts = usePermission("contracts.view");
  const canApproveLayouts = usePermission("layouts.publish");
  const [approvalRiskOnly, setApprovalRiskOnly] = useState(true);
  const [staffingCalendarMonthOffset, setStaffingCalendarMonthOffset] = useState(0);
  const [spaceCalendarMonthOffset, setSpaceCalendarMonthOffset] = useState(0);
  const [selectedSpaceId, setSelectedSpaceId] = useState<string | null>(null);
  const [tutorialActive, setTutorialActive] = useState<boolean>(false);
  const [demoMode, setDemoMode] = useState(
    () => localStorage.getItem("wvi_demo_mode") === "true",
  );
  const [firstEventWalkthrough, setFirstEventWalkthrough] = useState(
    () => localStorage.getItem("wvi_first_event_walkthrough") === "true",
  );
  const [managerChecklistVisible, setManagerChecklistVisible] = useState(
    () =>
      localStorage.getItem("wvi_registration_role") === "venue_manager" ||
      localStorage.getItem("wvi_manager_onboarding_checklist") === "true",
  );

  // Today's events + upcoming this week
  const eventsQuery = useQuery({
    queryKey: ["events", orgId, "dashboard"],
    queryFn: () =>
      orgId
        ? sdk.events.list(orgId, {
            startsAfter: new Date(Date.now() - 86400000)
              .toISOString()
              .slice(0, 10),
            startsBefore: new Date(Date.now() + 7 * 86400000)
              .toISOString()
              .slice(0, 10),
            limit: 10,
          })
        : Promise.resolve({ events: [] as any[], counts: {} as any }),
    enabled: !!orgId,
    staleTime: 30_000,
  });

  // Pipeline counts
  const allEventsQuery = useQuery({
    queryKey: ["events", orgId, "counts"],
    queryFn: () =>
      orgId
        ? sdk.events.list(orgId)
        : Promise.resolve({ events: [] as any[], counts: {} as any }),
    enabled: !!orgId,
    staleTime: 60_000,
  });

  const setupQuery = useQuery({
    queryKey: ["org-config", orgId, "owner-setup"],
    queryFn: () => sdk.platformConfig.getOrg(orgId!),
    enabled: !!orgId,
    staleTime: 60_000,
  });

  const healthCommandQuery = useQuery({
    queryKey: ["health-command-center", orgId, "dashboard-top3"],
    queryFn: () => sdk.healthCommand.get(orgId!),
    enabled: !!orgId && canViewAnalytics,
    staleTime: 60_000,
  });

  // Intelligence recommendations (only if permitted)
  const recsQuery = useQuery({
    queryKey: ["recommendations", orgId],
    queryFn: () => sdk.intelligence.recommendations.get(orgId!),
    enabled: !!orgId && canViewAnalytics,
    staleTime: 5 * 60_000,
  });

  const meQuery = useQuery({
    queryKey: ["me", "dashboard-role"],
    queryFn: () => sdk.auth.me(),
    staleTime: 5 * 60_000,
  });

  const counts = allEventsQuery.data?.counts as
    | Record<string, number>
    | undefined;
  const totalActive = (counts?.booked ?? 0) + (counts?.planning ?? 0);
  const rec = recsQuery.data?.recommendations;
  const ownerSetup = (setupQuery.data?.config as any)?.setup?.ownerSetup;
  const ownerSetupStatus = ownerSetup?.status ?? "not_started";
  const setupIncomplete = ownerSetupStatus !== "completed";
  const setupSteps = ["identity", "spaces", "rules", "catalog", "firstEvent"];
  const setupCompletedCount =
    ownerSetupStatus === "completed"
      ? setupSteps.length
      : setupSteps.filter((step) =>
          (ownerSetup?.completedSteps ?? []).includes(step),
        ).length;
  const setupPct = Math.round((setupCompletedCount / setupSteps.length) * 100);
  const leadHoldCount = (counts?.lead ?? 0) + (counts?.hold ?? 0);
  const projectedRevenue = rec?.budgetRange?.count
    ? Math.round((rec.budgetRange.median * Math.max(totalActive, 1)) / 100)
    : null;

  // Today's events (starts today)
  const today = new Date().toISOString().slice(0, 10);
  const todaysEvents = (eventsQuery.data?.events ?? []).filter(
    (e: any) => e.start_date?.slice(0, 10) === today,
  );
  const upcomingEvents = (eventsQuery.data?.events ?? [])
    .filter((e: any) => e.start_date?.slice(0, 10) > today)
    .slice(0, 5);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const tomorrowEvents = (eventsQuery.data?.events ?? []).filter(
    (e: any) => e.start_date?.slice(0, 10) === tomorrow,
  );
  const managerEvents = [...todaysEvents, ...tomorrowEvents, ...upcomingEvents]
    .filter(
      (event, index, all) =>
        all.findIndex((candidate: any) => candidate.id === event.id) === index,
    )
    .slice(0, 4);
  const focusEvent = managerEvents[0];
  const roleKeys =
    meQuery.data?.memberships?.map((membership) => membership.roleKey) ?? [];
  const isManager =
    roleKeys.includes("manager") ||
    localStorage.getItem("wvi_registration_role") === "venue_manager";

  const approvalQueueQuery = useQuery({ queryKey: ['layout-approval-queue', orgId], queryFn: () => sdk.layouts.approvalQueue(orgId!), enabled: !!orgId && canApproveLayouts, staleTime: 30_000 });

  const staffTasksQuery = useQuery({
    queryKey: ["staffTasks", focusEvent?.id, "manager-dashboard"],
    queryFn: () => sdk.staff.listTasks(orgId!, { eventId: focusEvent!.id }),
    enabled: !!orgId && !!focusEvent?.id && isManager && canViewStaff,
    staleTime: 30_000,
  });

  const communicationTemplatesQuery = useQuery({ queryKey: ['communication-templates', orgId], queryFn: () => sdk.events.communicationTemplates(orgId!), enabled: !!orgId && isManager });
  const createCommunicationTemplateMutation = useMutation({ mutationFn: (input: { name: string; category: any; audience: any; subject: string; body: string }) => sdk.events.createCommunicationTemplate(orgId!, input), onSuccess: () => { qc.invalidateQueries({ queryKey: ['communication-templates', orgId] }); } });

  const updateCommunicationTemplateMutation = useMutation({ mutationFn: ({ id, patch }: { id: string; patch: any }) => sdk.events.updateCommunicationTemplate(id, patch), onSuccess: () => { qc.invalidateQueries({ queryKey: ['communication-templates', orgId] }); } });

  const portfolioReadinessQuery = useQuery({ queryKey: ['portfolio-readiness', orgId], queryFn: () => sdk.events.portfolioReadiness(orgId!), enabled: !!orgId && isManager, staleTime: 30_000 });

  const staffingCalendarRange = useMemo(() => { const now = new Date(); const start = new Date(now.getFullYear(), now.getMonth() + staffingCalendarMonthOffset, 1); const end = new Date(now.getFullYear(), now.getMonth() + staffingCalendarMonthOffset + 1, 1); return { start: start.toISOString(), end: end.toISOString(), days: new Date(end.getFullYear(), end.getMonth(), 0).getDate() }; }, [staffingCalendarMonthOffset]);
  const spaceCalendarRange = useMemo(() => { const now = new Date(); const start = new Date(now.getFullYear(), now.getMonth() + spaceCalendarMonthOffset, 1); const end = new Date(now.getFullYear(), now.getMonth() + spaceCalendarMonthOffset + 1, 1); return { start: start.toISOString(), end: end.toISOString() }; }, [spaceCalendarMonthOffset]);
  const spaceCalendarQuery = useQuery({ queryKey: ['space-calendar', orgId, spaceCalendarRange.start], queryFn: () => sdk.venues.spaceCalendar(orgId!, spaceCalendarRange.start.slice(0, 10), spaceCalendarRange.end.slice(0, 10)), enabled: !!orgId && isManager, staleTime: 30_000 });
  const spaceDetailQuery = useQuery({ queryKey: ['space-detail', selectedSpaceId], queryFn: () => sdk.venues.spaceDetail(selectedSpaceId!), enabled: !!selectedSpaceId });
  const staffingCalendarQuery = useQuery({ queryKey: ['staff-calendar', orgId, staffingCalendarRange.start], queryFn: () => sdk.staff.calendar(orgId!, staffingCalendarRange.start, staffingCalendarRange.end), enabled: !!orgId && isManager && canViewStaff, staleTime: 30_000 });

  const staffingCoverageQuery = useQuery({
    queryKey: ['staff-coverage', orgId],
    queryFn: () => sdk.staff.coverage(orgId!),
    enabled: !!orgId && isManager && canViewStaff,
    staleTime: 30_000,
  });

  const managerVendorsQuery = useQuery({
    queryKey: ["vendors", focusEvent?.id, "manager-dashboard"],
    queryFn: () => sdk.vendors.list(orgId!, { eventId: focusEvent!.id }),
    enabled: !!orgId && !!focusEvent?.id && isManager && canViewVendors,
    staleTime: 30_000,
  });

  const managerLayoutsQuery = useQuery({
    queryKey: ["layouts", focusEvent?.id, "manager-dashboard"],
    queryFn: () => sdk.layouts.list(orgId!, { eventId: focusEvent!.id }),
    enabled: !!orgId && !!focusEvent?.id && isManager,
    staleTime: 30_000,
  });

  const isLoading = eventsQuery.isLoading || allEventsQuery.isLoading;

  return (
    <>
      {promptNode}
      <PageHeader
        title={
          <span className="font-serif text-2xl font-bold tracking-tight text-fg">
            Good {getGreeting()},{" "}
            <span className="text-brand italic font-semibold">
              {user.fullName?.split(" ")[0] || "there"}
            </span>
          </span>
        }
        description={
          isLoading
            ? undefined
            : totalActive > 0
              ? `You have ${totalActive} active event${totalActive !== 1 ? "s" : ""} in progress.`
              : "No active events right now. Create one to get started."
        }
        actions={
          canCreateEvent ? (
            <Button
              size="sm"
              onClick={onCreateEvent}
              className="bg-brand hover:bg-brand/90 font-bold"
            >
              <Plus className="h-4 w-4 mr-1" aria-hidden="true" /> New Event
            </Button>
          ) : undefined
        }
      />

      <PageBody className="space-y-5 sm:space-y-7 bg-bg/30 min-h-[calc(100vh-10rem)] rounded-xl p-3 sm:p-6 border border-border/40">
        <OwnerSetupChecklist config={setupQuery.data?.config as any} />
        {managerChecklistVisible && (
          <ManagerOnboardingChecklist
            onDismiss={() => {
              localStorage.removeItem("wvi_manager_onboarding_checklist");
              setManagerChecklistVisible(false);
            }}
          />
        )}
        <OnboardingGoLiveChecklist userConfig={userConfig} orgId={orgId} />

        {canApproveLayouts && <Card><CardHeader><CardTitle>Venue layout approval queue</CardTitle><CardDescription>Risk-first review requests and pending layouts, then upcoming event date.</CardDescription></CardHeader><CardContent className="space-y-2"><label className="flex items-center gap-2 text-xs text-fg-muted"><input type="checkbox" checked={approvalRiskOnly} onChange={(e) => setApprovalRiskOnly(e.target.checked)} /> Show operational risk only</label>{approvalQueueQuery.data?.items?.length ? approvalQueueQuery.data.items.filter((item: any) => !approvalRiskOnly || item.open_comments > 0 || item.pending_reviews > 0).map((item: any) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-3 text-sm"><div><strong>{item.event_title || item.name}</strong><p className="text-xs text-fg-muted">{item.start_date || 'Date needed'} · {item.venue_name || 'No space'} · {item.requester_email || 'No requester'} · {item.open_comments} open comment(s) · {item.pending_reviews} review request(s)</p></div><div className="flex gap-2"><Button size="xs" variant="outline" onClick={() => { window.location.hash = `#/events/${item.event_id}?tab=layout`; }}>Open review</Button><Button size="xs" onClick={async () => { if (!(await askConfirm({ title: `Approve ${item.event_title || item.name}?` }))) return; try { await sdk.layouts.queueDecision(item.id, { decision: 'approved' }); await approvalQueueQuery.refetch(); toast({ title: 'Layout approved', variant: 'success' }); } catch (err: any) { toast({ title: 'Could not approve layout', description: err?.message || 'Please try again.', variant: 'destructive' }); } }}>Approve</Button><Button size="xs" variant="outline" onClick={async () => { const note = await ask({ title: 'Request layout changes', label: 'Describe the changes required', multiline: true, required: true }); if (!note?.trim()) return; try { await sdk.layouts.queueDecision(item.id, { decision: 'changes_requested', note }); await approvalQueueQuery.refetch(); toast({ title: 'Changes requested', variant: 'success' }); } catch (err: any) { toast({ title: 'Could not request changes', description: err?.message || 'Please try again.', variant: 'destructive' }); } }}>Request changes</Button></div></div>) : <EmptyState icon={<CheckSquare className="h-6 w-6" />} title="No layouts awaiting approval" description="When couples or planners submit a layout for review, it shows up here with open comments and risk flags." className="py-8" />}</CardContent></Card>}

        {isManager && (
          <>
          <Card><CardHeader><div className="flex items-center justify-between gap-2"><div><CardTitle>Venue space calendar</CardTitle><CardDescription>Space commitments and capacity context for active bookings.</CardDescription></div><div className="flex items-center gap-2"><Button size="xs" variant="outline" onClick={() => setSpaceCalendarMonthOffset((value) => value - 1)}>Previous</Button><span className="text-sm font-medium">{new Date(spaceCalendarRange.start).toLocaleString(undefined, { month: 'long', year: 'numeric' })}</span><Button size="xs" variant="outline" onClick={() => setSpaceCalendarMonthOffset((value) => value + 1)}>Next</Button></div></div></CardHeader><CardContent>{spaceCalendarQuery.isLoading ? <p className="text-sm text-fg-muted">Loading space calendar…</p> : <div className="space-y-3">{spaceCalendarQuery.data?.calendar.commitments.length ? <><SpaceCalendarGrid start={spaceCalendarRange.start} commitments={spaceCalendarQuery.data.calendar.commitments} conflictedIds={conflictedEventIds(spaceCalendarQuery.data.calendar.commitments)} onOpen={(eventId) => { window.location.hash = `#/events/${eventId}`; }} /><div className="space-y-2">{spaceCalendarQuery.data.calendar.commitments.map((commitment: any) => <div key={commitment.id} className="flex flex-wrap items-center justify-between gap-2 rounded border border-border p-2 text-sm"><div><strong>{commitment.venue_name || 'Space not assigned'}</strong><p className="text-fg-muted">{commitment.title} · {formatDateOnly(commitment.start_date)} · {commitment.guest_count} guests{commitment.venue_capacity ? ` / ${commitment.venue_capacity} capacity` : ''}</p>{commitment.venue_capacity && commitment.guest_count > commitment.venue_capacity && <p className="mt-1 text-xs text-warning">Guest count exceeds this space’s capacity.</p>}{conflictedEventIds(spaceCalendarQuery.data.calendar.commitments).has(commitment.id) && <p className="mt-1 text-xs text-warning">⚠ This space is double-booked for an overlapping date — review before event week.</p>}</div><div className="flex gap-1"><Button size="xs" variant="outline" onClick={() => setSelectedSpaceId(commitment.venue_id)}>Space detail</Button><Button size="xs" variant="outline" onClick={() => { window.location.hash = `#/events/${commitment.id}`; }}>Open event</Button></div></div>)}</div></> : <p className="text-sm text-fg-muted">No space commitments this month.</p>}</div>}{selectedSpaceId && <div className="mt-3 rounded border border-brand/20 bg-brand-soft/10 p-3 text-sm"><div className="flex justify-between"><strong>{spaceDetailQuery.data?.space.name || 'Space detail'}</strong><Button size="xs" variant="ghost" onClick={() => setSelectedSpaceId(null)}>Close</Button></div><p className="mt-1 text-fg-muted">{spaceDetailQuery.data?.space.capacity || 0} capacity · {spaceDetailQuery.data?.space.commitments.length || 0} upcoming commitments · {spaceDetailQuery.data?.space.templates.length || 0} linked templates</p></div>}</CardContent></Card>
          <Card><CardHeader><CardTitle>Event Week communication templates</CardTitle><CardDescription>Venue-approved copy for rain plans, timing, arrival, parking, and guest guidance.</CardDescription></CardHeader><CardContent><div className="flex flex-wrap gap-2">{communicationTemplatesQuery.data?.templates.map((template) => <span key={template.id} className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-sm">{template.name} · {template.audience}<Button size="xs" variant="ghost" onClick={async () => { const body = await ask({ title: `Edit ${template.name} message`, label: 'Message', multiline: true, required: true, defaultValue: template.body }); if (body) updateCommunicationTemplateMutation.mutate({ id: template.id, patch: { body } }); }}>Edit</Button><Button size="xs" variant="ghost" onClick={() => updateCommunicationTemplateMutation.mutate({ id: template.id, patch: { active: !template.active } })}>{template.active ? 'Archive' : 'Activate'}</Button></span>) || <span className="text-sm text-fg-muted">No templates yet.</span>}<Button size="xs" variant="outline" onClick={async () => { const values = await askForm({ title: 'Add a communication template', fields: [{ key: 'name', label: 'Template name', required: true }, { key: 'body', label: 'Message body', multiline: true, required: true }], confirmLabel: 'Add template' }); if (values) createCommunicationTemplateMutation.mutate({ name: values.name, category: 'rain_plan', audience: 'both', subject: values.name, body: values.body }); }}>Add template</Button></div></CardContent></Card>
          <Card className="border-brand/20"><CardHeader><CardTitle>Portfolio readiness</CardTitle><CardDescription>Compare operational readiness across active Seven Paths Manor weddings and open the next blocker.</CardDescription></CardHeader><CardContent>{portfolioReadinessQuery.isLoading ? <p className="text-sm text-fg-muted">Loading portfolio readiness…</p> : <div className="space-y-2">{portfolioReadinessQuery.data?.events.map((event) => <div key={event.id} className="flex flex-wrap items-center justify-between gap-2 rounded border border-border p-3 text-sm"><div><strong>{event.title}</strong><p className="text-fg-muted">{event.status.replace('_', ' ')} · {event.readinessScore}% ready · {event.criticalIssues} critical · {event.warningIssues} warning</p>{event.nextIssue && <p className="mt-1 text-xs text-warning">Next: {event.nextIssue.title}</p>}</div><Button size="xs" variant="outline" onClick={() => { window.location.hash = event.nextIssue?.href || `#/events/${event.id}`; }}>Open next action</Button></div>) || <EmptyState icon={<Activity className="h-6 w-6" />} title="All active events look ready" description="Portfolio readiness compares each active wedding against its operational checks. New issues will appear here." className="py-8" />}</div>}</CardContent></Card>
          <StaffingCalendar data={staffingCalendarQuery.data} isLoading={staffingCalendarQuery.isLoading} monthOffset={staffingCalendarMonthOffset} onMonthChange={setStaffingCalendarMonthOffset} />
          <Card className="border-brand/20"><CardHeader><CardTitle className="flex items-center gap-2"><Users className="h-5 w-5 text-brand" /> Staffing coverage</CardTitle><CardDescription>Cross-event coverage for Seven Paths Manor. Resolve overlaps before event week.</CardDescription></CardHeader><CardContent>{staffingCoverageQuery.isLoading ? <p className="text-sm text-fg-muted">Loading staffing coverage…</p> : <div className="space-y-2">{staffingCoverageQuery.data?.coverage.conflicts.length ? <p className="flex items-center gap-1 text-sm text-warning"><AlertTriangle className="h-4 w-4" /> {staffingCoverageQuery.data.coverage.conflicts.length} overlapping shift{staffingCoverageQuery.data.coverage.conflicts.length === 1 ? '' : 's'} need attention.</p> : <p className="text-sm text-success">No overlapping staff shifts detected.</p>}{staffingCoverageQuery.data?.coverage.conflictDetails?.length ? <div className="rounded border border-warning/30 bg-warning-soft/10 p-2 text-sm"><strong className="text-warning">Resolve overlapping shifts</strong>{staffingCoverageQuery.data.coverage.conflictDetails.map((conflict) => <div key={`${conflict.shiftId}-${conflict.conflictingShiftId}`} className="mt-1 flex flex-wrap items-center justify-between gap-2"><span>{conflict.staffName}: {conflict.eventTitle} overlaps {conflict.conflictingEventTitle}</span>{conflict.eventId && <Button size="xs" variant="outline" onClick={() => { window.location.hash = `#/events/${conflict.eventId}?tab=staff`; }}>Open assignment</Button>}</div>)}</div> : null}
{staffingCoverageQuery.data?.coverage.events.map((coverage) => <div key={coverage.eventId || 'unassigned'} className="flex items-center justify-between gap-2 rounded border border-border p-2 text-sm"><span><strong>{coverage.eventTitle}</strong><span className="ml-2 text-fg-muted">{coverage.shifts.length} shift{coverage.shifts.length === 1 ? '' : 's'} · {coverage.taskCount} task{coverage.taskCount === 1 ? '' : 's'}{coverage.blockedTaskCount ? ` · ${coverage.blockedTaskCount} blocked` : ''}{coverage.missingRoles?.length ? ` · missing ${coverage.missingRoles.join(', ')}` : ''}</span></span><span className="flex items-center gap-2 text-fg-muted">{coverage.staffCount} staff{coverage.eventId && <Button size="xs" variant="outline" onClick={() => { window.location.hash = `#/events/${coverage.eventId}?tab=staff`; }}>Manage</Button>}</span></div>)}{staffingCoverageQuery.data?.coverage.staff?.length ? <div className="mt-3 border-t border-border pt-3"><p className="mb-2 text-xs font-semibold uppercase tracking-wide text-fg-muted">Staff workload</p>{staffingCoverageQuery.data.coverage.staff.map((staff) => <div key={staff.staffId} className="flex justify-between py-1 text-sm"><span>{staff.staffName}</span><span className={staff.conflictCount ? 'text-warning' : 'text-fg-muted'}>{staff.shiftCount} shifts · {staff.eventCount} event{staff.eventCount === 1 ? '' : 's'}{staff.conflictCount ? ` · ${staff.conflictCount} conflict${staff.conflictCount === 1 ? '' : 's'}` : ''}</span></div>)}</div> : null}</div>}</CardContent></Card>
          <ManagerCommandCenter
            events={managerEvents}
            focusEvent={focusEvent}
            todaysEvents={todaysEvents}
            tomorrowEvents={tomorrowEvents}
            staffTasks={staffTasksQuery.data?.tasks ?? []}
            vendors={managerVendorsQuery.data?.vendors ?? []}
            layouts={managerLayoutsQuery.data?.layouts ?? []}
            healthActions={(healthCommandQuery.data as any)?.actions ?? []}
            healthResolved={
              (healthCommandQuery.data as any)?.resolvedActions ?? []
            }
            permissions={{
              canViewGuests,
              canViewVendors,
              canViewStaff,
              canManageStaff,
              canViewAnalytics,
              canViewBudget,
              canViewContracts,
            }}
            syncUpdatedAt={Math.max(
              eventsQuery.dataUpdatedAt,
              staffTasksQuery.dataUpdatedAt,
              managerVendorsQuery.dataUpdatedAt,
              managerLayoutsQuery.dataUpdatedAt,
              healthCommandQuery.dataUpdatedAt,
            )}
          />
          <ManagerBestInClassModules
            events={managerEvents}
            focusEvent={focusEvent}
            staffTasks={staffTasksQuery.data?.tasks ?? []}
            vendors={managerVendorsQuery.data?.vendors ?? []}
            healthActions={(healthCommandQuery.data as any)?.actions ?? []}
          />
          </>
        )}

        {firstEventWalkthrough && (
          <Card className="border-brand/30 bg-brand-soft/20">
            <CardContent className="p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-sm font-bold text-brand flex items-center gap-2">
                  <Sparkles className="h-4 w-4" /> Interactive walkthrough:
                  create your first event
                </h2>
                <p className="text-xs text-fg-muted mt-1">
                  Start a sandbox event, then add guests, vendors, timeline
                  items, and a floorplan. Demo mode is on so this stays separate
                  from real operations.
                </p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={onCreateEvent}>
                  Create sandbox event
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    localStorage.removeItem("wvi_first_event_walkthrough");
                    setFirstEventWalkthrough(false);
                  }}
                >
                  Dismiss
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ── TASK-FIRST OWNER HEADER ── */}
        <div className="bg-surface rounded-2xl p-4 sm:p-5 border border-border shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="space-y-1.5">
            <Badge
              variant="brand"
              className="text-[10px] tracking-widest uppercase px-2.5 py-1 font-bold"
            >
              {branding.platformName}
            </Badge>
            <h1 className="text-xl sm:text-2xl font-bold text-fg tracking-tight">
              Owner command center
            </h1>
            <p className="text-sm text-fg-muted leading-relaxed max-w-2xl">
              Start with what needs attention, what is coming up, what setup
              remains, and what revenue is booked or projected.
            </p>
          </div>
          <div className="flex gap-2 shrink-0 flex-wrap">
            <Button
              variant={tutorialActive ? "default" : "outline"}
              size="sm"
              className={cn(
                "font-bold text-xs h-9",
                tutorialActive
                  ? "bg-brand text-brand-fg"
                  : "border-border/80 text-fg",
              )}
              onClick={() => setTutorialActive(!tutorialActive)}
            >
              {tutorialActive
                ? "Hide beginner guide"
                : "I'm new — show me what to do"}
            </Button>
            <Button
              variant={demoMode ? "default" : "outline"}
              size="sm"
              className="font-bold border-border/80 text-fg"
              onClick={() => setDemoMode(!demoMode)}
            >
              {demoMode
                ? "Using demo learning mode"
                : "Use demo event to learn"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="font-bold border-border/80 text-fg"
              onClick={() => (window.location.hash = "#/calendar")}
            >
              View Calendar
            </Button>
          </div>
        </div>

        {demoMode && (
          <div className="rounded-xl border border-warning/30 bg-warning-soft p-4 text-sm text-warning font-semibold flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <span>
              Demo learning mode is on. Use this only for practice — do not
              treat demo events, guests, or vendors as real operations.
            </span>
            {canCreateEvent && (
              <Button size="sm" variant="outline" onClick={onCreateEvent}>
                Create demo event
              </Button>
            )}
          </div>
        )}

        {setupIncomplete ? <VenueStudioReadiness setupPct={setupPct} canManageVenue={canManageVenue} /> : <OwnerCommandCenter
          isLoading={isLoading}
          todaysEvents={todaysEvents}
          upcomingEvents={upcomingEvents}
          leadHoldCount={leadHoldCount}
          totalActive={totalActive}
          setupPct={setupPct}
          setupIncomplete={setupIncomplete}
          projectedRevenue={projectedRevenue}
          canCreateEvent={canCreateEvent}
          canViewAnalytics={canViewAnalytics}
          canViewGuests={canViewGuests}
          canInviteTeam={canInviteTeam}
          canManageVenue={canManageVenue}
          onCreateEvent={onCreateEvent}
        />}

        {canViewAnalytics &&
          (healthCommandQuery.data?.commandCenter?.actions?.length ?? 0) >
            0 && (
            <Card className="border-warning/30 bg-warning-soft/20">
              <CardContent className="p-4 space-y-3">
                <h2 className="text-sm font-bold text-warning flex items-center gap-2">
                  <Activity className="h-4 w-4" /> Dashboard top 3 health
                  actions
                </h2>
                <div className="grid gap-2 sm:grid-cols-3">
                  {healthCommandQuery
                    .data!.commandCenter.actions.slice(0, 3)
                    .map((action: any) => (
                      <a
                        key={action.id}
                        href={action.href}
                        className="rounded-lg border border-border bg-surface p-3 text-sm hover:border-brand/40"
                      >
                        <div className="text-xs font-bold text-brand uppercase">
                          {action.priority}
                        </div>
                        <div className="mt-1 font-semibold text-fg line-clamp-2">
                          {action.title}
                        </div>
                        <p className="mt-1 text-[11px] text-fg-muted line-clamp-2">
                          {action.fixCta ?? "Fix this"} · {action.confidence}{" "}
                          confidence
                        </p>
                      </a>
                    ))}
                </div>
              </CardContent>
            </Card>
          )}

        <DashboardSectionNav canViewAnalytics={canViewAnalytics} />

        {/* ── START HERE OWNER LAUNCHPAD ── */}
        <section id="setup" className="space-y-4">
          <div className="flex flex-col gap-2 border-b border-border/40 pb-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-sm font-bold text-brand flex items-center gap-2 font-serif">
                <Compass className="h-4 w-4 text-brand" /> Start here
              </h2>
              <p className="text-xs text-fg-muted mt-1">
                Follow these steps to get your venue workspace ready for real
                weddings.
              </p>
            </div>
            <span className="text-[10px] text-brand font-bold uppercase bg-brand-soft/40 px-2.5 py-0.5 rounded-full border border-brand/20 flex items-center gap-1 w-fit">
              <Sparkles className="h-3.5 w-3.5" />{" "}
              {setupIncomplete ? "Setup in progress" : "Setup complete"}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
            <OwnerActionCard
              href="#/system/platform"
              icon={<Palette className="h-5 w-5" />}
              title="Set up your venue brand"
              description="Add your name, colors, logo, and support details so every portal feels like your venue."
              cta="Open branding"
              help="This controls what owners, planners, vendors, couples, and guests see across the platform."
              tutorialActive={tutorialActive}
            />
            <OwnerActionCard
              href="#/system/venue"
              icon={<Building2 className="h-5 w-5" />}
              title="Add your spaces and capacities"
              description="Define ceremony, reception, cocktail, backup, lodging, and getting-ready spaces."
              cta="Add spaces"
              help="Capacity and spaces power layout readiness, guest counts, and event-day checks."
              tutorialActive={tutorialActive}
            />
            <OwnerActionCard
              href="#/events"
              icon={<Calendar className="h-5 w-5" />}
              title="Create your first wedding event"
              description="Start with a real event or use a demo event to learn the workflow safely."
              cta="Create event"
              help="Events bring together guests, vendors, budget, contracts, timeline, layout, and portals."
              tutorialActive={tutorialActive}
            />
            {canViewVendors && (
              <OwnerActionCard
                href="#/vendors"
                icon={<Truck className="h-5 w-5" />}
                title="Add your preferred vendors"
                description="Build your vendor directory and invite partners to submit logistics and COIs."
                cta="Add vendors"
                help="Vendor details feed check-in, run-of-show, portal links, and reliability scoring."
                tutorialActive={tutorialActive}
              />
            )}
            <OwnerActionCard
              href="#/system/venue"
              icon={<Layers className="h-5 w-5" />}
              title="Build your first floorplan"
              description="Create a layout template so seating, capacity, and vendor zones are ready."
              cta="Build floorplan"
              help="Layouts unlock seating assignments, readiness checks, and guest/vendor map views."
              tutorialActive={tutorialActive}
            />
          </div>
        </section>

        {/* ── KPI STAT CARD PLATES ── */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 pt-2">
          <StatCard
            label="Active Events"
            value={isLoading ? undefined : totalActive}
            loading={isLoading}
            className="border-border/60 bg-surface shadow-sm font-serif"
            description={
              !isLoading && counts
                ? `${counts.booked ?? 0} booked · ${counts.planning ?? 0} planning`
                : undefined
            }
          />
          <StatCard
            label="Open Leads"
            value={
              isLoading ? undefined : (counts?.lead ?? 0) + (counts?.hold ?? 0)
            }
            loading={isLoading}
            className="border-border/60 bg-surface shadow-sm font-serif"
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
            className="border-border/60 bg-surface shadow-sm font-serif"
            description={!isLoading ? "this year" : undefined}
          />
          {canViewAnalytics ? (
            <StatCard
              label="Median Budget"
              value={
                recsQuery.isLoading
                  ? undefined
                  : rec?.budgetRange.count
                    ? `$${Math.round(rec.budgetRange.median / 100).toLocaleString()}`
                    : "—"
              }
              loading={recsQuery.isLoading}
              className="border-border/60 bg-surface shadow-sm font-serif text-brand"
              description={
                rec?.budgetRange.count
                  ? `from ${rec.budgetRange.count} events`
                  : "Complete events to unlock"
              }
            />
          ) : (
            <StatCard
              label="Cancelled"
              value={isLoading ? undefined : (counts?.cancelled ?? 0)}
              loading={isLoading}
              className="border-border/60 bg-surface shadow-sm font-serif"
              description={!isLoading ? "this year" : undefined}
            />
          )}
        </div>

        {/* ── LOWER SECTION TWO-COLUMN OPERATIONAL GRID ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* ── Today's events ── */}
            {todaysEvents.length > 0 && (
              <section
                id="today"
                aria-labelledby="today-heading"
                className="animate-in fade-in-50 duration-200"
              >
                <h2
                  id="today-heading"
                  className="text-xs font-semibold uppercase tracking-wider text-fg-subtle mb-3 flex items-center gap-2 font-serif"
                >
                  <Clock
                    className="h-4 w-4 text-brand animate-pulse"
                    aria-hidden="true"
                  />
                  Today
                  <Badge variant="warning" className="text-[10px] font-bold">
                    {todaysEvents.length} event
                    {todaysEvents.length !== 1 ? "s" : ""}
                  </Badge>
                </h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {todaysEvents.map((event: any) => (
                    <TodayEventCard
                      key={event.id}
                      event={event}
                      orgId={orgId ?? ""}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* ── Upcoming this week ── */}
            {upcomingEvents.length > 0 && (
              <section id="week" aria-labelledby="upcoming-heading">
                <h2
                  id="upcoming-heading"
                  className="text-xs font-semibold uppercase tracking-wider text-fg-subtle mb-3 flex items-center gap-2 font-serif"
                >
                  <Calendar className="h-4 w-4 text-brand" aria-hidden="true" />
                  Upcoming This Week
                </h2>
                <Card className="border-border/60 bg-surface shadow-sm overflow-hidden">
                  <ul
                    className="divide-y divide-border/60"
                    role="list"
                    aria-label="Upcoming events this week"
                  >
                    {upcomingEvents.map((event: any) => (
                      <li key={event.id} role="listitem">
                        <a
                          href={`#/events/${event.id}`}
                          className="flex items-center justify-between gap-4 px-4 py-3.5 hover:bg-surface/50 transition-colors focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
                          aria-label={`View event: ${event.title}, ${event.start_date ?? "no date"}`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className={`w-2.5 h-2.5 rounded-full shrink-0 ${STATUS_COLORS[event.status] ?? "bg-fg-muted"}`}
                              aria-label={`Status: ${event.status}`}
                            />
                            <div className="min-w-0">
                              <p className="text-xs sm:text-sm font-bold text-fg truncate">
                                {event.title}
                              </p>
                              <p className="text-[11px] text-fg-subtle mt-0.5">
                                {event.start_date
                                  ? (parseDateOnly(event.start_date) ?? new Date(event.start_date)).toLocaleDateString("en-US", {
                                      weekday: "short",
                                      month: "short",
                                      day: "numeric",
                                    })
                                  : "No date set"}
                                {event.guest_count
                                  ? ` · ${event.guest_count} guests`
                                  : ""}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {orgId && (
                              <EventRiskBadge
                                eventId={event.id}
                                orgId={orgId}
                                compact
                              />
                            )}
                            <ExternalLink
                              className="h-3.5 w-3.5 text-fg-subtle opacity-60"
                              aria-hidden="true"
                            />
                          </div>
                        </a>
                      </li>
                    ))}
                  </ul>
                </Card>
              </section>
            )}

            {/* ── Empty state — no events anywhere ── */}
            {!isLoading &&
              !totalActive &&
              todaysEvents.length === 0 &&
              upcomingEvents.length === 0 && (
                <EmptyState
                  icon={<Calendar className="h-6 w-6" />}
                  title="No events yet"
                  description="Start by creating a wedding event. After that you can add guests, vendors, budget items, contracts, a timeline, and a floorplan from one event workspace."
                  recommendedNextStep="Click Create First Event, then use the event workspace tabs from left to right: guests, vendors, timeline, budget, contracts, and layout."
                  action={
                    canCreateEvent ? (
                      <Button size="sm" onClick={onCreateEvent}>
                        <Plus className="h-4 w-4 mr-1" aria-hidden="true" />{" "}
                        Create First Event
                      </Button>
                    ) : undefined
                  }
                />
              )}

            {/* ── Intelligence teaser (only for permitted users with data) ── */}
            {canViewAnalytics && rec && rec.budgetRange.count >= 3 && (
              <section id="intelligence" aria-labelledby="intel-heading">
                <div className="flex items-center justify-between mb-3 border-b border-border/40 pb-1">
                  <h2
                    id="intel-heading"
                    className="text-xs font-semibold uppercase tracking-wider text-fg-subtle flex items-center gap-2 font-serif"
                  >
                    <BarChart3
                      className="h-4 w-4 text-brand"
                      aria-hidden="true"
                    />
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
                    value={rec.guestCountRange.median || "—"}
                    className="border-border/60 bg-surface shadow-sm font-serif"
                    description={
                      rec.guestCountRange.p25
                        ? `${rec.guestCountRange.p25}–${rec.guestCountRange.p75} range`
                        : "from your events"
                    }
                  />
                  {rec.seasonalDemand.length > 0 &&
                    (() => {
                      const peak = rec.seasonalDemand.reduce((a, b) =>
                        a.count > b.count ? a : b,
                      );
                      return (
                        <StatCard
                          label="Peak Season"
                          value={peak.monthName}
                          className="border-border/60 bg-surface shadow-sm font-serif"
                          description={`${peak.count} events (${peak.percentage}% of bookings)`}
                        />
                      );
                    })()}
                  <StatCard
                    label="Top Lead Source"
                    value={
                      rec.leadSourceEffectiveness[0]?.source?.replace(
                        /_/g,
                        " ",
                      ) || "—"
                    }
                    className="border-border/60 bg-surface shadow-sm font-serif"
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

