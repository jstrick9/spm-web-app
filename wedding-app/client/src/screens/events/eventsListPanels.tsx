import {
  Calendar,
  CheckCircle2,
  ClipboardCheck,
  Copy,
  DollarSign,
  Filter,
  LayoutGrid,
  List,
  Plus,
  Search,
  ShieldCheck,
  UserCheck,
  X,
} from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { calendarDaysUntil } from "../../lib/calendarDays";
import type { SdkEvent } from "../../sdk/types";
import type { EventStatusCounts } from "../../sdk/events";
import { Badge } from "../../ui/Badge";
import { Card, CardContent } from "../../ui/Card";
import { DataTable, type Column } from "../../ui/DataTable";
import { Input } from "../../ui/Input";
import { Skeleton } from "../../ui/Skeleton";
import { cn } from "../../ui/lib/cn";
import { StatusBadge, STATUS_META, statusOrder } from "./statusMeta";

export type ViewMode = "kanban" | "table";
export type StatusFilter = SdkEvent["status"] | "all";
export type ManagerPipelineFilter =
  | "all"
  | "upcoming_tours"
  | "booked_events"
  | "event_week"
  | "day_of"
  | "post_event_closeout";

export function PipelineCommandCenter({
  counts,
  events,
}: {
  counts?: EventStatusCounts;
  events: SdkEvent[];
}) {
  const openLeads = (counts?.lead ?? 0) + (counts?.hold ?? 0);
  const booked = (counts?.booked ?? 0) + (counts?.planning ?? 0);
  const avgComplexity = Math.round(
    events.reduce((sum, event) => sum + eventComplexityScore(event).score, 0) /
      Math.max(1, events.length),
  );
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <PipelineMetric
        icon={<Search className="h-4 w-4" />}
        label="Lead inquiry pipeline"
        value={openLeads}
        help="Leads + holds needing follow-up, tours, proposal/quote, or lost reason."
      />
      <PipelineMetric
        icon={<DollarSign className="h-4 w-4" />}
        label="Contract/payment milestones"
        value={booked}
        help="Booked/planning events should have contract and deposit/payment milestones."
      />
      <PipelineMetric
        icon={<CheckCircle2 className="h-4 w-4" />}
        label="Go-live readiness"
        value={counts?.planning ?? 0}
        help="Planning events should move through guest, vendor, timeline, layout, and day-of checks."
      />
      <PipelineMetric
        icon={<ShieldCheck className="h-4 w-4" />}
        label="Avg complexity"
        value={avgComplexity}
        help="Complexity score estimates operational load before a manager accepts ownership."
      />
    </div>
  );
}

export function PipelineMetric({
  icon,
  label,
  value,
  help,
}: {
  icon: ReactNode;
  label: string;
  value: number;
  help: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs font-bold text-brand">
          {icon}
          {label}
        </div>
        <div className="mt-2 text-2xl font-bold text-fg">{value}</div>
        <p className="mt-1 text-xs text-fg-muted">{help}</p>
      </CardContent>
    </Card>
  );
}

export function StatusDefinitionStrip() {
  return (
    <div className="rounded-xl border border-border bg-surface p-3">
      <div className="text-xs font-bold text-fg mb-2">
        Owner-friendly status definitions
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        {statusOrder.map((s) => {
          const meta = STATUS_META[s];
          return (
            <div key={s} className="rounded-lg bg-surface-2 p-2">
              <div className="text-xs font-bold text-brand">{meta.label}</div>
              <p className="text-[11px] text-fg-muted leading-snug">
                {meta.ownerDefinition}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function parseEventMetadata(event: SdkEvent): Record<string, any> {
  try {
    return JSON.parse(event.metadata || "{}");
  } catch {
    return {};
  }
}

export function operationalStatusFor(event: SdkEvent): {
  label: string;
  variant: "success" | "warning" | "danger" | "outline" | "info";
} {
  const metadata = parseEventMetadata(event);
  const explicit = metadata.operationalStatus as string | undefined;
  if (explicit)
    return {
      label: explicit.replace(/_/g, " "),
      variant: explicit.includes("blocked")
        ? "danger"
        : explicit.includes("ready")
          ? "success"
          : "warning",
    };
  const start = event.start_date ? new Date(event.start_date) : null;
  const days = start
    ? Math.ceil((start.getTime() - Date.now()) / 86400000)
    : null;
  if (event.status === "completed")
    return { label: "Closeout", variant: "info" };
  if (days !== null && days <= 0) return { label: "Day-of", variant: "danger" };
  if (days !== null && days <= 7)
    return { label: "Event-week", variant: "warning" };
  if (["booked", "planning"].includes(event.status))
    return { label: "Operations handoff", variant: "warning" };
  return { label: "Sales owned", variant: "outline" };
}

export function eventComplexityScore(event: SdkEvent): {
  score: number;
  reasons: string[];
} {
  const metadata = parseEventMetadata(event);
  const guestCount = event.guest_count ?? 0;
  const score = Math.min(
    100,
    15 +
      Math.ceil(guestCount / 4) +
      (metadata.eventType === "wedding" ? 20 : 8) +
      (event.budget_cents ? 10 : 0) +
      (metadata.layoutStarted ? 8 : 0) +
      (metadata.vendorPortalConfigured ? 8 : 0),
  );
  const reasons = [
    guestCount ? `${guestCount} guests` : "guest count missing",
    metadata.eventType || "event type unknown",
    event.budget_cents ? "budget tracked" : "budget missing",
  ];
  return { score, reasons };
}

export function eventDaysUntil(event: SdkEvent): number | null {
  // Local calendar-day arithmetic — see lib/calendarDays.ts. Parsing a bare
  // "YYYY-MM-DD" as a Date would treat it as UTC midnight, making "day of"
  // (days === 0) fire up to ~12 hours early in US timezones.
  return calendarDaysUntil(event.start_date);
}

export function applyManagerPipelineFilter(
  events: SdkEvent[],
  filter: ManagerPipelineFilter,
): SdkEvent[] {
  return events.filter((event) => {
    const meta = parseEventMetadata(event);
    const days = eventDaysUntil(event);
    if (filter === "upcoming_tours")
      return Boolean(meta.tourDate) && event.status === "lead";
    if (filter === "booked_events")
      return ["booked", "planning"].includes(event.status);
    if (filter === "event_week")
      return (
        days !== null && days >= 0 && days <= 7 && event.status !== "completed"
      );
    if (filter === "day_of") return days === 0;
    if (filter === "post_event_closeout")
      return (
        event.status === "completed" ||
        Boolean(meta.operationalStatus === "closeout")
      );
    return true;
  });
}

export function ManagerPipelineControls({
  active,
  onChange,
  events,
}: {
  active: ManagerPipelineFilter;
  onChange: (filter: ManagerPipelineFilter) => void;
  events: SdkEvent[];
}) {
  const filters: Array<{
    id: ManagerPipelineFilter;
    label: string;
    help: string;
  }> = [
    { id: "all", label: "All manager work", help: "Full pipeline" },
    {
      id: "upcoming_tours",
      label: "Upcoming tours",
      help: "Sales/owner-owned until handoff",
    },
    {
      id: "booked_events",
      label: "Booked events",
      help: "Ready for operations handoff",
    },
    { id: "event_week", label: "Event-week", help: "Manager-owned readiness" },
    { id: "day_of", label: "Day-of", help: "Run sheet and check-in" },
    {
      id: "post_event_closeout",
      label: "Post-event closeout",
      help: "Debrief and reporting",
    },
  ];
  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div>
          <h3 className="text-sm font-bold text-brand">
            Manager operational pipeline filters
          </h3>
          <p className="text-xs text-fg-muted">
            Separate sales/owner pipeline status from the manager-owned
            operational stage.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {filters.map((filter) => (
            <button
              key={filter.id}
              onClick={() => onChange(filter.id)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-semibold",
                active === filter.id
                  ? "border-brand bg-brand text-brand-fg"
                  : "border-border bg-surface text-fg-muted hover:text-fg",
              )}
              title={filter.help}
            >
              {filter.label}{" "}
              <span className="opacity-70">
                ({applyManagerPipelineFilter(events, filter.id).length})
              </span>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function SalesToOperationsHandoff({ events }: { events: SdkEvent[] }) {
  const handoff = events
    .filter((event) => ["booked", "planning"].includes(event.status))
    .slice(0, 4);
  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <ClipboardCheck className="h-4 w-4 text-brand" />
          <div>
            <h3 className="text-sm font-bold text-brand">
              Sales-to-operations handoff
            </h3>
            <p className="text-xs text-fg-muted">
              When a date moves to booked/planning, managers verify the
              operational package before accepting ownership.
            </p>
          </div>
        </div>
        <div className="grid gap-2 md:grid-cols-2">
          {handoff.length ? (
            handoff.map((event) => {
              const meta = parseEventMetadata(event);
              const checklist = [
                {
                  label: "Contract/payment milestone known",
                  done: Boolean(meta.depositDueDate || event.budget_cents),
                },
                {
                  label: "Guest count/date confirmed",
                  done: Boolean(event.guest_count && event.start_date),
                },
                {
                  label: "Timeline/layout started",
                  done: Boolean(meta.timelineStarted || meta.layoutStarted),
                },
                {
                  label: "Manager assigned",
                  done: Boolean(meta.assignment?.manager || meta.managerOwner),
                },
              ];
              return (
                <a
                  key={event.id}
                  href={`#/events/${event.id}`}
                  className="rounded-xl border border-border bg-surface-2 p-3 text-xs hover:border-brand/40"
                >
                  <div className="font-bold text-fg">{event.title}</div>
                  <div className="mt-2 grid gap-1">
                    {checklist.map((item) => (
                      <div
                        key={item.label}
                        className="flex items-center gap-1.5"
                      >
                        <span
                          className={cn(
                            "h-2 w-2 rounded-full",
                            item.done ? "bg-success" : "bg-warning",
                          )}
                        />
                        {item.label}
                      </div>
                    ))}
                  </div>
                </a>
              );
            })
          ) : (
            <p className="text-sm text-fg-muted">
              No booked/planning events need handoff.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function ManagerAssignmentBoard({ events }: { events: SdkEvent[] }) {
  const assigned = events
    .filter((event) => ["booked", "planning"].includes(event.status))
    .slice(0, 6);
  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <UserCheck className="h-4 w-4 text-brand" />
          <div>
            <h3 className="text-sm font-bold text-brand">
              Manager assignment board by event
            </h3>
            <p className="text-xs text-fg-muted">
              Operational status and complexity before accepting ownership.
            </p>
          </div>
        </div>
        <div className="grid gap-2 md:grid-cols-3">
          {assigned.length ? (
            assigned.map((event) => {
              const op = operationalStatusFor(event);
              const complexity = eventComplexityScore(event);
              return (
                <a
                  key={event.id}
                  href={`#/events/${event.id}`}
                  className="rounded-xl border border-border bg-surface-2 p-3 text-xs hover:border-brand/40"
                >
                  <div className="font-bold text-fg line-clamp-2">
                    {event.title}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    <StatusBadge status={event.status} />
                    <Badge variant={op.variant} className="capitalize">
                      {op.label}
                    </Badge>
                  </div>
                  <div className="mt-2 text-fg-muted">
                    Complexity score{" "}
                    <strong className="text-fg">{complexity.score}</strong>
                  </div>
                  <div className="mt-1 text-[11px] text-fg-subtle line-clamp-2">
                    {complexity.reasons.join(" · ")}
                  </div>
                </a>
              );
            })
          ) : (
            <p className="text-sm text-fg-muted">
              No operational assignments yet.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Toolbar ───────────────────────────────────────────────
export function Toolbar({
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  counts,
}: {
  search: string;
  onSearchChange: (s: string) => void;
  statusFilter: StatusFilter;
  onStatusFilterChange: (s: StatusFilter) => void;
  counts?: EventStatusCounts;
}) {
  const totalCount = counts
    ? Object.values(counts).reduce((a, b) => a + b, 0)
    : 0;
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="flex-1 min-w-0">
        <Input
          startSlot={<Search className="h-4 w-4" />}
          endSlot={
            search ? (
              <button
                type="button"
                onClick={() => onSearchChange("")}
                className="hover:text-fg p-0.5 rounded"
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null
          }
          placeholder="Search events…"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="max-w-md"
        />
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="h-4 w-4 text-fg-subtle" aria-hidden="true" />
        <StatusChip
          active={statusFilter === "all"}
          onClick={() => onStatusFilterChange("all")}
          count={totalCount}
        >
          All
        </StatusChip>
        {statusOrder.map((s) => (
          <StatusChip
            key={s}
            active={statusFilter === s}
            onClick={() => onStatusFilterChange(s)}
            count={counts?.[s] ?? 0}
            variantHint={STATUS_META[s].badgeVariant}
          >
            {STATUS_META[s].label}
          </StatusChip>
        ))}
      </div>
    </div>
  );
}

export function StatusChip({
  active,
  onClick,
  count,
  children,
  variantHint,
}: {
  active: boolean;
  onClick: () => void;
  count: number;
  children: React.ReactNode;
  variantHint?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-pill px-3 py-1 text-xs font-medium transition-colors",
        "border border-border",
        active
          ? "bg-brand text-brand-fg border-brand"
          : "bg-surface text-fg-muted hover:bg-surface-2",
      )}
      aria-pressed={active}
      data-variant={variantHint}
    >
      {children}
      <span
        className={cn(
          "rounded-pill px-1.5 text-[10px] tabular-nums",
          active ? "bg-brand-strong/30" : "bg-surface-2",
        )}
      >
        {count}
      </span>
    </button>
  );
}

// ─── Kanban view ───────────────────────────────────────────
export function KanbanView({
  events,
  onSelect,
}: {
  events: SdkEvent[];
  onSelect: (e: SdkEvent) => void;
}) {
  const grouped = useMemo(() => {
    const map = new Map<SdkEvent["status"], SdkEvent[]>();
    for (const s of statusOrder) map.set(s, []);
    for (const e of events) map.get(e.status)?.push(e);
    return map;
  }, [events]);

  return (
    <div className="grid gap-3 auto-cols-[280px] grid-flow-col overflow-x-auto pb-3">
      {statusOrder.map((s) => {
        const meta = STATUS_META[s];
        const list = grouped.get(s) ?? [];
        return (
          <div key={s} className="flex flex-col min-w-0">
            <div className="mb-2 px-1 space-y-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-pill"
                    style={{ background: meta.dotColor }}
                    aria-hidden="true"
                  />
                  <span className="text-xs font-medium uppercase tracking-wider text-fg-subtle">
                    {meta.label}
                  </span>
                </div>
                <span className="text-xs text-fg-subtle tabular-nums">
                  {list.length}
                </span>
              </div>
              <p className="text-[10px] text-fg-muted leading-snug">
                {meta.nextStep}
              </p>
            </div>
            <div className="flex-1 flex flex-col gap-2 min-h-[120px] rounded-card border border-dashed border-border p-2">
              {list.length === 0 ? (
                <div className="text-xs text-fg-subtle text-center py-6 select-none">
                  No events
                </div>
              ) : (
                list.map((e) => (
                  <KanbanCard
                    key={e.id}
                    event={e}
                    onClick={() => onSelect(e)}
                  />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function KanbanCard({
  event,
  onClick,
}: {
  event: SdkEvent;
  onClick: () => void;
}) {
  const metadata = safeMetadata(event.metadata);
  const completion = eventSetupCompletion(event);
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group text-left bg-surface border border-border rounded-md p-3 shadow-card",
        "transition-shadow hover:shadow-elev-1 hover:border-brand/30",
        "focus:outline-none focus:ring-2 focus:ring-brand",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="font-medium text-sm leading-tight line-clamp-2">
          {event.title}
        </div>
        {metadata.eventType && (
          <Badge variant="outline" className="text-[9px]">
            {String(metadata.eventType).replace(/_/g, " ")}
          </Badge>
        )}
      </div>
      <div className="mt-2 flex items-center justify-between text-xs text-fg-muted">
        <span className="inline-flex items-center gap-1">
          <Calendar className="h-3 w-3" />
          {event.start_date ?? (
            <span className="italic text-fg-subtle">no date</span>
          )}
        </span>
        {event.guest_count > 0 && (
          <span className="tabular-nums">{event.guest_count} guests</span>
        )}
      </div>
      <div className="mt-3 space-y-1">
        <div className="flex items-center justify-between text-[10px] text-fg-muted">
          <span>Setup completion</span>
          <span>{completion}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-surface-2 overflow-hidden">
          <div
            className="h-full bg-brand"
            style={{ width: `${completion}%` }}
          />
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-1 text-[10px] text-fg-muted">
        {metadata.tourDate && (
          <span className="rounded bg-surface-2 px-1.5 py-0.5">
            Tour {metadata.tourDate}
          </span>
        )}
        {metadata.proposalDueDate && (
          <span className="rounded bg-surface-2 px-1.5 py-0.5">
            Proposal {metadata.proposalDueDate}
          </span>
        )}
        {metadata.followUpDate && (
          <span className="rounded bg-surface-2 px-1.5 py-0.5">
            Follow-up {metadata.followUpDate}
          </span>
        )}
        {metadata.depositDueDate && (
          <span className="rounded bg-surface-2 px-1.5 py-0.5">
            Payment {metadata.depositDueDate}
          </span>
        )}
      </div>
    </button>
  );
}

export function safeMetadata(raw: string): Record<string, any> {
  try {
    return JSON.parse(raw || "{}");
  } catch {
    return {};
  }
}
export function eventSetupCompletion(event: SdkEvent): number {
  const metadata = safeMetadata(event.metadata);
  const checklist = Array.isArray(metadata.setupChecklist)
    ? metadata.setupChecklist
    : [];
  const baseChecks = [
    Boolean(event.title),
    Boolean(event.start_date),
    event.guest_count > 0,
    Boolean(event.budget_cents),
    Boolean(metadata.eventType),
    Boolean(
      metadata.depositDueDate ||
      ["lead", "hold", "lost", "cancelled"].includes(event.status),
    ),
  ];
  const checklistDone = checklist.length
    ? checklist.filter((i: any) => i.done).length / checklist.length
    : 0;
  const basePct = baseChecks.filter(Boolean).length / baseChecks.length;
  return Math.round((basePct * 0.65 + checklistDone * 0.35) * 100);
}

// ─── Table view ────────────────────────────────────────────
export function TableView({
  events,
  onSelect,
}: {
  events: SdkEvent[];
  onSelect: (e: SdkEvent) => void;
}) {
  const columns: Column<SdkEvent>[] = [
    {
      id: "title",
      header: "Event",
      cell: (e) => <span className="font-medium">{e.title}</span>,
    },
    {
      id: "date",
      header: "Date",
      cell: (e) => e.start_date ?? <span className="text-fg-subtle">—</span>,
    },
    {
      id: "status",
      header: "Status",
      cell: (e) => <StatusBadge status={e.status} />,
    },
    {
      id: "guests",
      header: "Guests",
      headerClassName: "text-right",
      className: "text-right tabular-nums",
      cell: (e) =>
        e.guest_count > 0 ? (
          e.guest_count
        ) : (
          <span className="text-fg-subtle">—</span>
        ),
    },
    {
      id: "budget",
      header: "Budget",
      headerClassName: "text-right",
      className: "text-right tabular-nums",
      cell: (e) =>
        e.budget_cents ? (
          `$${(e.budget_cents / 100).toLocaleString()}`
        ) : (
          <span className="text-fg-subtle">—</span>
        ),
    },
  ];
  return <DataTable data={events} columns={columns} onRowClick={onSelect} />;
}

// ─── Helpers ───────────────────────────────────────────────
export function ViewToggle({
  view,
  onChange,
}: {
  view: ViewMode;
  onChange: (v: ViewMode) => void;
}) {
  return (
    <div
      className="inline-flex items-center rounded-md border border-border bg-surface p-0.5"
      role="tablist"
    >
      <button
        type="button"
        role="tab"
        aria-selected={view === "kanban"}
        onClick={() => onChange("kanban")}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-sm px-2.5 py-1 text-xs font-medium transition-colors",
          view === "kanban"
            ? "bg-brand-soft text-brand-strong"
            : "text-fg-muted hover:text-fg",
        )}
      >
        <LayoutGrid className="h-3.5 w-3.5" />
        Board
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={view === "table"}
        onClick={() => onChange("table")}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-sm px-2.5 py-1 text-xs font-medium transition-colors",
          view === "table"
            ? "bg-brand-soft text-brand-strong"
            : "text-fg-muted hover:text-fg",
        )}
      >
        <List className="h-3.5 w-3.5" />
        List
      </button>
    </div>
  );
}

export function ListSkeleton({ view }: { view: ViewMode }) {
  if (view === "kanban") {
    return (
      <div className="grid gap-3 auto-cols-[280px] grid-flow-col overflow-x-auto">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
          </div>
        ))}
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-10" />
      ))}
    </div>
  );
}

