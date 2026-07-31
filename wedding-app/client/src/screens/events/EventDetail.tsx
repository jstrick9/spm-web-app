import React, { Suspense } from "react";
/**
 * EventDetail — the screen you land on when you click an event.
 *
 * Phase 19 Day 2: RBAC-gated tabs. Each tab requires a specific permission
 * to be visible. Users without the permission never see the tab trigger.
 * If they somehow navigate to it (e.g. URL manipulation), the content
 * renders a "No access" card instead of crashing with a 403.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { LiveOperationsCard } from './LiveOperationsCard';
import {
  Calendar,
  ClipboardList,
  Cog,
  ExternalLink,
  LayoutGrid,
  Link as LinkIcon,
  MapPin,
  MessageCircle,
  Truck,
  Users,
  Copy,
  FileText,
  StickyNote,
  UserRound,
  Archive,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Phone,
  BriefcaseBusiness,
  UploadCloud,
  DownloadCloud,
  Database,
  FileSpreadsheet,
} from "lucide-react";
import { sdk } from "../../sdk";
import { useRouter } from "../../lib/router";
import { PageBody, PageHeader } from "../../ui/AppShell";
import { AccessDenied } from "../../ui/AccessDenied";
import { Badge } from "../../ui/Badge";
import { Button } from "../../ui/Button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "../../ui/Card";
import { cn } from "../../ui/lib/cn";
import { Input } from "../../ui/Input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../ui/Dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../ui/Tabs";
import { Skeleton } from "../../ui/Skeleton";
import { useToast } from "../../ui/Toast";
import { StatCard } from "../../ui/StatCard";
import { WidgetSlot } from "../../config/widgets/WidgetSlot";
import { EventProgressCard } from "./EventProgressCard";
import { EventRiskCard } from "./EventRiskCard";
import { EventQuickSwitcher } from "./EventQuickSwitcher";
import { StatusBadge } from "./statusMeta";
import {
  BarChart,
  Mail,
  DollarSign,
  Printer,
  FileSignature,
  ImageIcon,
  ScanLine,
  ClipboardCheck,
  CalendarPlus,
  ShieldAlert,
  Activity,
  Smartphone,
  MessageSquare,
} from "lucide-react";

// Event workspace tabs are lazy-loaded so opening an event doesn't eagerly
// download every operational module (guests, budget, contracts, gallery, etc.).
const EventGuestsTab = React.lazy(() =>
  import("./guests/EventGuestsTab").then((m) => ({
    default: m.EventGuestsTab,
  })),
);
const EventEmergencyTab = React.lazy(() =>
  import("./emergency/EventEmergencyTab").then((m) => ({
    default: m.EventEmergencyTab,
  })),
);
const CanvasPage = React.lazy(() =>
  import("./layouts/CanvasPage").then((m) => ({ default: m.CanvasPage })),
);
const GuestPortalSettingsTab = React.lazy(() =>
  import("./portal/GuestPortalSettingsTab").then((m) => ({
    default: m.GuestPortalSettingsTab,
  })),
);
const EventInvitesTab = React.lazy(() =>
  import("./invites/EventInvitesTab").then((m) => ({
    default: m.EventInvitesTab,
  })),
);
const EventFeedbackTab = React.lazy(() =>
  import("./feedback/EventFeedbackTab").then((m) => ({
    default: m.EventFeedbackTab,
  })),
);
const EventVendorsTab = React.lazy(() =>
  import("./vendors/EventVendorsTab").then((m) => ({
    default: m.EventVendorsTab,
  })),
);
const EventTimelineTab = React.lazy(() =>
  import("./timeline/EventTimelineTab").then((m) => ({
    default: m.EventTimelineTab,
  })),
);
const EventStaffTab = React.lazy(() =>
  import("./staff/EventStaffTab").then((m) => ({ default: m.EventStaffTab })),
);
const ChatSystem = React.lazy(() =>
  import("./chat/ChatSystem").then((m) => ({ default: m.ChatSystem })),
);
const EventBudgetTab = React.lazy(() =>
  import("./budget/EventBudgetTab").then((m) => ({
    default: m.EventBudgetTab,
  })),
);
const EventContractsTab = React.lazy(() =>
  import("./contracts/EventContractsTab").then((m) => ({
    default: m.EventContractsTab,
  })),
);
const EventGalleryTab = React.lazy(() =>
  import("./gallery/EventGalleryTab").then((m) => ({
    default: m.EventGalleryTab,
  })),
);
const EventSettingsForm = React.lazy(() =>
  import("./settings/EventSettingsForm").then((m) => ({
    default: m.EventSettingsForm,
  })),
);
import { usePermissions } from "../../lib/usePermission";
import { useEffect, useState, useMemo, type ReactNode } from "react";

interface Props {
  eventId: string;
}

import { ACTION_PERMISSIONS, TAB_DEFS, type EventDetailPermission, type TabDef, type TabGroup, type TabId } from './eventTabConfig';

import { eventReadinessScore, eventSetupItems, safeMetadata } from './eventDetailUtils';

import { MANAGER_TAB_HELP, missingCountForTab } from './eventDetailGuidance';

export function EventDetail({ eventId, user }: Props & { user: any }) {
  const { navigate, query } = useRouter();
  const initialTab = (query.get("tab") as TabId | null) ?? "overview";
  const [tab, setTab] = useState<TabId>(initialTab);
  const [mobileTabsEnabled, setMobileTabsEnabled] = useState(false);

  useEffect(() => {
    const update = () => setMobileTabsEnabled(window.innerWidth < 768);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  // ── RBAC: check all tab + action permissions at once ──
  const permIds = useMemo(
    () =>
      Array.from(
        new Set([
          ...TAB_DEFS.filter((t) => t.permission).map((t) => t.permission!),
          ...Object.values(ACTION_PERMISSIONS),
          'events.members.invite',
        ]),
      ),
    [],
  );
  const perms = usePermissions(permIds);
  const currentUserQuery = useQuery({ queryKey: ['me', 'event-detail-role'], queryFn: () => sdk.auth.me(), staleTime: 60_000 });
  const isCoupleForEvent = currentUserQuery.data?.memberships?.some((membership: any) => membership.eventId === eventId && membership.roleKey === 'couple') ?? false;
  const hasPermission = (permission: EventDetailPermission | null) =>
    !permission || perms[permission] === true;

  const visibleTabs = useMemo(
    () => TAB_DEFS.filter((t) => hasPermission(t.permission) && (t.id !== 'guests' || isCoupleForEvent)),
    [perms, isCoupleForEvent],
  );

  // If current tab id is invalid, fall back to overview. If it is valid but
  // unauthorized, keep the URL/tab and render AccessDenied in that tab panel.
  useEffect(() => {
    const known = TAB_DEFS.some((t) => t.id === tab);
    if (!known) setTab("overview");
  }, [tab]);

  // Keep tab in URL so refresh + sharing works
  useEffect(() => {
    const sp = new URLSearchParams();
    if (tab !== "overview") sp.set("tab", tab);
    const qs = sp.toString();
    const desired = `/events/${eventId}${qs ? `?${qs}` : ""}`;
    if (window.location.hash.slice(1) !== desired) {
      navigate(desired, { replace: true });
    }
  }, [tab, eventId, navigate]);

  const eventQuery = useQuery({
    queryKey: ["event", eventId],
    queryFn: () => sdk.events.get(eventId),
  });

  const guestsQuery = useQuery({
    queryKey: ["guests", eventId],
    queryFn: () => sdk.guests.list(eventId),
    enabled: perms["guests.view"] === true,
    staleTime: 10_000,
  });

  // ── Phase 33: Duplicate event (hooks must be before conditionals) ──
  const { toast } = useToast();
  const qc = useQueryClient();
  const duplicateMutation = useMutation({
    mutationFn: () => sdk.events.duplicate(eventId),
    onSuccess: (res: any) => {
      qc.invalidateQueries({ queryKey: ["events"] });
      toast({
        title: "Event duplicated!",
        description: `"${res.event.title}" created as a new lead.`,
        variant: "success",
      });
      navigate(`/events/${res.event.id}`);
    },
    onError: () =>
      toast({ title: "Could not duplicate event", variant: "destructive" }),
  });

  if (eventQuery.isLoading) {
    return (
      <>
        <PageHeader title={<Skeleton className="h-7 w-64" />} />
        <PageBody>
          <Skeleton className="h-48" />
        </PageBody>
      </>
    );
  }
  if (eventQuery.isError) {
    return (
      <>
        <PageHeader title="Event not found" />
        <PageBody>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-danger">
                {(eventQuery.error as Error).message}
              </p>
              <Button
                variant="outline"
                className="mt-3"
                onClick={() => navigate("/events")}
              >
                Back to events
              </Button>
            </CardContent>
          </Card>
        </PageBody>
      </>
    );
  }

  const event = eventQuery.data!.event;
  const readinessScore = eventReadinessScore(event, guestsQuery.data?.counts);

  const tabAllowed = (tabId: TabId) => {
    const def = TAB_DEFS.find((t) => t.id === tabId);
    return hasPermission(def?.permission ?? null);
  };
  const guardedTab = (tabId: TabId, children: ReactNode) => {
    const def = TAB_DEFS.find((t) => t.id === tabId);
    return tabAllowed(tabId) ? (
      children
    ) : (
      <TabAccessDenied feature={def?.label ?? tabId} />
    );
  };

  return (
    <>
      <PageHeader
        backHref="#/events"
        title={
          <span className="flex items-center gap-3 flex-wrap">
            <span className="font-display">{event.title}</span>
            <StatusBadge status={event.status} />
            <span className="inline-flex items-center gap-1 rounded-full border border-border bg-surface px-2.5 py-1 text-xs font-bold text-brand">
              <Activity className="h-3.5 w-3.5" /> Readiness {readinessScore}%
            </span>
            <EventQuickSwitcher
              currentEventId={eventId}
              orgId={event.organization_id}
            />
          </span>
        }
        description={
          <span className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            {event.start_date && (
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                {event.start_date}
                {event.end_date && event.end_date !== event.start_date
                  ? ` – ${event.end_date}`
                  : ""}
              </span>
            )}
            {event.guest_count > 0 && (
              <span className="inline-flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" />
                {event.guest_count} guests expected
              </span>
            )}
            {event.budget_cents !== null && (
              <span>
                Budget: ${(event.budget_cents / 100).toLocaleString()}
              </span>
            )}
          </span>
        }
        actions={
          <>
            {perms[ACTION_PERMISSIONS.guestPortal] === true && (
              <a href={`#/portal/${eventId}`} target="_blank" rel="noreferrer">
                <Button variant="outline">
                  <ExternalLink className="h-3.5 w-3.5" />
                  View guest portal
                </Button>
              </a>
            )}
            {perms[ACTION_PERMISSIONS.runSheet] === true && (
              <a
                href={`#/events/${eventId}/run-sheet`}
                target="_blank"
                rel="noreferrer"
              >
                <Button variant="outline">
                  <Printer className="h-3.5 w-3.5 mr-1" />
                  Print Run Sheet
                </Button>
              </a>
            )}
            {(perms[ACTION_PERMISSIONS.runSheet] === true ||
              perms[ACTION_PERMISSIONS.vendorCheckIn] === true) && (
              <a
                href={
                  perms[ACTION_PERMISSIONS.vendorCheckIn] === true
                    ? `#/events/${eventId}/check-in`
                    : `#/events/${eventId}/run-sheet`
                }
                target="_blank"
                rel="noreferrer"
              >
                <Button variant="default" className="min-h-10">
                  <Smartphone className="h-3.5 w-3.5 mr-1" />
                  Day-of Mode
                </Button>
              </a>
            )}
            {perms[ACTION_PERMISSIONS.calendarExport] === true && (
              <a href={`/api/events/${eventId}/export.ics`} download>
                <Button variant="outline">
                  <CalendarPlus className="h-3.5 w-3.5 mr-1" />
                  Add to Calendar
                </Button>
              </a>
            )}
            {perms[ACTION_PERMISSIONS.duplicate] === true && (
              <Button
                variant="outline"
                onClick={() => duplicateMutation.mutate()}
                isLoading={duplicateMutation.isPending}
              >
                <Copy className="h-3.5 w-3.5 mr-1" />
                Duplicate
              </Button>
            )}
            {perms[ACTION_PERMISSIONS.vendorCheckIn] === true && (
              <a
                href={`#/events/${eventId}/check-in`}
                target="_blank"
                rel="noreferrer"
              >
                <Button variant="default">
                  <ScanLine className="h-3.5 w-3.5 mr-1" />
                  Vendor Check-In
                </Button>
              </a>
            )}
          </>
        }
      />

      <PageBody className="space-y-6">
        <Tabs
          value={tab}
          onValueChange={(v) => setTab(v as TabId)}
          className="print:hidden"
        >
          {mobileTabsEnabled && (
            <div className="md:hidden rounded-xl border border-border bg-surface p-3 shadow-sm">
              <label
                htmlFor="event-mobile-tab"
                className="text-xs font-bold uppercase tracking-wider text-fg-subtle"
              >
                Event workspace section
              </label>
              <select
                id="event-mobile-tab"
                className="mt-2 h-12 w-full rounded-lg border border-border bg-bg px-3 text-base font-semibold text-fg"
                value={tab}
                onChange={(event) => setTab(event.target.value as TabId)}
              >
                {(
                  [
                    "Planning",
                    "Guests",
                    "Vendors",
                    "Financials",
                    "Operations",
                    "Portals",
                  ] as TabGroup[]
                ).map((group) => {
                  const groupTabs = visibleTabs.filter(
                    (item) => item.group === group,
                  );
                  if (groupTabs.length === 0) return null;
                  return (
                    <optgroup key={group} label={group}>
                      {groupTabs.map((item) => {
                        const missing = missingCountForTab(
                          item.id,
                          event,
                          guestsQuery.data?.counts,
                        );
                        return (
                          <option key={item.id} value={item.id}>
                            {item.label}
                            {missing > 0
                              ? ` · ${missing} setup item${missing === 1 ? "" : "s"}`
                              : ""}
                          </option>
                        );
                      })}
                    </optgroup>
                  );
                })}
              </select>
            </div>
          )}
          <div className="relative hidden md:block">
            <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-surface to-transparent pointer-events-none z-10 md:hidden" />
            <TabsList
              className="overflow-x-auto scrollbar-none"
              aria-label="Event detail sections"
            >
              {(
                [
                  "Planning",
                  "Guests",
                  "Vendors",
                  "Financials",
                  "Operations",
                  "Portals",
                ] as TabGroup[]
              ).map((group) => {
                const groupTabs = visibleTabs.filter((t) => t.group === group);
                if (groupTabs.length === 0) return null;
                return (
                  <React.Fragment key={group}>
                    <span className="px-2 text-[10px] font-bold uppercase tracking-wide text-fg-subtle self-center">
                      {group} group
                    </span>
                    {groupTabs.map((t) => {
                      const missing = missingCountForTab(
                        t.id,
                        event,
                        guestsQuery.data?.counts,
                      );
                      return (
                        <TabsTrigger
                          key={t.id}
                          value={t.id}
                          title={t.description}
                        >
                          {t.icon}
                          {t.label}
                          {missing > 0 && (
                            <span
                              className="ml-1 rounded-full bg-warning-soft px-1.5 text-[10px] font-bold text-warning"
                              aria-label={`${missing} missing required setup item${missing === 1 ? "" : "s"}`}
                            >
                              {missing}
                            </span>
                          )}
                        </TabsTrigger>
                      );
                    })}
                  </React.Fragment>
                );
              })}
            </TabsList>
          </div>
          <div className="mt-2 rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs text-fg-muted space-y-2">
            <p>
              {TAB_DEFS.find((t) => t.id === tab)?.description ??
                "Event workspace section."}
            </p>
            <div className="rounded-lg border border-brand/10 bg-brand-soft/20 p-2 text-brand">
              <strong>Venue manager responsibility:</strong>{" "}
              {MANAGER_TAB_HELP[tab].responsibility}
              <a
                href={MANAGER_TAB_HELP[tab].href}
                className="ml-2 font-bold underline"
              >
                {MANAGER_TAB_HELP[tab].example}
              </a>
            </div>
          </div>

          <Suspense fallback={<EventTabFallback />}>
            <TabsContent value="overview">
              <OverviewTab
                eventId={eventId}
                event={event}
                counts={guestsQuery.data?.counts}
                canInviteCouple={perms['events.members.invite'] === true}
                canAccessSetupPacket={currentUserQuery.data?.memberships?.some((membership: any) => (membership.organizationId === event.organization_id || membership.eventId === eventId) && ['owner', 'admin', 'manager', 'staff', 'planner'].includes(String(membership.roleKey).toLowerCase())) ?? false}
              />
            </TabsContent>
            <TabsContent value="guests">
              {isCoupleForEvent ? guardedTab("guests", <EventGuestsTab eventId={eventId} />) : <AccessDenied feature="Couple guest management" />}
            </TabsContent>
            <TabsContent value="invites">
              {guardedTab("invites", <EventInvitesTab eventId={eventId} />)}
            </TabsContent>
            <TabsContent value="feedback">
              {guardedTab("feedback", <EventFeedbackTab eventId={eventId} />)}
            </TabsContent>
            <TabsContent value="timeline">
              {guardedTab(
                "timeline",
                <EventTimelineTab
                  eventId={eventId}
                  organizationId={event.organization_id}
                />,
              )}
            </TabsContent>
            <TabsContent value="vendors">
              {guardedTab(
                "vendors",
                <EventVendorsTab
                  eventId={eventId}
                  organizationId={event.organization_id}
                />,
              )}
            </TabsContent>
            <TabsContent value="budget">
              {guardedTab(
                "budget",
                <EventBudgetTab
                  eventId={eventId}
                  organizationId={event.organization_id}
                />,
              )}
            </TabsContent>
            <TabsContent value="contracts">
              {guardedTab("contracts", <EventContractsTab eventId={eventId} />)}
            </TabsContent>
            <TabsContent value="gallery">
              {guardedTab("gallery", <EventGalleryTab eventId={eventId} />)}
            </TabsContent>
            <TabsContent value="staff">
              {guardedTab(
                "staff",
                <EventStaffTab
                  eventId={eventId}
                  organizationId={event.organization_id}
                />,
              )}
            </TabsContent>
            <TabsContent value="chat">
              {guardedTab(
                "chat",
                <ChatSystem eventId={eventId} currentUser={user} />,
              )}
            </TabsContent>
            <TabsContent value="layout">
              {guardedTab("layout", <CanvasPage event={event} />)}
            </TabsContent>
            <TabsContent value="portal">
              {guardedTab(
                "portal",
                <GuestPortalSettingsTab eventId={eventId} />,
              )}
            </TabsContent>
            <TabsContent value="emergency">
              {guardedTab("emergency", <EventEmergencyTab eventId={eventId} />)}
            </TabsContent>
            <TabsContent value="settings">
              {guardedTab("settings", <EventSettingsForm eventId={eventId} />)}
            </TabsContent>
          </Suspense>
        </Tabs>
      </PageBody>
    </>
  );
}

function EventTabFallback() {
  return (
    <div className="rounded-card border border-border bg-surface p-8 text-center text-sm text-fg-muted">
      Loading event section…
    </div>
  );
}

function TabAccessDenied({ feature }: { feature: string }) {
  return <AccessDenied feature={feature} className="min-h-[280px]" />;
}

// ─── Overview tab ──────────────────────────────────────────
function OverviewTab({
  eventId,
  event,
  counts,
  canInviteCouple,
  canAccessSetupPacket,
}: {
  eventId: string;
  event: any;
  canInviteCouple?: boolean;
  canAccessSetupPacket?: boolean;
  counts?: {    pending: number;
    attending: number;
    declined: number;
    maybe: number;
  };
}) {
  const total = counts
    ? counts.pending + counts.attending + counts.declined + counts.maybe
    : 0;
  const responseRate =
    total > 0
      ? Math.round(
          ((counts!.attending + counts!.declined + counts!.maybe) / total) *
            100,
        )
      : 0;
  const metadata = safeMetadata(event.metadata);
  const setupItems = eventSetupItems(event, counts);
  const readinessScore = eventReadinessScore(event, counts);
  const nextItems = setupItems.filter((i) => !i.done).slice(0, 4);
  const [setupWizardOpen, setSetupWizardOpen] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [ownerName, setOwnerName] = useState(
    metadata.assignment?.ownerName ?? "",
  );
  const [plannerName, setPlannerName] = useState(
    metadata.assignment?.plannerName ?? "",
  );
  const [docName, setDocName] = useState("");
  const [docUrl, setDocUrl] = useState("");
  const [managerNoteText, setManagerNoteText] = useState("");
  const [escalationText, setEscalationText] = useState("");
  const qc = useQueryClient();
  const { toast } = useToast();
  const [coupleEmail, setCoupleEmail] = useState("");
  const coupleInvitationsQuery = useQuery({ queryKey: ['couple-invitations', eventId], queryFn: () => sdk.roles.listCoupleInvitations(eventId), enabled: !!canInviteCouple, staleTime: 30_000 });
  const inviteCouple = useMutation({ mutationFn: () => sdk.roles.inviteEventMember(eventId, { email: coupleEmail, roleKey: 'couple' }), onSuccess: () => { setCoupleEmail(""); qc.invalidateQueries({ queryKey: ['couple-invitations', eventId] }); toast({ title: 'Couple workspace invitation sent', description: 'The couple can access only their wedding workspace and guest management.', variant: 'success' }); }, onError: (e: any) => toast({ title: 'Could not send couple invitation', description: e.message, variant: 'destructive' }) });
  const stageMutation = useMutation({ mutationFn: (status: any) => sdk.events.transitionStage(eventId, status), onSuccess: () => { qc.invalidateQueries({ queryKey: ['event', eventId] }); toast({ title: 'Event stage updated', variant: 'success' }); }, onError: (e: any) => toast({ title: 'Could not update event stage', description: e.message, variant: 'destructive' }) });
  const finalReviewQuery = useQuery({ queryKey: ['final-review', eventId], queryFn: () => sdk.events.finalReview(eventId), enabled: !!canInviteCouple });
  const finalReviewCheckMutation = useMutation({ mutationFn: ({ key, complete }: { key: 'confirmed_guest_count' | 'staffing_readiness' | 'inventory_readiness' | 'accessibility_checks' | 'rain_plan_checks'; complete: boolean }) => sdk.events.setFinalReviewCheck(eventId, key, complete), onSuccess: () => { qc.invalidateQueries({ queryKey: ['final-review', eventId] }); qc.invalidateQueries({ queryKey: ['event', eventId] }); toast({ title: 'Final Review confirmation saved', variant: 'success' }); }, onError: (err: any) => toast({ title: 'Could not save confirmation', description: err?.message || 'Please try again.', variant: 'destructive' }) });
  const finalReviewChangesQuery = useQuery({ queryKey: ['final-review-changes', eventId], queryFn: () => sdk.events.finalReviewChangeRequests(eventId), enabled: !!canInviteCouple });
  const finalReviewDecisionMutation = useMutation({ mutationFn: ({ requestId, status, note }: { requestId: string; status: 'accepted' | 'declined' | 'resolved'; note?: string }) => sdk.events.decideFinalReviewChange(eventId, requestId, status, note), onSuccess: () => { qc.invalidateQueries({ queryKey: ['final-review-changes', eventId] }); toast({ title: 'Final Review request updated', variant: 'success' }); }, onError: (err: any) => toast({ title: 'Could not update request', description: err?.message || 'Please try again.', variant: 'destructive' }) });
  const setupPacketQuery = useQuery({ queryKey: ['event-setup-packet', eventId], queryFn: () => sdk.timeline.setupPacket(eventId), enabled: !!canAccessSetupPacket });
  const communicationTemplatesQuery = useQuery({ queryKey: ['communication-templates', event.organization_id], queryFn: () => sdk.events.communicationTemplates(event.organization_id), enabled: !!canInviteCouple });
  const dayOfContactQuery = useQuery({ queryKey: ['day-of-contact-manager', eventId], queryFn: () => sdk.events.dayOfContact(eventId), enabled: !!canInviteCouple });
  const dayOfContactMutation = useMutation({ mutationFn: (contact: { name: string; phone?: string; email?: string; hours?: string; escalation?: string }) => sdk.events.setDayOfContact(eventId, contact), onSuccess: () => { qc.invalidateQueries({ queryKey: ['day-of-contact-manager', eventId] }); toast({ title: 'Day-of contact saved', variant: 'success' }); } });
  const coupleUpdateSummaryQuery = useQuery({ queryKey: ['couple-update-summary', eventId], queryFn: () => sdk.events.coupleUpdateSummary(eventId), enabled: !!canInviteCouple });
  const publishCoupleUpdateMutation = useMutation({ mutationFn: (input: { templateId?: string; title: string; body: string; category: string; critical?: boolean }) => sdk.events.publishCoupleUpdate(eventId, input), onSuccess: () => toast({ title: 'Event Week update published to the couple', variant: 'success' }), onError: (error: any) => toast({ title: 'Could not publish update', description: error?.message || 'Please try again.', variant: 'destructive' }) });

  const liveOperationsQuery = useQuery({ queryKey: ['live-operations', eventId], queryFn: () => sdk.events.liveOperations(eventId), enabled: !!canInviteCouple, refetchInterval: event.status === 'final_review' ? 30_000 : false });

  const orgId = event.organization_id;
  const healthQuery = useQuery({
    queryKey: ["health-command-center", orgId, "event-detail-manager"],
    queryFn: () => sdk.healthCommand.get(orgId),
    enabled: !!orgId,
    staleTime: 60_000,
  });
  const staffTasksQuery = useQuery({
    queryKey: ["staffTasks", eventId, "manager-home"],
    queryFn: () => sdk.staff.listTasks(orgId, { eventId }),
    enabled: !!orgId,
    staleTime: 30_000,
  });
  const vendorsQuery = useQuery({
    queryKey: ["vendors", eventId, "manager-home"],
    queryFn: () => sdk.vendors.list(orgId, { eventId }),
    enabled: !!orgId,
    staleTime: 30_000,
  });
  const venueGuestManifestQuery = useQuery({
    queryKey: ["venue-guest-manifest", eventId],
    queryFn: () => sdk.guests.venueManifest(eventId),
    enabled: !!eventId,
    staleTime: 30_000,
  });
  const layoutsQuery = useQuery({
    queryKey: ["layouts", eventId, "manager-home"],
    queryFn: () => sdk.layouts.list(orgId, { eventId }),
    enabled: !!orgId,
    staleTime: 30_000,
  });
  const workloadQuery = useQuery({
    queryKey: ["events", orgId, "manager-cross-workload"],
    queryFn: () => sdk.events.list(orgId, { limit: 25 }),
    enabled: !!orgId,
    staleTime: 60_000,
  });

  const updateMetadata = useMutation({
    mutationFn: (patch: Record<string, any>) =>
      sdk.events.update(eventId, { metadata: { ...metadata, ...patch } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["event", eventId] });
      toast({ title: "Event workspace updated", variant: "success" });
    },
    onError: (err: any) =>
      toast({
        title: "Could not update event",
        description: err.message,
        variant: "destructive",
      }),
  });

  const notes = Array.isArray(metadata.internalNotes)
    ? metadata.internalNotes
    : [];
  const managerNotes = Array.isArray(metadata.managerNotes)
    ? metadata.managerNotes
    : [];
  const escalationLog = Array.isArray(metadata.managerEscalations)
    ? metadata.managerEscalations
    : [];
  const documents = Array.isArray(metadata.documents) ? metadata.documents : [];
  const staffTasks = staffTasksQuery.data?.tasks ?? [];
  const vendors = vendorsQuery.data?.vendors ?? [];
  const layouts = layoutsQuery.data?.layouts ?? [];
  const healthActions = ((healthQuery.data as any)?.actions ?? [])
    .filter(
      (action: any) =>
        !["resolved", "snoozed"].includes(String(action.state?.status ?? "")),
    )
    .slice(0, 5);
  const workloadEvents = workloadQuery.data?.events ?? [];
  const openStaffTasks = staffTasks.filter(
    (task: any) => task.status !== "completed",
  );
  const vendorExceptions = vendors.filter(
    (vendor: any) =>
      !vendor.phone ||
      /missing|expired|risk/i.test(
        `${vendor.coi_status ?? ""} ${safeMetadata(vendor.metadata).coiStatus ?? ""}`,
      ),
  );
  const layoutReady = layouts.some(
    (layout: any) => layout.approval_status === "approved",
  );
  const daysUntil = event.start_date
    ? Math.ceil((new Date(event.start_date).getTime() - Date.now()) / 86400000)
    : null;
  const eventWeekMode =
    daysUntil !== null &&
    daysUntil >= 0 &&
    daysUntil <= 7 &&
    event.status !== "completed";
  const postEventCloseoutMode =
    event.status === "completed" || metadata.operationalStatus === "closeout";

  const activity = [
    {
      label: "Event created",
      date: event.created_at,
      icon: <Calendar className="h-3.5 w-3.5" />,
    },
    event.start_date
      ? {
          label: "Event date set",
          date: event.start_date,
          icon: <CalendarPlus className="h-3.5 w-3.5" />,
        }
      : null,
    metadata.tourDate
      ? {
          label: "Tour scheduled",
          date: metadata.tourDate,
          icon: <Users className="h-3.5 w-3.5" />,
        }
      : null,
    metadata.proposalDueDate
      ? {
          label: "Proposal/quote due",
          date: metadata.proposalDueDate,
          icon: <FileSignature className="h-3.5 w-3.5" />,
        }
      : null,
    metadata.followUpDate
      ? {
          label: "Follow-up reminder",
          date: metadata.followUpDate,
          icon: <ClipboardList className="h-3.5 w-3.5" />,
        }
      : null,
    metadata.depositDueDate
      ? {
          label: "Deposit/payment due",
          date: metadata.depositDueDate,
          icon: <DollarSign className="h-3.5 w-3.5" />,
        }
      : null,
  ].filter(Boolean) as Array<{ label: string; date: string; icon: ReactNode }>;

  function addNote() {
    if (!noteText.trim()) return;
    updateMetadata.mutate({
      internalNotes: [
        ...notes,
        {
          id: `note-${Date.now()}`,
          body: noteText.trim(),
          createdAt: new Date().toISOString(),
        },
      ],
    });
    setNoteText("");
  }

  function addManagerNote() {
    if (!managerNoteText.trim()) return;
    updateMetadata.mutate({
      managerNotes: [
        ...managerNotes,
        {
          id: `manager-note-${Date.now()}`,
          body: managerNoteText.trim(),
          createdAt: new Date().toISOString(),
        },
      ],
    });
    setManagerNoteText("");
  }

  function addEscalation() {
    if (!escalationText.trim()) return;
    updateMetadata.mutate({
      managerEscalations: [
        ...escalationLog,
        {
          id: `escalation-${Date.now()}`,
          body: escalationText.trim(),
          status: "open",
          createdAt: new Date().toISOString(),
        },
      ],
    });
    setEscalationText("");
  }

  function saveAssignment() {
    updateMetadata.mutate({
      assignment: {
        ownerName: ownerName.trim(),
        plannerName: plannerName.trim(),
      },
    });
  }

  function addDocument() {
    if (!docName.trim() || !docUrl.trim()) return;
    updateMetadata.mutate({
      documents: [
        ...documents,
        {
          id: `doc-${Date.now()}`,
          name: docName.trim(),
          url: docUrl.trim(),
          createdAt: new Date().toISOString(),
        },
      ],
    });
    setDocName("");
    setDocUrl("");
  }

  return (
    <div className="space-y-6">
      {canInviteCouple && <Card><CardHeader><CardTitle>Venue event stage</CardTitle><CardDescription>Seven Paths Manor controls formal event stages. Couple planning begins after the event is booked.</CardDescription></CardHeader><CardContent className="flex flex-wrap items-center gap-2"><Badge variant="brand">Current: {event.status}</Badge><select aria-label="Venue event stage" className="h-9 rounded border border-border bg-surface px-2 text-sm" value={event.status} onChange={(e) => stageMutation.mutate(e.target.value)} disabled={stageMutation.isPending}><option value="lead">Lead</option><option value="hold">Hold</option><option value="booked">Booked</option><option value="planning">Planning</option><option value="final_review">Final Review</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option><option value="lost">Lost</option></select>{event.status === 'booked' && <span className="text-xs text-brand">Next: invite the couple and select a venue template.</span>}</CardContent></Card>}
      {canInviteCouple && <Card className="border-warning/30"><CardHeader><CardTitle>Final Review readiness</CardTitle><CardDescription>All operational checks must be complete before Seven Paths Manor can move this event into Final Review.</CardDescription></CardHeader><CardContent>{finalReviewQuery.isLoading ? <p className="text-sm text-fg-muted">Checking operational readiness…</p> : <div className="space-y-2"><Badge variant={finalReviewQuery.data?.finalReview.ready ? 'success' : 'warning'}>{finalReviewQuery.data?.finalReview.ready ? 'Ready for Final Review' : 'Operational items remain'}</Badge><div className="grid gap-2 sm:grid-cols-2">{finalReviewQuery.data?.finalReview.checks.map((check) => <div key={check.key} className="flex items-center justify-between gap-2 rounded border border-border px-2 py-1 text-sm"><span className="flex items-center gap-2"><span aria-hidden>{check.complete ? '✓' : '○'}</span><span>{check.label}</span></span>{(['confirmed_guest_count', 'staffing_readiness', 'inventory_readiness', 'accessibility_checks', 'rain_plan_checks'] as const).includes(check.key as any) && <Button size="xs" variant={check.complete ? 'outline' : 'default'} isLoading={finalReviewCheckMutation.isPending} onClick={() => finalReviewCheckMutation.mutate({ key: check.key as 'confirmed_guest_count' | 'staffing_readiness' | 'inventory_readiness' | 'accessibility_checks' | 'rain_plan_checks', complete: !check.complete })}>{check.complete ? 'Reopen' : 'Confirm'}</Button>}</div>)}</div></div>}</CardContent></Card>}
      {canInviteCouple && <Card><CardHeader><CardTitle>Publish couple Event Week update</CardTitle><CardDescription>Use venue-approved copy, then tailor it to this wedding before publishing.</CardDescription></CardHeader><CardContent className="flex flex-wrap gap-2">{communicationTemplatesQuery.data?.templates.filter((template) => template.active).map((template) => <Button key={template.id} size="sm" variant="outline" isLoading={publishCoupleUpdateMutation.isPending} onClick={() => { const body = window.prompt(`Customize ${template.name}`, template.body); if (!body?.trim()) return; publishCoupleUpdateMutation.mutate({ templateId: template.id, title: template.subject, body: body.trim(), category: template.category, critical: window.confirm('Require the couple to acknowledge this update?') }); }}>{template.name}</Button>) || <p className="text-sm text-fg-muted">Create an active venue communication template before publishing an update.</p>}</CardContent></Card>}
      {canInviteCouple && <Card><CardHeader><CardTitle>Day-of contact</CardTitle><CardDescription>Publish the couple-facing Event Week contact and escalation guidance.</CardDescription></CardHeader><CardContent className="flex flex-wrap items-center gap-2 text-sm"><span>{dayOfContactQuery.data?.contact?.name || 'Not configured'}</span><Button size="xs" variant="outline" onClick={() => { const current: any = dayOfContactQuery.data?.contact || {}; const name = window.prompt('Contact name', current.name || ''); if (!name?.trim()) return; const phone = window.prompt('Phone', current.phone || '') || ''; const email = window.prompt('Email', current.email || '') || ''; const hours = window.prompt('Availability hours', current.hours || '') || ''; const escalation = window.prompt('Escalation instructions', current.escalation || '') || ''; dayOfContactMutation.mutate({ name: name.trim(), phone, email, hours, escalation }); }}>Configure</Button></CardContent></Card>}
      {canInviteCouple && <Card><CardHeader><CardTitle>Couple update acknowledgments</CardTitle><CardDescription>Follow up on critical Event Week messages that still need a couple response.</CardDescription></CardHeader><CardContent>{coupleUpdateSummaryQuery.data?.updates.length ? <div className="space-y-1 text-sm">{coupleUpdateSummaryQuery.data.updates.map((update) => <p key={update.id}><strong>{update.title}</strong> · viewed {update.viewed_count}/{coupleUpdateSummaryQuery.data!.coupleCount} · acknowledged {update.acknowledged_count}/{coupleUpdateSummaryQuery.data!.coupleCount}{update.critical && update.acknowledged_count < coupleUpdateSummaryQuery.data!.coupleCount ? <span className="ml-1 text-warning">follow-up needed</span> : null}</p>)}</div> : <p className="text-sm text-fg-muted">No Event Week updates published yet.</p>}</CardContent></Card>}
      {canInviteCouple && <LiveOperationsCard eventId={eventId} board={liveOperationsQuery.data?.board} isLoading={liveOperationsQuery.isLoading} />}
      {canAccessSetupPacket && <Card className="border-brand/20"><CardHeader><CardTitle>Event-week operations packet</CardTitle><CardDescription>Detailed setup information for venue staff and planners. Couples receive a simplified schedule instead.</CardDescription></CardHeader><CardContent>{setupPacketQuery.isLoading ? <p className="text-sm text-fg-muted">Preparing packet…</p> : <div className="grid gap-3 text-sm md:grid-cols-2"><div><strong>Approved layout</strong><p className="text-fg-muted">{setupPacketQuery.data?.packet.layout ? `${setupPacketQuery.data.packet.layout.name} · revision ${setupPacketQuery.data.packet.layout.revision}` : 'No approved layout yet'}</p></div><div><strong>Staffing</strong><p className="text-fg-muted">{setupPacketQuery.data?.packet.staffing?.length ? setupPacketQuery.data.packet.staffing.map((staff) => `${staff.full_name} (${staff.role_key})`).join(', ') : 'No staff assignments yet'}</p></div><div><strong>Timeline</strong><p className="text-fg-muted">{setupPacketQuery.data?.packet.timeline?.length ?? 0} scheduled item(s)</p></div><div><strong>Vendor load-in</strong><p className="text-fg-muted">{setupPacketQuery.data?.packet.vendorLoadIn?.length ? setupPacketQuery.data.packet.vendorLoadIn.map((vendor) => `${vendor.name}${vendor.loadIn ? ` · ${vendor.loadIn}` : ''}`).join('; ') : 'No vendor load-in details yet'}</p></div></div>}</CardContent></Card>}
      {canInviteCouple && <Card><CardHeader><CardTitle>Final Review change requests</CardTitle><CardDescription>Couples, planners, and venue managers may request changes. Venue management records the final decision.</CardDescription></CardHeader><CardContent className="space-y-2">{finalReviewChangesQuery.data?.requests?.length ? finalReviewChangesQuery.data.requests.map((request) => <div key={request.id} className="rounded border border-border p-2 text-sm"><p><strong>{request.requested_role}</strong> · {request.status.replace('_', ' ')}</p><p className="mt-1">{request.detail}</p>{request.manager_note && <p className="mt-1 text-fg-muted">Decision note: {request.manager_note}</p>}{request.status === 'requested' && <div className="mt-2 flex gap-2"><Button size="xs" onClick={() => finalReviewDecisionMutation.mutate({ requestId: request.id, status: 'accepted', note: 'Accepted by venue manager.' })}>Accept</Button><Button size="xs" variant="outline" onClick={() => finalReviewDecisionMutation.mutate({ requestId: request.id, status: 'declined', note: 'Not approved by venue manager.' })}>Decline</Button></div>}</div>) : <p className="text-sm text-fg-muted">No Final Review change requests.</p>}</CardContent></Card>}
      {canInviteCouple && <Card className="border-brand/20 bg-brand-soft/10"><CardHeader><CardTitle>Invite couple to wedding workspace</CardTitle><CardDescription>Couples receive a private wedding hub to manage guests, RSVP, and permitted design proposals. Seven Paths Manor retains venue spaces, inventory, vendors, operations, and final approval.</CardDescription></CardHeader><CardContent className="flex flex-col gap-2 sm:flex-row"><Input aria-label="Couple invitation email" type="email" value={coupleEmail} onChange={(e) => setCoupleEmail(e.target.value)} placeholder="couple@email.com"/><Button disabled={!coupleEmail.trim()} isLoading={inviteCouple.isPending} onClick={() => inviteCouple.mutate()}>Send couple invitation</Button><div className="mt-3 space-y-1 text-xs text-fg-muted">{coupleInvitationsQuery.data?.invitations?.length ? coupleInvitationsQuery.data.invitations.map((invite) => <p key={invite.id}>{invite.email} · {invite.acceptedAt ? 'Accepted' : invite.revokedAt ? 'Revoked' : 'Invitation pending'} · expires {new Date(invite.expiresAt).toLocaleDateString()}</p>) : <p>No couple invitation sent yet.</p>}</div></CardContent></Card>}
      <Card><CardHeader><CardTitle>Guest operations summary</CardTitle><CardDescription>Read-only guest details supplied by the couple for Seven Paths Manor operations. Guest records, invitations, and RSVPs remain couple-managed.</CardDescription></CardHeader><CardContent>{venueGuestManifestQuery.data?.guests?.length ? <div className="space-y-2">{venueGuestManifestQuery.data.guests.slice(0, 8).map((guest: any) => <div key={guest.id} className="flex flex-wrap items-center justify-between gap-2 rounded border border-border p-2 text-sm"><span><strong>{guest.fullName}</strong>{guest.relationship ? ` · ${guest.relationship}` : ''}{guest.bridalParty ? ' · Bridal party' : ''}</span><span className="text-xs text-fg-muted">{guest.tableAssignment ? `Table ${guest.tableAssignment}` : 'Table pending'}{guest.seatAssignment ? ` · Seat ${guest.seatAssignment}` : ''}</span></div>)}<p className="text-xs text-fg-muted">{venueGuestManifestQuery.data.counts?.attending ?? venueGuestManifestQuery.data.guests.length} attending guests · View only</p></div> : <p className="text-sm text-fg-muted">The couple has not shared attending guest details yet.</p>}</CardContent></Card>
      <ManagerEventWorkspaceHome
        event={event}
        counts={counts}
        readinessScore={readinessScore}
        staffTasks={staffTasks}
        vendors={vendors}
        layouts={layouts}
        healthActions={healthActions}
        managerNotes={managerNotes}
        managerNoteText={managerNoteText}
        setManagerNoteText={setManagerNoteText}
        onAddManagerNote={addManagerNote}
        escalationLog={escalationLog}
        escalationText={escalationText}
        setEscalationText={setEscalationText}
        onAddEscalation={addEscalation}
        eventWeekMode={eventWeekMode}
        postEventCloseoutMode={postEventCloseoutMode}
        openStaffTasks={openStaffTasks}
        vendorExceptions={vendorExceptions}
        layoutReady={layoutReady}
        workloadEvents={workloadEvents}
        saving={updateMetadata.isPending}
      />
      <ManagerDataImportExportPanel event={event} guestsCount={total} vendors={vendors} staffTasks={staffTasks} />
      {readinessScore < 80 && (
        <Card className="border-brand/30 bg-brand-soft/20">
          <CardContent className="p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-bold text-brand flex items-center gap-2">
                <Sparkles className="h-4 w-4" /> Start here for this event
              </h2>
              <p className="text-xs text-fg-muted mt-1">
                Complete the required setup checklist, then work through guests,
                vendors, timeline, layout, contracts, and portal readiness.
              </p>
            </div>
            <Button size="sm" onClick={() => setSetupWizardOpen(true)}>
              Open event setup wizard
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard
          label="Readiness score"
          value={`${readinessScore}%`}
          description="Required event setup"
        />
        <StatCard
          label="Guests invited"
          value={total > 0 ? total : "—"}
          description={
            counts
              ? `${counts.attending} attending · ${counts.declined} declined`
              : "Add your first guest"
          }
        />
        <StatCard
          label="RSVP response rate"
          value={total > 0 ? `${responseRate}%` : "—"}
          benchmark={{ label: "Industry avg at this stage", value: "52%" }}
        />
        <StatCard label="Pending RSVPs" value={counts?.pending ?? "—"} />
        <StatCard
          label="Confirmed attending"
          value={counts?.attending ?? "—"}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.35fr_0.65fr]">
        <div className="space-y-6">
          <WhatNextPanel items={nextItems} event={event} />
          <EventSetupChecklistCard
            items={setupItems}
            onOpenWizard={() => setSetupWizardOpen(true)}
          />
          <EventProgressCard eventId={eventId} />
          <div>
            <h3 className="mb-3 text-sm font-medium uppercase tracking-wider text-fg-subtle">
              Intelligence
            </h3>
            <WidgetSlot id="event.detail.intelligence" eventId={eventId} />
          </div>
        </div>
        <div className="space-y-6">
          <EventHealthSidePanel
            eventId={eventId}
            readinessScore={readinessScore}
          />
          <AssignmentCard
            ownerName={ownerName}
            plannerName={plannerName}
            setOwnerName={setOwnerName}
            setPlannerName={setPlannerName}
            onSave={saveAssignment}
            saving={updateMetadata.isPending}
          />
          <ManagerNotesCard
            noteText={managerNoteText}
            setNoteText={setManagerNoteText}
            notes={managerNotes}
            onAdd={addManagerNote}
            saving={updateMetadata.isPending}
          />
          <InternalNotesCard
            noteText={noteText}
            setNoteText={setNoteText}
            notes={notes}
            onAdd={addNote}
            saving={updateMetadata.isPending}
          />
          <DocumentVaultCard
            documents={documents}
            docName={docName}
            docUrl={docUrl}
            setDocName={setDocName}
            setDocUrl={setDocUrl}
            onAdd={addDocument}
            saving={updateMetadata.isPending}
          />
          <ActivityTimelineCard activity={activity} />
        </div>
      </div>

      <EventRiskCard eventId={eventId} />
      <EventSetupWizardDialog
        open={setupWizardOpen}
        onOpenChange={setSetupWizardOpen}
        event={event}
        counts={counts}
        onSave={(patch) => updateMetadata.mutate(patch)}
        saving={updateMetadata.isPending}
      />
    </div>
  );
}

function ManagerDataImportExportPanel({ event, guestsCount, vendors, staffTasks }: { event: any; guestsCount: number; vendors: any[]; staffTasks: any[] }) {
  const [workflow, setWorkflow] = useState<'guests' | 'vendors' | 'timeline' | 'staff'>('guests');
  const [rawImport, setRawImport] = useState('');
  const managerMode = (() => { try { return localStorage.getItem('wvi_registration_role') === 'venue_manager'; } catch { return false; } })();
  if (!managerMode) return null;

  const templateRows: Record<typeof workflow, string[][]> = {
    guests: [['fullName','email','phone','partyName','rsvpStatus','dietaryRestrictions','accessibilityNotes'], ['Jane Smith','jane@example.com','555-0100','Smith Family','pending','Vegetarian','Wheelchair access']],
    vendors: [['name','category','contactName','phone','email','arrivalTime','loadInRoute','coiReceived'], ['DJ Co','Entertainment','Sam Lead','555-0200','dj@example.com','14:00','Dock A','yes']],
    timeline: [['title','category','startsAt','durationMin','assignedContact','phone'], ['Vendor load-in','vendor_arrival','2026-09-12T14:00:00','60','Setup Lead','555-0300']],
    staff: [['title','phase','priority','assigneeName','assigneePhone','radioChannel'], ['Set ceremony chairs','pre-event','high','Setup Lead','555-0400','Ops 1']],
  };
  const templateCsv = templateRows[workflow].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
  const lines = rawImport.trim().split(/\r?\n/).filter(Boolean);
  const headers = lines[0]?.split(',').map(h => h.replace(/"/g, '').trim().toLowerCase()) || [];
  const required: Record<typeof workflow, string[]> = {
    guests: ['fullname'], vendors: ['name'], timeline: ['title','startsat'], staff: ['title','phase'],
  };
  const missing = required[workflow].filter(field => !headers.includes(field.toLowerCase()));
  const duplicateSignals = lines.slice(1).map(line => line.split(',')[0]?.toLowerCase().trim()).filter((value, index, arr) => value && arr.indexOf(value) !== index);
  const operationalWarnings = [
    ...missing.map(field => `Missing required column: ${field}`),
    ...(duplicateSignals.length ? [`Possible duplicate records: ${Array.from(new Set(duplicateSignals)).join(', ')}`] : []),
    ...(workflow === 'vendors' && !headers.includes('arrivaltime') ? ['Vendor load-in import should include arrivalTime for day-of readiness.'] : []),
    ...(workflow === 'timeline' && !headers.includes('assignedcontact') ? ['Run sheet import should include assignedContact for call/SMS readiness.'] : []),
    ...(workflow === 'staff' && !headers.includes('assigneephone') ? ['Staff roster import should include assigneePhone for direct call/SMS.'] : []),
  ];
  const downloadTemplate = () => {
    const blob = new Blob([templateCsv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${workflow}-operations-import-template.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card className="border-brand/20 bg-brand-soft/5">
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2"><Database className="h-4 w-4 text-brand" /> Event operations import/export center</CardTitle>
            <CardDescription>Manager-safe import guide, preview warnings, workflow CSV templates, and event-day packet export.</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <a href={`/api/events/${event.id}/export/operations-packet.zip`} download><Button size="sm"><DownloadCloud className="h-4 w-4" /> Export PDF/ZIP packet</Button></a>
            <a href={`/api/events/${event.id}/export/day-of-packet.json`} download><Button size="sm" variant="outline"><DownloadCloud className="h-4 w-4" /> Export JSON packet</Button></a>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-4">
          <MiniImportMetric label="Guests" value={guestsCount} detail="guest records in event" />
          <MiniImportMetric label="Vendors" value={vendors.length} detail="load-in records" />
          <MiniImportMetric label="Staff tasks" value={staffTasks.length} detail="roster/task records" />
          <MiniImportMetric label="Restore safety" value="Owner/admin" detail="managers cannot run destructive restores" />
        </div>
        <div className="rounded-lg border border-warning/30 bg-warning-soft/20 p-3 text-xs text-warning">
          Safer restore/import warning: preview every import before saving. Managers should escalate destructive restores, historical migrations, or finance/legal imports to an owner/admin.
        </div>
        <div className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="rounded-xl border border-border bg-surface p-3 space-y-3">
            <h3 className="text-sm font-bold text-brand flex items-center gap-2"><UploadCloud className="h-4 w-4" /> Event operations import wizard</h3>
            <label className="text-xs font-bold text-fg-subtle">Workflow</label>
            <select value={workflow} onChange={(e) => setWorkflow(e.target.value as any)} className="h-10 w-full rounded-md border border-border bg-surface px-3 text-sm">
              <option value="guests">Guest list import</option>
              <option value="vendors">Vendor load-in import</option>
              <option value="timeline">Run sheet import</option>
              <option value="staff">Staff roster import</option>
            </select>
            <Button size="sm" variant="outline" onClick={downloadTemplate}><FileSpreadsheet className="h-4 w-4" /> Download {workflow} CSV template</Button>
            <div className="rounded-lg border border-border bg-surface-2 p-2 text-xs text-fg-muted">
              Manager import guide: map required fields, review duplicate/missing-field warnings, then import from the matching tab or escalate unsupported PDF/spreadsheet conversions.
            </div>
          </div>
          <div className="rounded-xl border border-border bg-surface p-3 space-y-3">
            <h3 className="text-sm font-bold text-brand">Import preview with operational warnings</h3>
            <textarea value={rawImport} onChange={(e) => setRawImport(e.target.value)} placeholder={templateCsv} className="min-h-32 w-full rounded-md border border-border bg-surface-2 p-3 text-xs font-mono" />
            <div className="grid gap-2 sm:grid-cols-3 text-xs">
              <MiniImportMetric label="Rows detected" value={Math.max(0, lines.length - 1)} detail="excluding header" />
              <MiniImportMetric label="Missing fields" value={missing.length} detail="required columns" />
              <MiniImportMetric label="Duplicate signals" value={new Set(duplicateSignals).size} detail="same first column" />
            </div>
            {operationalWarnings.length ? <ul className="rounded-lg border border-warning/30 bg-warning-soft/20 p-3 text-xs text-warning space-y-1">{operationalWarnings.map(w => <li key={w}>• {w}</li>)}</ul> : <p className="rounded-lg border border-success/30 bg-success-soft p-3 text-xs text-success">Preview looks operationally ready. Continue in the source workflow tab to save.</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function MiniImportMetric({ label, value, detail }: { label: string; value: string | number; detail: string }) {
  return <div className="rounded-lg border border-border bg-surface p-3"><div className="text-[10px] uppercase tracking-wider text-fg-subtle font-bold">{label}</div><div className="mt-1 text-xl font-bold text-fg">{value}</div><p className="text-[11px] text-fg-muted">{detail}</p></div>;
}

function ManagerEventWorkspaceHome({
  event,
  counts,
  readinessScore,
  staffTasks,
  vendors,
  layouts,
  healthActions,
  managerNotes,
  managerNoteText,
  setManagerNoteText,
  onAddManagerNote,
  escalationLog,
  escalationText,
  setEscalationText,
  onAddEscalation,
  eventWeekMode,
  postEventCloseoutMode,
  openStaffTasks,
  vendorExceptions,
  layoutReady,
  workloadEvents,
  saving,
}: any) {
  const totalGuests = counts
    ? counts.pending + counts.attending + counts.declined + counts.maybe
    : 0;
  const metadata = safeMetadata(event.metadata);
  const operatingBrief = [
    ["Event status", event.status],
    [
      "Operational status",
      String(
        metadata.operationalStatus ||
          (eventWeekMode
            ? "event_week"
            : postEventCloseoutMode
              ? "closeout"
              : "handoff_needed"),
      ).replace(/_/g, " "),
    ],
    ["Expected guests", String(event.guest_count || totalGuests || "TBD")],
    ["Start date", event.start_date ? `Event date ${event.start_date}` : "TBD"],
    [
      "Layout",
      layoutReady
        ? "Approved layout available"
        : "Needs layout approval/review",
    ],
    [
      "Vendor readiness",
      `${Math.max(0, vendors.length - vendorExceptions.length)}/${vendors.length} clear`,
    ],
  ];
  const handoffSteps = [
    {
      label: "Sales/owner handoff received",
      done: ["booked", "planning", "completed"].includes(event.status),
    },
    {
      label: "Manager operational owner assigned",
      done: Boolean(
        metadata.assignment?.managerName ||
        metadata.assignment?.plannerName ||
        metadata.managerOwner,
      ),
    },
    {
      label: "Event-week readiness reviewed",
      done: readinessScore >= 80 || eventWeekMode,
    },
    {
      label: "Day-of execution / closeout completed",
      done: postEventCloseoutMode,
    },
  ];
  const workload = workloadEvents
    .filter((candidate: any) =>
      ["booked", "planning"].includes(candidate.status),
    )
    .slice(0, 5);
  return (
    <div className="space-y-4" aria-label="Manager event workspace home">
      <Card className="border-brand/30 bg-brand-soft/20">
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <Badge variant="brand" className="mb-2">
                <BriefcaseBusiness className="h-3 w-3" /> Manager event
                workspace home
              </Badge>
              <h2 className="text-xl font-bold text-fg">
                Start here for operations
              </h2>
              <p className="mt-1 max-w-3xl text-sm text-fg-muted">
                Review the BEO-style operating brief, health actions, event-week
                priorities, role responsibilities, and escalation log before
                opening deep planning tabs.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap lg:justify-end">
              <a href={`#/events/${event.id}/run-sheet`}>
                <Button className="min-h-11 w-full">
                  <Printer className="h-4 w-4" /> Run sheet
                </Button>
              </a>
              <a href={`#/events/${event.id}/check-in`}>
                <Button variant="outline" className="min-h-11 w-full">
                  <ScanLine className="h-4 w-4" /> Check-in
                </Button>
              </a>
              <a href={`#/events/${event.id}?tab=staff`}>
                <Button variant="outline" className="min-h-11 w-full">
                  <ClipboardCheck className="h-4 w-4" /> Staff tasks
                </Button>
              </a>
              <a href={`#/events/${event.id}?tab=guests`}>
                <Button variant="outline" className="min-h-11 w-full">
                  <Users className="h-4 w-4" /> Guest lookup
                </Button>
              </a>
              <a href={`#/events/${event.id}?tab=vendors`}>
                <Button variant="outline" className="min-h-11 w-full">
                  <Truck className="h-4 w-4" /> Vendors
                </Button>
              </a>
              <a href={`#/events/${event.id}?tab=emergency`}>
                <Button variant="outline" className="min-h-11 w-full">
                  <ShieldAlert className="h-4 w-4" /> Emergency
                </Button>
              </a>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-4">
            <ManagerBriefMetric
              title="Readiness"
              value={`${readinessScore}%`}
              detail="event setup"
            />
            <ManagerBriefMetric
              title="Open tasks"
              value={openStaffTasks.length}
              detail="staff operations"
            />
            <ManagerBriefMetric
              title="Vendor exceptions"
              value={vendorExceptions.length}
              detail="COI/contact/load-in"
            />
            <ManagerBriefMetric
              title="Escalations"
              value={
                escalationLog.filter((e: any) => e.status !== "closed").length +
                healthActions.length
              }
              detail="owner/admin review"
            />
          </div>
        </CardContent>
      </Card>

      {(eventWeekMode || postEventCloseoutMode) && (
        <Card className="border-warning/30 bg-warning-soft/20">
          <CardContent className="p-4">
            <h3 className="font-bold text-warning">
              {eventWeekMode
                ? "Event week mode active"
                : "Post-event closeout mode active"}
            </h3>
            <p className="mt-1 text-sm text-fg-muted">
              {eventWeekMode
                ? "Prioritize timeline, vendors, staff, layout readiness, guest exceptions, and emergency plan before day-of."
                : "Prioritize payments/contracts follow-up, incidents, lost items, NPS/feedback, cleanup, vendor scoring, and archive readiness."}
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <ManagerPanel
          title="Event operating brief / BEO summary"
          description="Manager-safe operating facts at a glance."
          icon={<FileText className="h-4 w-4" />}
        >
          <div className="grid gap-2 sm:grid-cols-2">
            {operatingBrief.map(([label, value]) => (
              <div
                key={label}
                className="rounded-lg border border-border bg-surface-2 p-2 text-xs"
              >
                <div className="font-bold text-fg-subtle uppercase">
                  {label}
                </div>
                <div className="mt-1 font-semibold text-fg capitalize">
                  {value}
                </div>
              </div>
            ))}
          </div>
        </ManagerPanel>
        <ManagerPanel
          title="My role on this event"
          description="Who owns what and when to escalate."
          icon={<UserRound className="h-4 w-4" />}
        >
          <div className="space-y-2 text-sm">
            <RoleRow
              label="Owner/admin"
              detail="Finance, legal, admin settings, payment/refund decisions, final approvals."
            />
            <RoleRow
              label="Venue manager"
              detail="Operations readiness, day-of command, vendor/staff/guest exceptions, incidents, closeout."
            />
            <RoleRow
              label="Planner"
              detail="Client-facing planning details, timeline collaboration, guest/client communication."
            />
            <RoleRow
              label="Staff"
              detail="Assigned tasks, shift clock-in/out, setup, guest support, teardown."
            />
          </div>
        </ManagerPanel>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <ManagerPanel
          title="Manager health/action summary"
          description="Actions filtered to operations and escalation decisions."
          icon={<Activity className="h-4 w-4" />}
        >
          <ManagerActionList
            items={healthActions.map((action: any) => ({
              label: action.title || action.message || "Health action",
              detail: `${action.severity || "attention"} · ${action.source || "event"}`,
              href: "#/intelligence",
            }))}
            empty="No open health actions detected."
          />
        </ManagerPanel>
        <ManagerPanel
          title="Manager escalation log"
          description="Track owner/admin escalations for this event."
          icon={<ShieldAlert className="h-4 w-4" />}
        >
          <textarea
            value={escalationText}
            onChange={(e) => setEscalationText(e.target.value)}
            placeholder="Add escalation: decision needed, owner/admin, due date…"
            className="min-h-20 w-full rounded-md border border-border bg-surface p-2 text-sm"
          />
          <Button size="sm" onClick={onAddEscalation} isLoading={saving}>
            Add escalation
          </Button>
          <div className="space-y-1">
            {escalationLog
              .slice()
              .reverse()
              .slice(0, 3)
              .map((item: any) => (
                <div key={item.id} className="rounded bg-surface-2 p-2 text-xs">
                  <div>{item.body}</div>
                  <div className="mt-1 text-fg-subtle">
                    {new Date(item.createdAt).toLocaleString()} · {item.status}
                  </div>
                </div>
              ))}
          </div>
        </ManagerPanel>
        <ManagerPanel
          title="Cross-event workload"
          description="Other events competing for manager attention."
          icon={<Calendar className="h-4 w-4" />}
        >
          <ManagerActionList
            items={workload.map((candidate: any) => ({
              label: candidate.title,
              detail: `${candidate.status} · ${candidate.start_date || "date TBD"}`,
              href: `#/events/${candidate.id}`,
            }))}
            empty="No additional booked/planning events found."
          />
        </ManagerPanel>
      </div>

      <ManagerPanel
        title="Handoff timeline: sales → operations → closeout"
        description="Prevents booked events from entering operations without context."
        icon={<ClipboardList className="h-4 w-4" />}
      >
        <div className="grid gap-2 sm:grid-cols-4">
          {handoffSteps.map((step) => (
            <div
              key={step.label}
              className="rounded-lg border border-border bg-surface-2 p-2 text-xs"
            >
              <span
                className={cn(
                  "mr-1 inline-flex h-4 w-4 items-center justify-center rounded-full",
                  step.done
                    ? "bg-success text-success-soft"
                    : "bg-warning-soft text-warning",
                )}
              >
                {step.done ? "✓" : "!"}
              </span>
              {step.label}
            </div>
          ))}
        </div>
      </ManagerPanel>
    </div>
  );
}

function ManagerBriefMetric({
  title,
  value,
  detail,
}: {
  title: string;
  value: string | number;
  detail: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-3">
      <div className="text-[10px] font-bold uppercase tracking-wider text-fg-subtle">
        {title}
      </div>
      <div className="mt-1 text-2xl font-black text-brand">{value}</div>
      <div className="text-[11px] text-fg-muted">{detail}</div>
    </div>
  );
}

function ManagerPanel({
  title,
  description,
  icon,
  children,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          {icon}
          {title}
        </CardTitle>
        <CardDescription className="text-xs">{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">{children}</CardContent>
    </Card>
  );
}

function RoleRow({ label, detail }: { label: string; detail: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface-2 p-2">
      <div className="font-bold text-fg">{label}</div>
      <div className="text-xs text-fg-muted">{detail}</div>
    </div>
  );
}

function ManagerActionList({
  items,
  empty,
}: {
  items: Array<{ label: string; detail: string; href: string }>;
  empty: string;
}) {
  if (!items.length)
    return (
      <p className="rounded-lg border border-dashed border-border bg-surface-2 p-3 text-sm text-fg-muted">
        {empty}
      </p>
    );
  return (
    <div className="space-y-2">
      {items.slice(0, 5).map((item, index) => (
        <a
          key={`${item.label}-${index}`}
          href={item.href}
          className="block rounded-lg border border-border bg-surface-2 p-3 text-sm hover:border-brand/40"
        >
          <div className="font-semibold text-fg line-clamp-2">{item.label}</div>
          <div className="text-xs text-fg-muted mt-1">{item.detail}</div>
        </a>
      ))}
    </div>
  );
}

function ManagerNotesCard({
  noteText,
  setNoteText,
  notes,
  onAdd,
  saving,
}: any) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <StickyNote className="h-4 w-4 text-brand" /> Manager notes
        </CardTitle>
        <CardDescription>
          Operational notes distinct from owner/admin private notes.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <textarea
          className="min-h-20 w-full rounded-md border border-border bg-surface p-2 text-sm"
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          placeholder="Add a manager operations note…"
        />
        <Button size="sm" onClick={onAdd} isLoading={saving}>
          Add manager note
        </Button>
        <div className="space-y-2">
          {notes
            .slice()
            .reverse()
            .slice(0, 4)
            .map((n: any) => (
              <div key={n.id} className="rounded-lg bg-surface-2 p-2 text-xs">
                <div>{n.body}</div>
                <div className="mt-1 text-fg-subtle">
                  {new Date(n.createdAt).toLocaleString()}
                </div>
              </div>
            ))}
        </div>
      </CardContent>
    </Card>
  );
}

function WhatNextPanel({
  items,
  event,
}: {
  items: Array<{ id: string; label: string; done: boolean }>;
  event: any;
}) {
  const first = items[0];
  return (
    <Card className="border-brand/20">
      <CardHeader>
        <CardTitle className="text-base">What should I do next?</CardTitle>
        <CardDescription>
          Owner-focused next steps for this event.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {first ? (
          items.map((item) => (
            <div key={item.id} className="flex items-center gap-2 text-sm">
              <AlertTriangle className="h-4 w-4 text-warning" />
              {item.label}
            </div>
          ))
        ) : (
          <div className="flex items-center gap-2 text-sm text-success">
            <CheckCircle2 className="h-4 w-4" />
            Core setup is complete. Review health alerts and day-of readiness.
          </div>
        )}
        <div className="pt-2 text-xs text-fg-muted">
          Current status: <strong>{event.status}</strong>. Use the tab badges
          above to find missing required setup.
        </div>
      </CardContent>
    </Card>
  );
}

function EventSetupChecklistCard({
  items,
  onOpenWizard,
}: {
  items: Array<{ id: string; label: string; done: boolean }>;
  onOpenWizard: () => void;
}) {
  const done = items.filter((i) => i.done).length;
  const pct = Math.round((done / Math.max(items.length, 1)) * 100);
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base">Event setup checklist</CardTitle>
            <CardDescription>
              Required go-live setup for this event.
            </CardDescription>
          </div>
          <Button size="sm" variant="outline" onClick={onOpenWizard}>
            Open setup wizard
          </Button>
        </div>
        <div className="mt-3 h-2 rounded-full bg-surface-2 overflow-hidden">
          <div className="h-full bg-brand" style={{ width: `${pct}%` }} />
        </div>
      </CardHeader>
      <CardContent className="grid gap-2 sm:grid-cols-2">
        {items.map((item) => (
          <div key={item.id} className="flex items-center gap-2 text-sm">
            <span
              className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-xs ${item.done ? "bg-success text-success-soft" : "bg-surface-2 text-fg-muted"}`}
            >
              {item.done ? "✓" : "•"}
            </span>
            {item.label}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function EventHealthSidePanel({
  eventId,
  readinessScore,
}: {
  eventId: string;
  readinessScore: number;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Activity className="h-4 w-4 text-brand" /> Event health side panel
        </CardTitle>
        <CardDescription>
          Readiness, risk alerts, and recommended actions.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="rounded-lg bg-surface-2 p-3 text-sm">
          <strong>{readinessScore}% ready</strong>
          <p className="text-xs text-fg-muted mt-1">
            Use the command center and readiness checks before publishing
            portals or running day-of operations.
          </p>
        </div>
        <a
          href={`#/events/${eventId}?tab=timeline`}
          className="text-xs font-bold text-brand hover:underline"
        >
          Review timeline readiness →
        </a>
      </CardContent>
    </Card>
  );
}

function AssignmentCard({
  ownerName,
  plannerName,
  setOwnerName,
  setPlannerName,
  onSave,
  saving,
}: any) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <UserRound className="h-4 w-4 text-brand" /> Owner/planner assignment
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <Input
          placeholder="Owner lead"
          value={ownerName}
          onChange={(e) => setOwnerName(e.target.value)}
        />
        <Input
          placeholder="Planner/coordinator"
          value={plannerName}
          onChange={(e) => setPlannerName(e.target.value)}
        />
        <Button size="sm" onClick={onSave} isLoading={saving}>
          Save assignment
        </Button>
      </CardContent>
    </Card>
  );
}

function InternalNotesCard({
  noteText,
  setNoteText,
  notes,
  onAdd,
  saving,
}: any) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <StickyNote className="h-4 w-4 text-brand" /> Internal notes
        </CardTitle>
        <CardDescription>
          Private owner/planner notes for this event.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <textarea
          className="min-h-20 w-full rounded-md border border-border bg-surface p-2 text-sm"
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          placeholder="Add an internal note…"
        />
        <Button size="sm" onClick={onAdd} isLoading={saving}>
          Add note
        </Button>
        <div className="space-y-2">
          {notes
            .slice()
            .reverse()
            .slice(0, 4)
            .map((n: any) => (
              <div key={n.id} className="rounded-lg bg-surface-2 p-2 text-xs">
                <div>{n.body}</div>
                <div className="mt-1 text-fg-subtle">
                  {new Date(n.createdAt).toLocaleString()}
                </div>
              </div>
            ))}
        </div>
      </CardContent>
    </Card>
  );
}

function DocumentVaultCard({
  documents,
  docName,
  docUrl,
  setDocName,
  setDocUrl,
  onAdd,
  saving,
}: any) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <FileText className="h-4 w-4 text-brand" /> Event document vault
        </CardTitle>
        <CardDescription>
          Store links to proposals, contracts, insurance, layouts, and packets.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <Input
          placeholder="Document name"
          value={docName}
          onChange={(e) => setDocName(e.target.value)}
        />
        <Input
          placeholder="Document URL"
          value={docUrl}
          onChange={(e) => setDocUrl(e.target.value)}
        />
        <Button size="sm" onClick={onAdd} isLoading={saving}>
          Add document
        </Button>
        <div className="space-y-1">
          {documents.map((d: any) => (
            <a
              key={d.id}
              href={d.url}
              target="_blank"
              rel="noreferrer"
              className="block rounded bg-surface-2 p-2 text-xs text-brand hover:underline"
            >
              {d.name}
            </a>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function ActivityTimelineCard({
  activity,
}: {
  activity: Array<{ label: string; date: string; icon: ReactNode }>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Archive className="h-4 w-4 text-brand" /> Event activity timeline
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {activity.map((a, i) => (
          <div key={`${a.label}-${i}`} className="flex gap-2 text-sm">
            <span className="mt-0.5 text-brand">{a.icon}</span>
            <div>
              <div>{a.label}</div>
              <div className="text-xs text-fg-muted">Date: {a.date}</div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function EventSetupWizardDialog({
  open,
  onOpenChange,
  event,
  counts,
  onSave,
  saving,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  event: any;
  counts?: any;
  onSave: (patch: Record<string, any>) => void;
  saving: boolean;
}) {
  const metadata = safeMetadata(event.metadata);
  const [items, setItems] = useState(eventSetupItems(event, counts));
  useEffect(
    () => setItems(eventSetupItems(event, counts)),
    [
      open,
      event.id,
      event.metadata,
      counts?.pending,
      counts?.attending,
      counts?.declined,
      counts?.maybe,
    ],
  );
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Event setup wizard</DialogTitle>
          <DialogDescription>
            Mark required setup items as complete as your event becomes ready to
            go live.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2 sm:grid-cols-2">
          {items.map((item) => (
            <label
              key={item.id}
              className="flex items-center gap-2 rounded-lg border border-border p-3 text-sm"
            >
              <input
                type="checkbox"
                className="accent-brand"
                checked={item.done}
                onChange={(e) =>
                  setItems((prev) =>
                    prev.map((i) =>
                      i.id === item.id ? { ...i, done: e.target.checked } : i,
                    ),
                  )
                }
              />
              {item.label}
            </label>
          ))}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            isLoading={saving}
            onClick={() => {
              onSave({
                ...metadata,
                setupChecklist: items,
                setupWizardCompletedAt: new Date().toISOString(),
              });
              onOpenChange(false);
            }}
          >
            Save setup checklist
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
