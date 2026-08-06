import { useState, useEffect, useMemo } from "react";
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
} from "lucide-react";
import { useSSE } from "../../lib/useSSE";
import { cn } from "../../ui/lib/cn";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "../../ui/Card";
import { Badge } from "../../ui/Badge";
import { Button } from "../../ui/Button";
import { EventRiskBadge } from "../events/components/EventRiskBadge";
import { STATUS_COLORS, getGreeting, safeJson } from './dashboardUtils';

export function VenueStudioReadiness({ setupPct, canManageVenue }: { setupPct: number; canManageVenue: boolean }) {
  const steps = [
    ['Venue spaces', 'Create ceremony, cocktail, reception, and rain-plan spaces.', '#/system/venue'],
    ['Inventory', 'Add the tables, chairs, decor, and fixtures Seven Paths Manor owns.', '#/system/inventory'],
    ['Templates & rules', 'Approve reusable layouts, capacity, accessibility, service, and operational rules.', '#/system/venue'],
    ['Couple experience', 'Set the brand, guest portal defaults, and invitation experience.', '#/system/platform'],
  ];
  return <section aria-label="Venue Studio readiness" className="space-y-4"><div className="flex items-center justify-between"><div><h2 className="text-lg font-bold text-brand">Build your Seven Paths Manor operating foundation</h2><p className="text-sm text-fg-muted">Complete Venue Studio before using the operational event dashboard.</p></div><Badge variant="brand">{setupPct}% ready</Badge></div><div className="grid gap-3 md:grid-cols-2">{steps.map(([title, detail, href]) => <a key={title} href={href} className="rounded-xl border border-brand/20 bg-brand-soft/10 p-4 hover:border-brand"><strong className="block">{title}</strong><span className="mt-1 block text-sm text-fg-muted">{detail}</span><span className="mt-3 inline-block text-sm font-semibold text-brand">Open {title} →</span></a>)}</div>{!canManageVenue && <p className="text-sm text-warning">You can review setup readiness, but a venue manager must complete space setup.</p>}</section>;
}

// ── Owner Command Center widgets ──

export function OwnerCommandCenter({
  isLoading,
  todaysEvents,
  upcomingEvents,
  leadHoldCount,
  totalActive,
  setupPct,
  setupIncomplete,
  projectedRevenue,
  canCreateEvent,
  canViewAnalytics,
  canViewGuests,
  canInviteTeam,
  canManageVenue,
  onCreateEvent,
}: {
  isLoading: boolean;
  todaysEvents: any[];
  upcomingEvents: any[];
  leadHoldCount: number;
  totalActive: number;
  setupPct: number;
  setupIncomplete: boolean;
  projectedRevenue: number | null;
  canCreateEvent: boolean;
  canViewAnalytics: boolean;
  canViewGuests: boolean;
  canInviteTeam: boolean;
  canManageVenue: boolean;
  onCreateEvent?: () => void;
}) {
  const healthActions = [
    setupIncomplete
      ? "Finish venue setup so readiness checks use accurate defaults."
      : null,
    todaysEvents.length
      ? "Review today’s check-in and run sheet before guests arrive."
      : null,
    upcomingEvents.length
      ? "Confirm vendors, timeline, and portal status for upcoming events."
      : null,
    leadHoldCount
      ? "Follow up on lead/hold inquiries before they go cold."
      : null,
    !totalActive && canCreateEvent
      ? "Create your first event or import your wedding pipeline."
      : null,
  ]
    .filter(Boolean)
    .slice(0, 5) as string[];

  return (
    <section aria-label="Owner Command Center" className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-bold text-brand flex items-center gap-2">
          <Compass className="h-4 w-4" /> Owner Command Center
        </h2>
        <span className="text-[10px] uppercase tracking-wide text-fg-muted font-semibold">
          Task-first home
        </span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <QuestionCard
          question="What needs attention today?"
          answer={
            isLoading
              ? "Loading…"
              : (healthActions[0] ??
                "No urgent actions. Keep setup and upcoming events moving.")
          }
          icon={<AlertTriangle className="h-4 w-4" />}
          href="#/intelligence"
          cta={
            canViewAnalytics ? "Open Event Health Command Center" : undefined
          }
        />
        <QuestionCard
          question="What events are coming up?"
          answer={
            isLoading
              ? "Loading…"
              : upcomingEvents.length
                ? `${upcomingEvents.length} event${upcomingEvents.length === 1 ? "" : "s"} in the next week.`
                : "No dated events in the next week."
          }
          icon={<Calendar className="h-4 w-4" />}
          href="#/events"
          cta="View events"
        />
        <QuestionCard
          question="What setup steps are incomplete?"
          answer={
            setupIncomplete
              ? `Venue setup is ${setupPct}% complete.`
              : "Venue setup is complete."
          }
          icon={<ClipboardList className="h-4 w-4" />}
          href="#/system/platform"
          cta="Resume setup"
        />
        <QuestionCard
          question="What revenue is booked/projected?"
          answer={
            canViewAnalytics
              ? projectedRevenue !== null
                ? `Projected from active events: $${projectedRevenue.toLocaleString()}.`
                : "Complete more events to unlock projected revenue."
              : "Requires reports permission."
          }
          icon={<DollarSign className="h-4 w-4" />}
          href="#/reports"
          cta={canViewAnalytics ? "View revenue" : undefined}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <SetupProgressWidget
          pct={setupPct}
          setupIncomplete={setupIncomplete}
          canManageVenue={canManageVenue}
        />
        <HealthActionsWidget
          actions={healthActions}
          canViewAnalytics={canViewAnalytics}
        />
        <RevenueSnapshotWidget
          canViewAnalytics={canViewAnalytics}
          projectedRevenue={projectedRevenue}
          totalActive={totalActive}
        />
        <UpcomingToursWidget leadHoldCount={leadHoldCount} />
        <OnsiteOperationsWidget
          todaysEvents={todaysEvents}
          upcomingEvents={upcomingEvents}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {canCreateEvent && (
          <Button className="justify-start" onClick={onCreateEvent}>
            <Plus className="h-4 w-4" /> New wedding event
          </Button>
        )}
        {canViewGuests && (
          <Button
            variant="outline"
            className="justify-start"
            onClick={() =>
              window.dispatchEvent(new CustomEvent("wvi:open-owner-setup"))
            }
          >
            <ClipboardList className="h-4 w-4" /> Import my weddings
          </Button>
        )}
        {canManageVenue && (
          <Button
            variant="outline"
            className="justify-start"
            onClick={() => {
              window.location.hash = "#/system/venue";
            }}
          >
            <Building2 className="h-4 w-4" /> Configure venue spaces
          </Button>
        )}
        {canInviteTeam && (
          <Button
            variant="outline"
            className="justify-start"
            onClick={() => {
              window.location.hash = "#/system";
            }}
          >
            <UserPlus className="h-4 w-4" /> Invite team
          </Button>
        )}
        {canViewAnalytics && (
          <Button
            variant="outline"
            className="justify-start"
            onClick={() => {
              window.location.hash = "#/intelligence";
            }}
          >
            <Activity className="h-4 w-4" /> Open Event Health Command Center
          </Button>
        )}
      </div>
    </section>
  );
}

export function QuestionCard({
  question,
  answer,
  icon,
  href,
  cta,
}: {
  question: string;
  answer: string;
  icon: React.ReactNode;
  href: string;
  cta?: string;
}) {
  return (
    <Card className="border-border bg-surface shadow-sm">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2 text-xs font-bold text-brand">
          {icon}
          {question}
        </div>
        <p className="text-sm text-fg min-h-[42px]">{answer}</p>
        {cta && (
          <a
            href={href}
            className="text-xs font-bold text-brand hover:underline"
          >
            {cta} →
          </a>
        )}
      </CardContent>
    </Card>
  );
}

export function SetupProgressWidget({
  pct,
  setupIncomplete,
  canManageVenue,
}: {
  pct: number;
  setupIncomplete: boolean;
  canManageVenue: boolean;
}) {
  return (
    <MiniWidget
      title="Setup Progress"
      icon={<ClipboardList className="h-4 w-4" />}
      value={`${pct}%`}
      desc={
        setupIncomplete
          ? "Finish the core setup path before go-live."
          : "Core setup complete."
      }
      href={canManageVenue ? "#/system/platform" : undefined}
    />
  );
}
export function HealthActionsWidget({
  actions,
  canViewAnalytics,
}: {
  actions: string[];
  canViewAnalytics: boolean;
}) {
  return (
    <MiniWidget
      title="Top 5 Health Actions"
      icon={<Activity className="h-4 w-4" />}
      value={String(actions.length || 0)}
      desc={actions[0] ?? "No priority health actions right now."}
      href={canViewAnalytics ? "#/intelligence" : undefined}
    />
  );
}
export function RevenueSnapshotWidget({
  canViewAnalytics,
  projectedRevenue,
  totalActive,
}: {
  canViewAnalytics: boolean;
  projectedRevenue: number | null;
  totalActive: number;
}) {
  return (
    <MiniWidget
      title="Revenue Snapshot"
      icon={<DollarSign className="h-4 w-4" />}
      value={
        canViewAnalytics && projectedRevenue !== null
          ? `$${projectedRevenue.toLocaleString()}`
          : "—"
      }
      desc={
        canViewAnalytics
          ? `${totalActive} active event${totalActive === 1 ? "" : "s"} contributing.`
          : "Requires reports permission."
      }
      href={canViewAnalytics ? "#/reports" : undefined}
    />
  );
}
export function UpcomingToursWidget({ leadHoldCount }: { leadHoldCount: number }) {
  return (
    <MiniWidget
      title="Upcoming Tours/Inquiries"
      icon={<Users className="h-4 w-4" />}
      value={String(leadHoldCount)}
      desc={
        leadHoldCount
          ? "Leads and holds need timely owner follow-up."
          : "No open lead or hold inquiries."
      }
      href="#/events"
    />
  );
}
export function OnsiteOperationsWidget({
  todaysEvents,
  upcomingEvents,
}: {
  todaysEvents: any[];
  upcomingEvents: any[];
}) {
  return (
    <MiniWidget
      title="Today’s Onsite Operations"
      icon={<UserCheck className="h-4 w-4" />}
      value={`${todaysEvents.length} today`}
      desc={
        todaysEvents.length
          ? "Events need day-of check-in review."
          : `${upcomingEvents.length} upcoming this week.`
      }
      href="#/calendar"
    />
  );
}
export function MiniWidget({
  title,
  icon,
  value,
  desc,
  href,
}: {
  title: string;
  icon: React.ReactNode;
  value: string;
  desc: string;
  href?: string;
}) {
  const body = (
    <Card className="border-border bg-surface shadow-sm h-full">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs font-bold text-fg-muted">
          {icon}
          {title}
        </div>
        <div className="mt-2 text-2xl font-bold text-brand">{value}</div>
        <p className="mt-1 text-xs text-fg-muted line-clamp-2">{desc}</p>
      </CardContent>
    </Card>
  );
  return href ? (
    <a
      href={href}
      className="block hover:opacity-90 focus-visible:ring-2 focus-visible:ring-brand rounded-xl"
    >
      {body}
    </a>
  ) : (
    body
  );
}

// ── Sub-component: Today's event card ──

export function TodayEventCard({ event, orgId }: { event: any; orgId: string }) {
  return (
    <Card className="hover:border-brand/40 hover:shadow-md transition-all duration-200 border-border/60 bg-surface shadow-sm flex flex-col justify-between h-[150px]">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="text-xs sm:text-sm font-bold text-fg truncate">
              {event.title}
            </CardTitle>
            <CardDescription className="text-[10px] sm:text-xs mt-0.5 text-fg-subtle">
              {event.guest_count
                ? `${event.guest_count} guests`
                : "Guest count TBD"}
            </CardDescription>
          </div>
          <EventRiskBadge eventId={event.id} orgId={orgId} />
        </div>
      </CardHeader>
      <CardContent className="pt-0 pb-4 flex items-center justify-between">
        <Badge
          variant="default"
          className="text-[9px] uppercase font-bold tracking-wider"
        >
          {event.status}
        </Badge>
        <div className="flex gap-1.5 text-[11px] font-bold">
          <a
            href={`#/events/${event.id}/check-in`}
            className="text-fg-subtle hover:text-brand transition-colors focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none rounded px-1"
            aria-label={`Open check-in for ${event.title}`}
          >
            Check-in →
          </a>
          <a
            href={`#/events/${event.id}`}
            className="text-brand hover:underline focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none rounded px-1"
            aria-label={`View details for ${event.title}`}
          >
            Details →
          </a>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Greeting helper ──



// ── Live Operations Ticker ──

export interface TickerItem {
  id: string | number;
  type: string;
  message: string;
  timestamp: Date;
  icon: React.ReactNode;
  category: "staff" | "guests" | "financials" | "system";
}

export function OperationsTicker({ orgId }: { orgId: string | null }) {
  const [items, setItems] = useState<TickerItem[]>([]);
  const [filter, setFilter] = useState<
    "all" | "staff" | "guests" | "financials"
  >("all");

  // Initialize with high-fidelity realistic day-of mock events so it never looks blank on load!
  useEffect(() => {
    setItems([
      {
        id: "mock-1",
        type: "staff.clock_in",
        message: "Lead Coordinator Jane logged shift clock-in.",
        timestamp: new Date(Date.now() - 2 * 60_000), // 2 mins ago
        icon: <UserCheck className="h-3.5 w-3.5 text-emerald-500" />,
        category: "staff",
      },
      {
        id: "mock-2",
        type: "vendor.checkin",
        message: "Acme Catering team arrived and checked in on-site.",
        timestamp: new Date(Date.now() - 15 * 60_000), // 15 mins ago
        icon: <Truck className="h-3.5 w-3.5 text-blue-500" />,
        category: "staff",
      },
      {
        id: "mock-3",
        type: "rsvp.submitted",
        message: "RSVP Submission: Bob Williams is attending Smith Wedding.",
        timestamp: new Date(Date.now() - 45 * 60_000), // 45 mins ago
        icon: <CheckCircle2 className="h-3.5 w-3.5 text-indigo-500" />,
        category: "guests",
      },
      {
        id: "mock-4",
        type: "contract.signed",
        message: "Smith Wedding contract fully executed with e-signature.",
        timestamp: new Date(Date.now() - 2 * 3600_000), // 2 hours ago
        icon: <Heart className="h-3.5 w-3.5 text-rose-500" />,
        category: "financials",
      },
    ]);
  }, []);

  // Listen to SSE Events
  const { isConnected } = useSSE(orgId, {
    "*": (event) => {
      // Create new item on real-time event
      let msg = "";
      let category: TickerItem["category"] = "system";
      let icon = <Activity className="h-3.5 w-3.5 text-brand" />;

      const payload = event.payload || {};

      switch (event.type) {
        case "guest.created":
          msg = `Guest "${payload.name || "Unknown"}" was added.`;
          category = "guests";
          icon = <UserPlus className="h-3.5 w-3.5 text-indigo-500" />;
          break;
        case "rsvp.submitted":
          msg = `RSVP submitted: "${payload.name || "Guest"}" is ${payload.attending ? "attending" : "not attending"}.`;
          category = "guests";
          icon = <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />;
          break;
        case "contract.created":
          msg = `New contract drafted for event.`;
          category = "financials";
          icon = <FileSignature className="h-3.5 w-3.5 text-amber-500" />;
          break;
        case "contract.signed":
          msg = `Contract officially signed & verified!`;
          category = "financials";
          icon = <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />;
          break;
        case "budget.updated":
          msg = `Budget items and financial allocations updated.`;
          category = "financials";
          icon = <DollarSign className="h-3.5 w-3.5 text-rose-500" />;
          break;
        case "vendor.checkin":
          msg = `Vendor "${payload.vendorName || "Partner"}" checked in on-site.`;
          category = "staff";
          icon = <Truck className="h-3.5 w-3.5 text-blue-500" />;
          break;
        case "staff.clock_in":
          msg = `Staff member clocked in to shift.`;
          category = "staff";
          icon = <UserCheck className="h-3.5 w-3.5 text-emerald-500" />;
          break;
        case "staff.clock_out":
          msg = `Staff member clocked out of shift.`;
          category = "staff";
          icon = <Clock className="h-3.5 w-3.5 text-amber-500" />;
          break;
        case "staff.task_created":
          msg = `New task "${payload.title || "Setup"}" created.`;
          category = "staff";
          icon = <ClipboardList className="h-3.5 w-3.5 text-blue-500" />;
          break;
        case "staff.task_updated":
          msg = `Task "${payload.title || "Setup"}" was marked ${payload.status || "updated"}.`;
          category = "staff";
          icon = <CheckCircle2 className="h-3.5 w-3.5 text-violet-500" />;
          break;
        case "staff.task_deleted":
          msg = `Task "${payload.title || "Setup"}" was deleted.`;
          category = "staff";
          icon = <AlertTriangle className="h-3.5 w-3.5 text-rose-500" />;
          break;
        default:
          msg = `System update: ${event.type}`;
          category = "system";
          icon = <Activity className="h-3.5 w-3.5 text-brand" />;
      }

      const newItem: TickerItem = {
        id: event.id || Date.now(),
        type: event.type,
        message: msg,
        timestamp: new Date(),
        icon,
        category,
      };

      setItems((prev) => [newItem, ...prev.slice(0, 14)]);
    },
  });

  const filteredItems = useMemo(() => {
    if (filter === "all") return items;
    return items.filter((i) => i.category === filter);
  }, [items, filter]);

  // Helper to format relative time
  const getRelativeTime = (date: Date) => {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    if (seconds < 5) return "just now";
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  };

  // Re-render relative time every 10s to keep timestamps fresh
  const [, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Card className="border-border bg-surface shadow-md rounded-2xl flex flex-col h-[530px] overflow-hidden">
      <CardHeader className="pb-2 border-b border-border/50 flex flex-row items-center justify-between">
        <div>
          <CardTitle className="font-serif font-black text-sm text-brand flex items-center gap-1.5">
            <Activity className="h-4.5 w-4.5 text-brand animate-pulse" /> Live
            Operations Ticker
          </CardTitle>
          <CardDescription className="text-[10px]">
            Real-time streaming Day-Of updates.
          </CardDescription>
        </div>
        <Badge
          variant={isConnected ? "success" : "warning"}
          className="text-[9px] font-bold px-2 py-0.5 flex items-center gap-1"
        >
          {isConnected ? (
            <>
              <span className="h-1.5 w-1.5 rounded-full bg-success animate-ping"></span>
              Live Stream Active
            </>
          ) : (
            <>
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse"></span>
              Live Active
            </>
          )}
        </Badge>
      </CardHeader>
      <div className="p-2 border-b border-border/30 flex gap-1 justify-start shrink-0 overflow-x-auto">
        {(["all", "staff", "guests", "financials"] as const).map((cat) => (
          <button
            key={cat}
            onClick={() => setFilter(cat)}
            className={[
              "px-2.5 py-1 text-[9px] uppercase font-bold tracking-wider rounded-lg transition-all",
              filter === cat
                ? "bg-brand text-brand-fg shadow-xs"
                : "text-fg-subtle hover:text-fg hover:bg-brand-soft/20",
            ].join(" ")}
          >
            {cat}
          </button>
        ))}
      </div>
      <CardContent
        role="region"
        aria-label="Live operations feed"
        tabIndex={0}
        className="flex-1 overflow-y-auto p-3 space-y-2.5 bg-bg/30 focus-visible:outline-2 focus-visible:outline-brand"
      >
        {filteredItems.length === 0 ? (
          <div className="h-full flex items-center justify-center text-xs text-fg-subtle italic font-serif py-12">
            No events in this category yet.
          </div>
        ) : (
          filteredItems.map((item) => (
            <div
              key={item.id}
              className="bg-surface p-3 rounded-xl border border-border/50 shadow-xs flex gap-2.5 items-start animate-in slide-in-from-top-2 duration-200"
            >
              <div className="h-7 w-7 rounded-lg bg-brand-soft/10 flex items-center justify-center text-brand shrink-0">
                {item.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-fg leading-relaxed">
                  {item.message}
                </p>
                <span className="text-[9px] text-fg-subtle font-bold uppercase mt-1 block">
                  {getRelativeTime(item.timestamp)}
                </span>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

export function OnboardingGoLiveChecklist({
  userConfig,
  orgId,
}: {
  userConfig?: any;
  orgId?: string | null;
}) {
  const state = orgId
    ? userConfig?.onboarding?.welcomeTourByOrg?.[orgId]
    : undefined;
  const completedSlides = new Set<string>(state?.completedSlides ?? []);
  const items = [
    {
      id: "owner-venue-setup",
      label: "Set venue basics",
      href: "#/system/platform",
    },
    {
      id: "owner-event-pipeline",
      label: "Create first event",
      href: "#/events",
    },
    {
      id: "owner-guest-portal",
      label: "Enable guest workflow",
      href: "#/guests",
    },
    { id: "owner-vendor-portal", label: "Invite vendors", href: "#/vendors" },
    {
      id: "owner-health-command",
      label: "Review health center",
      href: "#/intelligence",
    },
  ];
  const done = items.filter(
    (item) => completedSlides.has(item.id) || state?.status === "completed",
  ).length;
  if (state?.status === "completed") return null;
  return (
    <Card className="border-accent/30 bg-accent-soft/20">
      <CardContent className="p-4 space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-bold text-brand flex items-center gap-2">
              <Sparkles className="h-4 w-4" /> Owner go-live checklist:{" "}
              {Math.max(0, 5 - done)} steps to go live
            </h2>
            <p className="text-xs text-fg-muted mt-1">
              Complete the onboarding tour and core setup path. Progress follows
              you across devices.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                window.dispatchEvent(
                  new CustomEvent("wvi:restart-welcome-tour"),
                )
              }
            >
              Restart tour
            </Button>
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-5">
          {items.map((item) => (
            <a
              key={item.id}
              href={item.href}
              className="rounded-lg border border-border bg-surface p-2 text-xs hover:border-brand/40"
            >
              <span
                className={cn(
                  "inline-flex h-4 w-4 items-center justify-center rounded-full mr-1.5",
                  completedSlides.has(item.id)
                    ? "bg-success text-success-soft"
                    : "bg-surface-2 text-fg-muted",
                )}
              >
                {completedSlides.has(item.id) ? "✓" : "•"}
              </span>
              {item.label}
            </a>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function OwnerSetupChecklist({ config }: { config?: any }) {
  const setup = config?.setup?.ownerSetup;
  const completed = new Set<string>(setup?.completedSteps ?? []);
  const status = setup?.status ?? "not_started";
  const steps = [
    { id: "identity", label: "Venue identity", href: "#/system/platform" },
    { id: "spaces", label: "Venue spaces", href: "#/system/venue" },
    { id: "rules", label: "Operations & guest experience rules", href: "#/system/venue" },
    { id: "catalog", label: "Venue inventory & templates", href: "#/system/inventory" },
    { id: "firstEvent", label: "First booked event & couple invite", href: "#/events" },
  ];
  const count = steps.filter((s) => completed.has(s.id)).length;
  const pct =
    status === "completed" ? 100 : Math.round((count / steps.length) * 100);
  if (status === "completed") return null;

  return (
    <Card className="border-brand/30 bg-brand-soft/10">
      <CardContent className="p-4 space-y-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-bold text-brand flex items-center gap-2">
              <ClipboardList className="h-4 w-4" /> Venue setup {pct}% complete
            </h2>
            <p className="text-xs text-fg-muted mt-1">
              Finish your venue setup so events, portals, layouts, and readiness
              checks start with the right defaults.
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              window.dispatchEvent(new CustomEvent("wvi:open-owner-setup"))
            }
          >
            {status === "skipped" ? "Resume setup wizard" : "Open setup wizard"}
          </Button>
        </div>
        <div className="h-2 rounded-full bg-surface overflow-hidden">
          <div className="h-full bg-brand" style={{ width: `${pct}%` }} />
        </div>
        <div className="grid gap-2 sm:grid-cols-5">
          {steps.map((step) => (
            <a
              key={step.id}
              href={step.href}
              className="rounded-lg border border-border bg-surface p-2 text-xs hover:border-brand/40"
            >
              <span
                className={cn(
                  "inline-flex h-4 w-4 items-center justify-center rounded-full mr-1.5",
                  completed.has(step.id)
                    ? "bg-success text-success-soft"
                    : "bg-surface-2 text-fg-muted",
                )}
              >
                {completed.has(step.id) ? "✓" : "•"}
              </span>
              {step.label}
            </a>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function ManagerCommandCenter({
  events,
  focusEvent,
  todaysEvents,
  tomorrowEvents,
  staffTasks,
  vendors,
  layouts,
  healthActions,
  healthResolved,
  permissions,
  syncUpdatedAt,
}: {
  events: any[];
  focusEvent?: any;
  todaysEvents: any[];
  tomorrowEvents: any[];
  staffTasks: any[];
  vendors: any[];
  layouts: any[];
  healthActions: any[];
  healthResolved: any[];
  permissions: {
    canViewGuests: boolean;
    canViewVendors: boolean;
    canViewStaff: boolean;
    canManageStaff: boolean;
    canViewAnalytics: boolean;
    canViewBudget: boolean;
    canViewContracts: boolean;
  };
  syncUpdatedAt: number;
}) {
  const openTasks = staffTasks.filter((task) => task.status !== "completed");
  const criticalTasks = openTasks.filter(
    (task) =>
      ["critical", "high"].includes(task.priority) || task.status === "blocked",
  );
  const firstCallableVendor = vendors.find((vendor) => vendor.phone);
  const vendorExceptions = vendors.filter((vendor) => {
    const meta = safeJson((vendor as any).metadata);
    const statusText =
      `${vendor.status ?? ""} ${vendor.coi_status ?? ""} ${meta.coiStatus ?? ""}`.toLowerCase();
    return (
      !vendor.phone ||
      statusText.includes("expired") ||
      statusText.includes("missing") ||
      statusText.includes("risk") ||
      !meta.arrivalTime
    );
  });
  const pendingLayouts = layouts.filter(
    (layout) => layout.approval_status && layout.approval_status !== "approved",
  );
  const pendingHealth = healthActions.filter(
    (action) =>
      !["resolved", "snoozed"].includes(String(action.state?.status ?? "")),
  );
  const escalationActions = pendingHealth.filter(
    (action) =>
      ["critical", "high"].includes(
        String(action.severity ?? "").toLowerCase(),
      ) ||
      ["contracts", "payments", "integrations"].includes(
        String(action.source ?? ""),
      ),
  );
  const approvalItems = [
    ...pendingLayouts.map((layout) => ({
      type: "Layout",
      label: layout.name || "Floorplan",
      href: focusEvent ? `#/events/${focusEvent.id}?tab=layout` : "#/events",
    })),
    ...vendorExceptions
      .slice(0, 3)
      .map((vendor) => ({
        type: "Vendor",
        label: `${vendor.name} needs logistics/COI review`,
        href: focusEvent
          ? `#/events/${focusEvent.id}?tab=vendors`
          : "#/vendors",
      })),
    ...(permissions.canViewContracts
      ? escalationActions
          .filter((action) => action.source === "contracts")
          .slice(0, 2)
          .map((action) => ({
            type: "Contract",
            label: action.title || "Contract action",
            href: "#/intelligence",
          }))
      : []),
    ...(permissions.canViewBudget
      ? escalationActions
          .filter((action) => action.source === "payments")
          .slice(0, 2)
          .map((action) => ({
            type: "Payment",
            label: action.title || "Payment action",
            href: "#/intelligence",
          }))
      : []),
  ];
  const todayQueue = [
    ...criticalTasks
      .slice(0, 3)
      .map((task) => ({
        kind: "Staff",
        title: task.title,
        detail: `${task.priority} · ${task.status}`,
        href: focusEvent ? `#/events/${focusEvent.id}?tab=staff` : "#/calendar",
      })),
    ...vendorExceptions
      .slice(0, 3)
      .map((vendor) => ({
        kind: "Vendor",
        title: vendor.name,
        detail: vendor.phone
          ? "Confirm arrival / docs"
          : "Missing phone contact",
        href: focusEvent
          ? `#/events/${focusEvent.id}?tab=vendors`
          : "#/vendors",
      })),
    ...pendingHealth
      .slice(0, 3)
      .map((action) => ({
        kind: "Health",
        title: action.title || action.message || "Health action",
        detail: `${action.severity || "attention"} · ${action.source || "event"}`,
        href: "#/intelligence",
      })),
  ].slice(0, 6);
  const readinessDays = events.slice(0, 5).map((event) => ({
    event,
    date: event.start_date?.slice(0, 10) || "TBD",
    label: event.title || "Event",
    risk: String(event.risk_level || event.status || "planning"),
  }));
  const closeout = [
    {
      label: "Confirm all vendors departed or completed setup",
      done: vendors.length > 0 && vendorExceptions.length === 0,
    },
    {
      label: "Resolve blocked or critical staff tasks",
      done: criticalTasks.length === 0,
    },
    {
      label: "Record incidents and owner escalations",
      done: escalationActions.length === 0,
    },
    { label: "Print/share final run sheet and closeout notes", done: false },
  ];
  const lastUpdated = syncUpdatedAt
    ? new Date(syncUpdatedAt).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "not synced yet";

  return (
    <section className="space-y-4" aria-label="Manager Command Center">
      <Card className="border-brand/30 bg-brand-soft/20 shadow-sm">
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <Badge variant="brand" className="mb-2">
                Manager Command Center
              </Badge>
              <h2 className="text-xl font-bold text-fg">
                Today’s operations, exceptions, and escalations
              </h2>
              <p className="mt-1 text-sm text-fg-muted max-w-3xl">
                Distinct from the owner revenue/setup dashboard: prioritize
                today/tomorrow events, staff tasks, vendor arrivals, layout
                readiness, incidents, approvals, and owner/admin escalation
                needs.
              </p>
              <p className="mt-2 text-xs text-fg-subtle">
                <Wifi className="mr-1 inline h-3.5 w-3.5 text-success" /> Last
                updated {lastUpdated} · sync status visible in the footer.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap lg:justify-end">
              {focusEvent && (
                <a href={`#/events/${focusEvent.id}/run-sheet`}>
                  <Button className="min-h-11 w-full">
                    <Printer className="h-4 w-4" /> Run sheet
                  </Button>
                </a>
              )}
              {focusEvent && permissions.canViewVendors && (
                <a href={`#/events/${focusEvent.id}/check-in`}>
                  <Button variant="outline" className="min-h-11 w-full">
                    <Truck className="h-4 w-4" /> Check-in
                  </Button>
                </a>
              )}
              {firstCallableVendor?.phone && (
                <a href={`tel:${firstCallableVendor.phone}`}>
                  <Button variant="outline" className="min-h-11 w-full">
                    <Phone className="h-4 w-4" /> Call vendor
                  </Button>
                </a>
              )}
              {focusEvent && permissions.canViewStaff && (
                <a href={`#/events/${focusEvent.id}?tab=staff`}>
                  <Button variant="outline" className="min-h-11 w-full">
                    <MessageSquare className="h-4 w-4" /> Message staff
                  </Button>
                </a>
              )}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <ManagerMetric
              title="Today"
              value={todaysEvents.length}
              detail="events on property"
              icon={<Calendar className="h-4 w-4" />}
            />
            <ManagerMetric
              title="Tomorrow"
              value={tomorrowEvents.length}
              detail="events to preflight"
              icon={<Clock className="h-4 w-4" />}
            />
            {permissions.canViewStaff && (
              <ManagerMetric
                title="Open tasks"
                value={openTasks.length}
                detail={`${criticalTasks.length} critical/blocked`}
                icon={<ClipboardList className="h-4 w-4" />}
              />
            )}
            {permissions.canViewVendors && (
              <ManagerMetric
                title="Vendor exceptions"
                value={vendorExceptions.length}
                detail="contacts/docs/arrival"
                icon={<Truck className="h-4 w-4" />}
              />
            )}
            {permissions.canViewAnalytics && (
              <ManagerMetric
                title="Escalations"
                value={escalationActions.length}
                detail="owner/admin review"
                icon={<ShieldAlert className="h-4 w-4" />}
              />
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <ManagerPanel
          title="Manager Today Queue"
          description="What a venue manager should do next while walking the property."
          icon={<Compass className="h-4 w-4" />}
        >
          <ManagerQueue
            items={todayQueue}
            empty="No urgent manager actions. Review tomorrow readiness or update closeout notes."
          />
        </ManagerPanel>

        <ManagerPanel
          title="My responsibilities today"
          description="Role-aware cards based on your permissions."
          icon={<UserCheck className="h-4 w-4" />}
        >
          <div className="grid gap-2 sm:grid-cols-2">
            {permissions.canViewStaff && (
              <ResponsibilityCard
                label="Staff operations"
                detail="Work open/blocked tasks, coverage, incidents, and closeout."
                href={
                  focusEvent
                    ? `#/events/${focusEvent.id}?tab=staff`
                    : "#/calendar"
                }
              />
            )}
            {permissions.canViewVendors && (
              <ResponsibilityCard
                label="Vendor arrivals"
                detail="Confirm COI, contact, load-in, setup, and check-in."
                href={
                  focusEvent
                    ? `#/events/${focusEvent.id}?tab=vendors`
                    : "#/vendors"
                }
              />
            )}
            {permissions.canViewGuests && (
              <ResponsibilityCard
                label="Guest issues"
                detail="Review RSVP, dietary, accessibility, VIP, seating, lodging."
                href={
                  focusEvent
                    ? `#/events/${focusEvent.id}?tab=guests`
                    : "#/guests"
                }
              />
            )}
            {permissions.canViewAnalytics && (
              <ResponsibilityCard
                label="Health actions"
                detail="Fix what you can; assign or escalate the rest."
                href="#/intelligence"
              />
            )}
          </div>
        </ManagerPanel>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <ManagerPanel
          title="Needs escalation to owner/admin"
          description="Admin, finance, legal, or provider issues managers should not silently own."
          icon={<ShieldAlert className="h-4 w-4" />}
        >
          <ManagerQueue
            items={escalationActions
              .slice(0, 5)
              .map((action) => ({
                kind: action.source || "Escalation",
                title: action.title || action.message || "Escalation needed",
                detail: `${action.severity || "attention"} · ${action.confidence ? `${action.confidence}% confidence` : "review"}`,
                href: "#/intelligence",
              }))}
            empty="No owner/admin escalations detected."
          />
        </ManagerPanel>

        <ManagerPanel
          title="Open approvals"
          description="Layouts, vendor documents, contracts, payments, and portal changes needing review."
          icon={<CheckCircle2 className="h-4 w-4" />}
        >
          <ManagerQueue
            items={approvalItems
              .slice(0, 6)
              .map((item) => ({
                kind: item.type,
                title: item.label,
                detail: "approval or review needed",
                href: item.href,
              }))}
            empty="No open approval items detected."
          />
        </ManagerPanel>

        <ManagerPanel
          title="End-of-day closeout"
          description="Use this before leaving the property."
          icon={<ClipboardList className="h-4 w-4" />}
        >
          <div className="space-y-2">
            {closeout.map((item) => (
              <div
                key={item.label}
                className="flex items-start gap-2 rounded-lg border border-border bg-surface-2 p-2 text-xs"
              >
                <span
                  className={cn(
                    "mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full",
                    item.done
                      ? "bg-success text-success-soft"
                      : "bg-warning-soft text-warning",
                  )}
                >
                  {item.done ? "✓" : "!"}
                </span>
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        </ManagerPanel>
      </div>

      <ManagerPanel
        title="Event-week readiness timeline"
        description="Clear separation between sales, planning, operations, and finance work."
        icon={<Activity className="h-4 w-4" />}
      >
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {readinessDays.length ? (
            readinessDays.map((item) => (
              <a
                key={item.event.id}
                href={`#/events/${item.event.id}`}
                className="rounded-xl border border-border bg-surface p-3 text-xs hover:border-brand/40"
              >
                <div className="font-bold text-fg line-clamp-2">
                  {item.label}
                </div>
                <div className="mt-1 text-fg-muted">{item.date}</div>
                <div className="mt-2">
                  <Badge variant="outline" className="capitalize">{item.risk}</Badge>
                </div>
              </a>
            ))
          ) : (
            <p className="text-sm text-fg-muted">No event-week items found.</p>
          )}
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-4 text-xs">
          <WorkflowLane label="Sales" detail="Lead/hold handoff" />
          <WorkflowLane label="Planning" detail="Guests, vendors, timeline" />
          <WorkflowLane
            label="Operations"
            detail="Staff, run sheet, layout"
            active
          />
          <WorkflowLane label="Finance" detail="Owner/admin escalation" />
        </div>
      </ManagerPanel>

      <Card className="border-dashed border-border bg-surface print:hidden">
        <CardContent className="p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-sm font-bold text-brand flex items-center gap-2">
              <Sparkles className="h-4 w-4" /> Manager daily briefing
            </h3>
            <p className="text-xs text-fg-muted mt-1">
              Generated from health/action data: {pendingHealth.length} open
              health actions, {criticalTasks.length} critical staff items,{" "}
              {vendorExceptions.length} vendor exceptions,{" "}
              {healthResolved.length} recently resolved actions.
            </p>
          </div>
          <div className="flex gap-2">
            <a href="#/intelligence">
              <Button size="sm" variant="outline">
                Open Health Center
              </Button>
            </a>
            {focusEvent && (
              <a href={`#/events/${focusEvent.id}`}>
                <Button size="sm">Open focus event</Button>
              </a>
            )}
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

export function ManagerBestInClassModules({ events, focusEvent, staffTasks, vendors, healthActions }: { events: any[]; focusEvent?: any; staffTasks: any[]; vendors: any[]; healthActions: any[] }) {
  const [activePlaybook, setActivePlaybook] = useState<string>('ai-copilot');
  const activeIncidents = staffTasks.filter((task) => `${task.title} ${task.tags?.join?.(' ') || ''}`.toLowerCase().includes('incident') && task.status !== 'completed');
  const openWorkload = staffTasks.filter((task) => task.status !== 'completed').length;
  const vendorRisks = vendors.filter((vendor) => {
    const meta = safeJson((vendor as any).metadata);
    return !meta.arrivalTime || meta.noShowWorkflow?.status === 'active' || !vendor.phone;
  });
  const briefing = [
    focusEvent ? `Focus event: ${focusEvent.title}` : 'No focus event selected yet.',
    `${events.length} manager-visible event(s) in the near-term queue.`,
    `${openWorkload} open staff task(s), ${activeIncidents.length} active incident task(s).`,
    `${vendorRisks.length} vendor contingency/no-show risk(s) to review.`,
    healthActions.length ? `${healthActions.length} health action(s) are available for prioritization.` : 'No health actions loaded for this manager view.',
  ];
  const modules = [
    { id: 'ai-copilot', title: 'Venue Manager AI Copilot', icon: Bot, detail: 'Daily briefing and “what should I do next?” prioritization from events, staff, vendors, and health actions.', href: '#/intelligence' },
    { id: 'beo', title: 'Event BEO / operations packet generator', icon: FileArchive, detail: 'Generate BEO-style packet with timeline, floorplan, call sheet, vendor load-in, guest exceptions, and closeout.', href: focusEvent ? `#/events/${focusEvent.id}/run-sheet` : '#/events' },
    { id: 'sop', title: 'Venue SOP manager', icon: BookOpen, detail: 'SOP library tied to venue spaces and task templates for setup, weather, bar, fire marshal, accessibility, and closeout.', href: '#/system' },
    { id: 'workload', title: 'Multi-event workload balancing', icon: ScaleIcon, detail: 'Balance staffing, vendor attention, manager ownership, and escalation load across current events.', href: '#/events' },
    { id: 'incident-command', title: 'Event-day incident command system', icon: ShieldAlert, detail: 'Severity, owner notification, voice/photo notes, assignments, and resolution learning loop.', href: focusEvent ? `#/events/${focusEvent.id}?tab=emergency` : '#/events' },
    { id: 'vendor-no-show', title: 'Vendor no-show contingency playbooks', icon: Truck, detail: 'Substitution candidates, call tree, replacement packet, and owner decision escalation.', href: focusEvent ? `#/events/${focusEvent.id}?tab=vendors` : '#/vendors' },
    { id: 'weather', title: 'Weather/rain-plan decision engine', icon: Umbrella, detail: 'Plan A/B decision checklist with layout, vendor route, guest messaging, and fire/ADA checks.', href: focusEvent ? `#/events/${focusEvent.id}?tab=emergency` : '#/events' },
    { id: 'property-walk', title: 'Property walk checklist with photos', icon: Camera, detail: 'Exits, ADA path, power, tables, vendor zones, rain plan, evidence photos, and variance notes.', href: focusEvent ? `#/events/${focusEvent.id}?tab=layout` : '#/events' },
    { id: 'closeout', title: 'End-of-night closeout and damage report', icon: ClipboardList, detail: 'Cleanup, rentals, damage, lost items, staff clock-out, vendor strike, and handoff notes.', href: focusEvent ? `#/events/${focusEvent.id}?tab=staff` : '#/events' },
    { id: 'lost-found', title: 'Lost-and-found module', icon: Search, detail: 'Guest service records, item custody, photo evidence, and follow-up workflow.', href: focusEvent ? `#/events/${focusEvent.id}?tab=guests` : '#/guests' },
    { id: 'equipment', title: 'Equipment/rental reconciliation workflow', icon: Wrench, detail: 'Rental counts, damaged/missing gear, vendor return handoff, and operations packet export.', href: '#/system/inventory' },
    { id: 'bar', title: 'Bar/alcohol compliance checklist', icon: Wine, detail: 'License, last-call timing, intoxication risk, security escalation, and policy confirmation.', href: focusEvent ? `#/events/${focusEvent.id}?tab=emergency` : '#/events' },
    { id: 'parking', title: 'Parking/shuttle operations module', icon: ParkingCircle, detail: 'Arrival signage, VIP parking, shuttle timing, emergency lanes, and guest support issues.', href: focusEvent ? `#/events/${focusEvent.id}?tab=staff` : '#/events' },
    { id: 'ada', title: 'Accessibility/ADA guest service module', icon: Accessibility, detail: 'Guest assistance, reserved seating, routes, restrooms, shuttles, and accessibility incident tracking.', href: focusEvent ? `#/events/${focusEvent.id}?tab=guests` : '#/guests' },
    { id: 'fire', title: 'Fire marshal compliance packet', icon: Flame, detail: 'Exits, occupancy, candles/open flame, generator, aisles, layout packet, and approvals.', href: focusEvent ? `#/events/${focusEvent.id}?tab=layout` : '#/events' },
    { id: 'handoff', title: 'Client/planner handoff sign-off workflow', icon: Handshake, detail: 'Final run sheet, floorplan, portal, vendor packet, and owner/planner sign-off.', href: focusEvent ? `#/events/${focusEvent.id}` : '#/events' },
    { id: 'debrief', title: 'Post-event debrief loop', icon: Repeat, detail: 'Incidents, vendor performance, staff completion, timeline drift, guest issues, and improvements.', href: '#/reports' },
    { id: 'training', title: 'Manager performance and training dashboard', icon: GraduationCap, detail: 'Certification, micro-lessons, resolution analytics, workload, and coaching history.', href: '#/intelligence' },
  ];
  const selected = modules.find((module) => module.id === activePlaybook) ?? modules[0];
  const SelectedIcon = selected.icon;
  const handleDownloadPacket = () => {
    const lines = ['Best-in-Class Manager Operations Packet', `Generated: ${new Date().toLocaleString()}`, '', ...briefing, '', 'Enabled roadmap modules:', ...modules.map((module) => `- ${module.title}: ${module.detail}`)];
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `manager-best-in-class-packet-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <section className="space-y-4" aria-label="Best-in-class manager modules">
      <Card className="border-brand/30 bg-brand-soft/20">
        <CardHeader>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base"><Sparkles className="h-4 w-4 text-brand" /> Best-in-class manager operations suite</CardTitle>
              <CardDescription>Future-ready venue manager modules surfaced as actionable playbooks, packet generators, and SOP-driven workflows.</CardDescription>
            </div>
            <Button size="sm" variant="outline" onClick={handleDownloadPacket}><FileArchive className="h-4 w-4" /> Download operations packet</Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2 md:grid-cols-5">
            <ManagerMetric title="AI briefing" value={briefing.length} detail="signals summarized" icon={<Bot className="h-4 w-4" />} />
            <ManagerMetric title="Incident command" value={activeIncidents.length} detail="active incident tasks" icon={<ShieldAlert className="h-4 w-4" />} />
            <ManagerMetric title="Workload" value={openWorkload} detail="open staff tasks" icon={<ScaleIcon className="h-4 w-4" />} />
            <ManagerMetric title="Vendor playbooks" value={vendorRisks.length} detail="no-show/load-in risks" icon={<Truck className="h-4 w-4" />} />
            <ManagerMetric title="Roadmap modules" value={modules.length} detail="best-in-class workflows" icon={<Sparkles className="h-4 w-4" />} />
          </div>
          <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="rounded-xl border border-border bg-surface p-4">
              <h3 className="text-sm font-bold text-brand flex items-center gap-2"><Bot className="h-4 w-4" /> Venue Manager AI Copilot briefing</h3>
              <ul className="mt-3 space-y-2 text-sm text-fg-muted">{briefing.map((line) => <li key={line}>• {line}</li>)}</ul>
              <p className="mt-3 rounded-lg border border-brand/20 bg-brand-soft/20 p-2 text-xs text-brand"><strong>What should I do next?</strong> Open the selected playbook, resolve event-day blockers first, then export the BEO/operations packet before doors open.</p>
            </div>
            <div className="rounded-xl border border-border bg-surface p-4">
              <div className="flex items-start gap-3">
                <SelectedIcon className="mt-0.5 h-5 w-5 text-brand" />
                <div>
                  <h3 className="text-sm font-bold text-fg">{selected.title}</h3>
                  <p className="mt-1 text-sm text-fg-muted">{selected.detail}</p>
                  <a href={selected.href} className="mt-3 inline-flex text-xs font-bold text-brand hover:underline">Open related workspace →</a>
                </div>
              </div>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {modules.map((module) => {
              const Icon = module.icon;
              return <button key={module.id} onClick={() => setActivePlaybook(module.id)} className={`rounded-xl border p-3 text-left transition-colors ${activePlaybook === module.id ? 'border-brand bg-brand-soft/30' : 'border-border bg-surface hover:border-brand/40'}`}><div className="flex items-center gap-2 text-xs font-bold text-brand"><Icon className="h-4 w-4" />{module.title}</div><p className="mt-1 line-clamp-2 text-[11px] text-fg-muted">{module.detail}</p></button>;
            })}
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

export function ScaleIcon(props: any) {
  return <BarChart3 {...props} />;
}



export function ManagerMetric({
  title,
  value,
  detail,
  icon,
}: {
  title: string;
  value: string | number;
  detail: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-3">
      <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-fg-subtle">
        <span>{title}</span>
        {icon}
      </div>
      <div className="mt-1 text-2xl font-black text-brand">{value}</div>
      <div className="text-[11px] text-fg-muted">{detail}</div>
    </div>
  );
}

export function ManagerPanel({
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

export function ManagerQueue({
  items,
  empty,
}: {
  items: Array<{ kind: string; title: string; detail: string; href: string }>;
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
      {items.map((item, index) => (
        <a
          key={`${item.kind}-${item.title}-${index}`}
          href={item.href}
          className="block rounded-lg border border-border bg-surface-2 p-3 text-sm hover:border-brand/40"
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <Badge variant="outline" className="mb-1">
                {item.kind}
              </Badge>
              <div className="font-semibold text-fg line-clamp-2">
                {item.title}
              </div>
              <div className="text-xs text-fg-muted mt-1">{item.detail}</div>
            </div>
            <ChevronRight className="h-4 w-4 text-fg-subtle" />
          </div>
        </a>
      ))}
    </div>
  );
}

export function ResponsibilityCard({
  label,
  detail,
  href,
}: {
  label: string;
  detail: string;
  href: string;
}) {
  return (
    <a
      href={href}
      className="rounded-lg border border-border bg-surface-2 p-3 text-xs hover:border-brand/40"
    >
      <div className="font-bold text-fg">{label}</div>
      <p className="mt-1 text-fg-muted">{detail}</p>
    </a>
  );
}

export function WorkflowLane({
  label,
  detail,
  active,
}: {
  label: string;
  detail: string;
  active?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border p-2",
        active
          ? "border-brand bg-brand-soft/20 text-brand"
          : "border-border bg-surface-2 text-fg-muted",
      )}
    >
      <div className="font-bold">{label}</div>
      <div>{detail}</div>
    </div>
  );
}

export function ManagerOnboardingChecklist({ onDismiss }: { onDismiss: () => void }) {
  const lastWorkspace = (() => {
    try {
      return localStorage.getItem("wvi_manager_last_workspace") || "#/events";
    } catch {
      return "#/events";
    }
  })();
  const sandbox = (() => {
    try {
      return localStorage.getItem("wvi_manager_training_sandbox") === "true";
    } catch {
      return false;
    }
  })();
  const steps = [
    { label: "Review today queue and active events", href: "#/" },
    { label: "Open event operations workspace", href: lastWorkspace },
    { label: "Practice run sheet and vendor check-in", href: "#/calendar" },
    {
      label: "Learn escalation path for admin/finance issues",
      href: "#/intelligence",
    },
  ];
  return (
    <Card className="border-brand/30 bg-brand-soft/20">
      <CardContent className="p-4 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-sm font-bold text-brand flex items-center gap-2">
              <UserCheck className="h-4 w-4" /> Venue manager onboarding
              checklist
            </h2>
            <p className="text-xs text-fg-muted mt-1">
              You are here to run operations, coordinate events, and escalate
              admin/finance issues. This checklist is separate from owner setup.
            </p>
            {sandbox && (
              <Badge variant="success" className="mt-2">
                Manager training sandbox active
              </Badge>
            )}
          </div>
          <Button size="sm" variant="ghost" onClick={onDismiss}>
            Dismiss
          </Button>
        </div>
        <div className="grid gap-2 sm:grid-cols-4">
          {steps.map((step, index) => (
            <a
              key={step.label}
              href={step.href}
              className="rounded-lg border border-border bg-surface p-3 text-xs hover:border-brand/40"
            >
              <span className="mb-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-brand text-brand-fg text-xs font-bold">
                {index + 1}
              </span>
              <span className="block font-semibold text-fg">{step.label}</span>
            </a>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function DashboardSectionNav({
  canViewAnalytics,
}: {
  canViewAnalytics: boolean;
}) {
  const items = [
    { id: "today", label: "Today" },
    { id: "week", label: "This Week" },
    { id: "setup", label: "Setup" },
    ...(canViewAnalytics
      ? [{ id: "intelligence", label: "Intelligence" }]
      : []),
  ];
  return (
    <nav aria-label="Dashboard sections" className="flex flex-wrap gap-2">
      {items.map((item) => (
        <a
          key={item.id}
          href={`#${item.id}`}
          className="rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-fg-muted hover:border-brand/40 hover:text-brand"
        >
          {item.label}
        </a>
      ))}
    </nav>
  );
}

export function OwnerActionCard({
  href,
  icon,
  title,
  description,
  cta,
  help,
  tutorialActive,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  cta: string;
  help: string;
  tutorialActive: boolean;
}) {
  return (
    <a
      href={href}
      className="group p-5 rounded-xl border border-border/60 bg-surface hover:border-brand/40 shadow-sm hover:-translate-y-0.5 hover:shadow-md transition-all duration-200 flex flex-col justify-between min-h-[220px]"
    >
      <div className="space-y-3">
        <div className="h-9 w-9 rounded-lg bg-brand-soft/50 flex items-center justify-center text-brand">
          {icon}
        </div>
        <div>
          <h4 className="text-sm font-bold text-fg group-hover:text-brand transition-colors">
            {title}
          </h4>
          <p className="text-xs text-fg-subtle mt-1 leading-relaxed">
            {description}
          </p>
          {tutorialActive && (
            <div className="mt-3 p-2 bg-brand-soft/20 text-brand rounded-lg text-[10px] leading-normal font-medium border border-brand/10 animate-in fade-in duration-200">
              💡 {help}
            </div>
          )}
        </div>
      </div>
      <span className="text-[10px] uppercase font-bold tracking-wider text-brand mt-4 block group-hover:underline flex items-center gap-1">
        {cta} <ChevronRight className="h-3 w-3" />
      </span>
    </a>
  );
}

