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
import { formatDateOnly } from "../../lib/formatDate";
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

import { ACTION_PERMISSIONS, TAB_DEFS, filterTabsForStage, type EventDetailPermission, type TabDef, type TabGroup, type TabId } from './eventTabConfig';

import { eventReadinessScore, eventSetupItems, safeMetadata } from './eventDetailUtils';

import { MANAGER_TAB_HELP, missingCountForTab } from './eventDetailGuidance';


// Decomposed overview/manager panels (see ./eventDetailPanels.tsx).
import { EventTabFallback, TabAccessDenied, OverviewTab, ManagerDataImportExportPanel, MiniImportMetric, ManagerEventWorkspaceHome, ManagerBriefMetric, ManagerPanel, RoleRow, ManagerActionList, ManagerNotesCard, WhatNextPanel, EventSetupChecklistCard, EventHealthSidePanel, AssignmentCard, InternalNotesCard, DocumentVaultCard, ActivityTimelineCard, EventSetupWizardDialog } from './eventDetailPanels';

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

  // Stage-aware tabs: hide surfaces that don't exist yet for the event's
  // pipeline stage (e.g. staff/emergency/portal for sales-stage leads).
  const visibleTabs = useMemo(
    () => filterTabsForStage(
      TAB_DEFS.filter((t) => hasPermission(t.permission) && (t.id !== 'guests' || isCoupleForEvent)),
      eventQuery.data?.event?.status,
    ),
    [perms, isCoupleForEvent, eventQuery.data?.event?.status],
  );

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
                {formatDateOnly(event.start_date)}
                {event.end_date && event.end_date !== event.start_date
                  ? ` – ${formatDateOnly(event.end_date)}`
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
                <ChatSystem
                  eventId={eventId}
                  currentUser={user}
                  senderRole={currentUserQuery.data?.memberships?.find((membership: any) => membership.eventId === eventId || membership.organizationId === event.organization_id)?.roleKey ?? 'staff'}
                />,
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

