/**
 * EventGuestsTab — the "Guests" tab inside EventDetail.
 * Composes toolbar + table + drawer + create dialog + Lodging & Cabin Builder.
 */
import {
  keepPreviousData,
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { lazy, Suspense, useEffect, useMemo, useState, type ReactNode } from "react";
import { useDebouncedValue } from "../../../lib/useDebouncedValue";
import { sdk } from "../../../sdk";
import type { SdkGuest } from "../../../sdk/types";
import { Card, CardContent } from "../../../ui/Card";
import { Badge } from "../../../ui/Badge";
import { Button } from "../../../ui/Button";
import { Input } from "../../../ui/Input";
import { Skeleton } from "../../../ui/Skeleton";
import { GuestFormDialog } from "./GuestFormDialog";
import { ImportGuestsDialog } from "./ImportGuestsDialog";
import { GuestDetailDrawer } from "./GuestDetailDrawer";
import { SeatingReport } from "./SeatingReport";
import { GuestsTable, type GuestSortKey } from "./GuestsTable";
import {
  GuestsToolbar,
  type GuestAdvancedFilter,
  type GuestStatusFilter,
} from "./GuestsToolbar";
import type { LodgingFloor } from "./LodgingBuilder";
import { useToast } from "../../../ui/Toast";
import {
  Accessibility,
  AlertTriangle,
  BriefcaseBusiness,
  ClipboardList,
  HeartHandshake,
  Luggage,
  MessageSquare,
  Phone,
  Search as SearchIcon,
  Shield,
  Tag,
  UserSearch,
} from "lucide-react";

const GuestHelpInbox = lazy(() => import("./GuestHelpInbox").then((m) => ({ default: m.GuestHelpInbox })));
const GuestPortalSecurityDashboard = lazy(() => import("./GuestPortalSecurityDashboard").then((m) => ({ default: m.GuestPortalSecurityDashboard }))); 
const GuestOperationsPanel = lazy(() => import("./GuestOperationsPanel").then((m) => ({ default: m.GuestOperationsPanel })));
const LodgingBuilder = lazy(() => import("./LodgingBuilder").then((m) => ({ default: m.LodgingBuilder })));

const GUEST_ISSUE_TAGS = [
  { id: "arrived_early", label: "Arrived early" },
  { id: "lost_item", label: "Lost item" },
  { id: "accessibility_assistance", label: "Accessibility assistance" },
  { id: "shuttle_issue", label: "Shuttle issue" },
  { id: "intoxication_risk", label: "Intoxication risk" },
  { id: "vip_request", label: "VIP request" },
] as const;

function guestIssueTags(guest: SdkGuest): string[] {
  const meta = safeGuestMetadata(guest.metadata);
  return Array.isArray(meta.guestIssueTags) ? meta.guestIssueTags : [];
}

function appendGuestAudit(meta: Record<string, any>, action: string) {
  const audit = Array.isArray(meta.managerAuditTrail)
    ? meta.managerAuditTrail
    : [];
  return [
    ...audit,
    { action, at: new Date().toISOString(), actor: "manager" },
  ].slice(-20);
}

interface Props {
  eventId: string;
}

function safeGuestMetadata(
  raw: string | null | undefined,
): Record<string, any> {
  try {
    return JSON.parse(raw || "{}");
  } catch {
    return {};
  }
}

function sortValue(g: any, key: string): string {
  if (key === "name") return g.full_name?.toLowerCase() ?? "";
  if (key === "email") return g.email?.toLowerCase() ?? "";
  if (key === "rsvp") return g.rsvp_status ?? "";
  if (key === "table") return g.table_assignment?.toLowerCase() ?? "";
  if (key === "party") return g.party_name?.toLowerCase() ?? "";
  return "";
}

function GuestIntelligenceSummary({
  householdCount,
  dietaryCount,
  accessibilityCount,
  vipCount,
  guests,
}: {
  householdCount: number;
  dietaryCount: number;
  accessibilityCount: number;
  vipCount: number;
  guests: SdkGuest[];
}) {
  const repeatGuests = guests.filter((g) =>
    Boolean(safeGuestMetadata(g.metadata).repeatGuest),
  ).length;
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      <MiniGuestCard
        title="Household graph"
        value={householdCount}
        detail="Parties/households represented"
      />
      <MiniGuestCard
        title="VIP tagging"
        value={vipCount}
        detail="Guests marked VIP"
      />
      <MiniGuestCard
        title="Repeat guest memory"
        value={repeatGuests}
        detail="Guests seen at prior events"
      />
      <MiniGuestCard
        title="Dietary history"
        value={dietaryCount}
        detail="Restrictions for catering"
      />
      <MiniGuestCard
        title="Accessibility report"
        value={accessibilityCount}
        detail="Notes for staff"
      />
    </div>
  );
}

function MiniGuestCard({
  title,
  value,
  detail,
}: {
  title: string;
  value: number;
  detail: string;
}) {
  return (
    <Card>
      <CardContent className="p-3">
        <div className="text-xs font-bold text-brand">{title}</div>
        <div className="mt-1 text-2xl font-bold text-fg">{value}</div>
        <p className="text-[11px] text-fg-muted">{detail}</p>
      </CardContent>
    </Card>
  );
}

function HouseholdGroupingPanel({
  guests,
  eventId,
}: {
  guests: SdkGuest[];
  eventId: string;
}) {
  const groups = useMemo(() => {
    const map = new Map<string, SdkGuest[]>();
    for (const guest of guests) {
      const key = guest.party_name || guest.full_name;
      map.set(key, [...(map.get(key) ?? []), guest]);
    }
    return Array.from(map.entries())
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, 6);
  }, [guests]);
  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-sm font-bold text-brand">
              Household / party grouping
            </h3>
            <p className="text-xs text-fg-muted">
              Use party names to coordinate household RSVPs, seating, lodging,
              and repeat guest memory.
            </p>
          </div>
          <a href={`#/portal/${eventId}`} target="_blank" rel="noreferrer">
            <Button size="sm" variant="outline">
              Guest portal preview-as-guest
            </Button>
          </a>
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          {groups.length ? (
            groups.map(([name, members], index) => (
              <div
                key={name}
                className="rounded-lg border border-border bg-surface-2 p-2 text-xs"
              >
                <div className="font-bold text-fg">Household {index + 1}</div>
                <div className="text-fg-muted">
                  {members.length} guest{members.length === 1 ? "" : "s"}
                </div>
              </div>
            ))
          ) : (
            <div className="text-xs text-fg-muted">
              Add party names to build household grouping.
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function GuestExceptionCommandCenter({
  exceptions,
  onFilter,
}: {
  exceptions: Record<string, SdkGuest[]>;
  onFilter: (filter: GuestAdvancedFilter) => void;
}) {
  const cards = [
    {
      key: "noRsvp",
      label: "No RSVP",
      filter: "none" as GuestAdvancedFilter,
      icon: <AlertTriangle className="h-4 w-4" />,
      action: () => undefined,
    },
    {
      key: "dietary",
      label: "Dietary",
      filter: "dietary" as GuestAdvancedFilter,
      icon: <ClipboardList className="h-4 w-4" />,
    },
    {
      key: "accessibility",
      label: "Accessibility",
      filter: "accessibility" as GuestAdvancedFilter,
      icon: <Accessibility className="h-4 w-4" />,
    },
    {
      key: "vip",
      label: "VIP",
      filter: "vip" as GuestAdvancedFilter,
      icon: <HeartHandshake className="h-4 w-4" />,
    },
    {
      key: "unseated",
      label: "Unseated",
      filter: "not_seated" as GuestAdvancedFilter,
      icon: <Tag className="h-4 w-4" />,
    },
    {
      key: "noLodging",
      label: "No lodging",
      filter: "no_lodging" as GuestAdvancedFilter,
      icon: <Luggage className="h-4 w-4" />,
    },
  ];
  return (
    <Card className="border-brand/20 bg-brand/5">
      <CardContent className="p-4 space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-sm font-bold text-brand flex items-center gap-2">
              <BriefcaseBusiness className="h-4 w-4" /> Guest exception command
              center
            </h3>
            <p className="text-xs text-fg-muted mt-1">
              Manager-focused queue: start with RSVP, dietary, accessibility,
              VIP, seating, and lodging exceptions before event day.
            </p>
          </div>
          <Badge variant="outline">Manager operations</Badge>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
          {cards.map((card) => (
            <button
              key={card.key}
              type="button"
              onClick={() =>
                card.key === "noRsvp" ? undefined : onFilter(card.filter)
              }
              className="rounded-xl border border-border bg-surface p-3 text-left hover:border-brand/40"
            >
              <div className="flex items-center gap-2 text-xs font-bold text-brand">
                {card.icon}
                {card.label}
              </div>
              <div className="mt-1 text-2xl font-black text-fg">
                {exceptions[card.key]?.length ?? 0}
              </div>
              <p className="text-[11px] text-fg-muted">
                {card.key === "noRsvp"
                  ? "Use RSVP status chips"
                  : "Click to filter"}
              </p>
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}


export function EventGuestsTab({ eventId }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [mobileLookupEnabled, setMobileLookupEnabled] = useState(false);
  const [managerMode] = useState(() => {
    try {
      return localStorage.getItem("wvi_registration_role") === "venue_manager";
    } catch {
      return false;
    }
  });
  const debouncedSearch = useDebouncedValue(search, 250);
  const [statusFilter, setStatusFilter] = useState<GuestStatusFilter>("all");
  const [advancedFilter, setAdvancedFilter] =
    useState<GuestAdvancedFilter>("none");
  const [rsvpDeadline, setRsvpDeadline] = useState("");
  const [sortKey, setSortKey] = useState<GuestSortKey>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [seatingOpen, setSeatingOpen] = useState(false);
  const [lodgingOpen, setLodgingOpen] = useState(false);
  const [detailGuest, setDetailGuest] = useState<SdkGuest | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  useEffect(() => {
    const update = () => setMobileLookupEnabled(window.innerWidth < 640);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const eventQuery = useQuery({
    queryKey: ["event", eventId],
    queryFn: () => sdk.events.get(eventId),
    staleTime: 60_000,
  });
  const eventTitle = eventQuery.data?.event?.title ?? "Event";
  const eventDate = eventQuery.data?.event?.start_date ?? null;
  const orgId = eventQuery.data?.event?.organization_id;
  const event = eventQuery.data?.event as any;
  const eventMetadata = useMemo(() => {
    try {
      return JSON.parse(event?.metadata || "{}");
    } catch {
      return {};
    }
  }, [event?.metadata]);

  // Fetch Venues for Lodging Settings
  const { data: venueData } = useQuery({
    queryKey: ["venues", orgId],
    queryFn: () =>
      orgId ? sdk.venues.list(orgId) : Promise.resolve({ venues: [] }),
    enabled: !!orgId,
  });
  const venues = venueData?.venues || [];
  const firstVenue = venues[0];

  const query = useQuery({
    queryKey: ["guests", eventId],
    queryFn: () => sdk.guests.list(eventId),
    placeholderData: keepPreviousData,
  });

  const allGuests = query.data?.guests ?? [];
  const counts = query.data?.counts;

  const visibleGuests = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    let out = allGuests;
    if (statusFilter !== "all") {
      out = out.filter((g) => g.rsvp_status === statusFilter);
    }
    if (q) {
      out = out.filter(
        (g) =>
          g.full_name.toLowerCase().includes(q) ||
          (g.email ?? "").toLowerCase().includes(q) ||
          (g.party_name ?? "").toLowerCase().includes(q),
      );
    }
    if (advancedFilter !== "none") {
      out = out.filter((g) => {
        const meta = safeGuestMetadata(g.metadata);
        if (advancedFilter === "no_email") return !g.email;
        if (advancedFilter === "no_phone") return !g.phone;
        if (advancedFilter === "dietary")
          return Boolean(g.dietary_restrictions);
        if (advancedFilter === "accessibility")
          return Boolean(g.accessibility_notes);
        if (advancedFilter === "not_seated")
          return !g.table_assignment && !g.seat_assignment;
        if (advancedFilter === "no_lodging") return !g.room_assignment;
        if (advancedFilter === "vip") return Boolean(meta.vip);
        return true;
      });
    }
    const factor = sortDir === "asc" ? 1 : -1;
    out = [...out].sort((a, b) => {
      const ak = sortValue(a, sortKey);
      const bk = sortValue(b, sortKey);
      if (ak < bk) return -1 * factor;
      if (ak > bk) return 1 * factor;
      return 0;
    });
    return out;
  }, [
    allGuests,
    debouncedSearch,
    statusFilter,
    advancedFilter,
    sortKey,
    sortDir,
  ]);

  function handleSortClick(k: GuestSortKey) {
    if (sortKey === k) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(k);
      setSortDir("asc");
    }
  }

  function handleRowClick(g: SdkGuest) {
    setDetailGuest(g);
    setDetailOpen(true);
  }

  const isFiltered =
    !!debouncedSearch || statusFilter !== "all" || advancedFilter !== "none";
  function clearFilters() {
    setSearch("");
    setStatusFilter("all");
    setAdvancedFilter("none");
  }

  const sendRemindersMutation = useMutation({
    mutationFn: () => sdk.lifecycleEmails.sendNow(eventId, "rsvp_reminder"),
    onSuccess: (res) =>
      toast({
        title: "RSVP reminders queued",
        description: `${res.result.scheduled} scheduled · ${res.result.skipped} skipped`,
        variant: "success",
      }),
    onError: (e: any) =>
      toast({
        title: "Could not send reminders",
        description: e.message,
        variant: "destructive",
      }),
  });

  const rsvpDeadlineMutation = useMutation({
    mutationFn: () =>
      sdk.events.update(eventId, {
        rsvpDeadline,
        metadata: { ...eventMetadata, rsvpDeadline },
      }),
    onSuccess: () => {
      toast({ title: "RSVP deadline saved", variant: "success" });
      qc.invalidateQueries({ queryKey: ["event", eventId] });
    },
    onError: (e: any) =>
      toast({
        title: "Could not save RSVP deadline",
        description: e.message,
        variant: "destructive",
      }),
  });

  const householdCount = useMemo(
    () =>
      new Set(allGuests.map((g) => g.party_name || g.full_name).filter(Boolean))
        .size,
    [allGuests],
  );
  const dietaryCount = allGuests.filter((g) => g.dietary_restrictions).length;
  const accessibilityCount = allGuests.filter(
    (g) => g.accessibility_notes,
  ).length;
  const vipCount = allGuests.filter(
    (g) => safeGuestMetadata(g.metadata).vip,
  ).length;

  // Update lodging mutation - typed as Promise<void>
  const saveLodgingMutation = useMutation<void, Error, LodgingFloor[]>({
    mutationFn: async (floors: LodgingFloor[]) => {
      if (firstVenue) {
        const metadata =
          typeof (firstVenue as any).metadata === "string"
            ? JSON.parse((firstVenue as any).metadata)
            : (firstVenue as any).metadata || {};
        await sdk.venues.update(firstVenue.id, {
          metadata: { ...metadata, floors },
        });
      }
    },
    onSuccess: () => {
      toast({
        title: "Lodging layouts updated successfully",
        variant: "success",
      });
      setLodgingOpen(false);
      if (orgId) qc.invalidateQueries({ queryKey: ["venues", orgId] });
    },
  });

  const updateGuestMetadataMutation = useMutation({
    mutationFn: async ({
      guest,
      patch,
      action,
    }: {
      guest: SdkGuest;
      patch: Record<string, any>;
      action: string;
    }) => {
      const meta = safeGuestMetadata(guest.metadata);
      await sdk.guests.update(guest.id, {
        metadata: {
          ...meta,
          ...patch,
          managerAuditTrail: appendGuestAudit(meta, action),
        },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["guests", eventId] });
      toast({ title: "Guest operations record updated", variant: "success" });
    },
    onError: (e: any) =>
      toast({
        title: "Could not update guest operations record",
        description: e.message,
        variant: "destructive",
      }),
  });

  const addGuestIssueTag = (guest: SdkGuest, tag: string) => {
    const meta = safeGuestMetadata(guest.metadata);
    const tags = new Set<string>(
      Array.isArray(meta.guestIssueTags) ? meta.guestIssueTags : [],
    );
    tags.add(tag);
    updateGuestMetadataMutation.mutate({
      guest,
      patch: { guestIssueTags: [...tags] },
      action: `tag:${tag}`,
    });
  };

  const logGuestService = (guest: SdkGuest, kind: string, note: string) => {
    const meta = safeGuestMetadata(guest.metadata);
    const log = Array.isArray(meta.guestServiceLog) ? meta.guestServiceLog : [];
    updateGuestMetadataMutation.mutate({
      guest,
      patch: {
        guestServiceLog: [
          ...log,
          {
            id: `service-${Date.now()}`,
            kind,
            note,
            at: new Date().toISOString(),
          },
        ].slice(-20),
      },
      action: `service-log:${kind}`,
    });
  };

  const parsedFloors = useMemo(() => {
    if (!firstVenue) return [];
    const metadata =
      typeof (firstVenue as any).metadata === "string"
        ? JSON.parse((firstVenue as any).metadata)
        : (firstVenue as any).metadata || {};
    return metadata.floors || [];
  }, [firstVenue]);

  const mobileLookupGuests = visibleGuests.slice(0, 5);
  const guestExceptions = {
    noRsvp: allGuests.filter((g) => g.rsvp_status === "pending"),
    dietary: allGuests.filter((g) => Boolean(g.dietary_restrictions)),
    accessibility: allGuests.filter(
      (g) =>
        Boolean(g.accessibility_notes) ||
        guestIssueTags(g).includes("accessibility_assistance"),
    ),
    vip: allGuests.filter(
      (g) =>
        Boolean(safeGuestMetadata(g.metadata).vip) ||
        guestIssueTags(g).includes("vip_request"),
    ),
    unseated: allGuests.filter(
      (g) => !g.table_assignment && !g.seat_assignment,
    ),
    noLodging: allGuests.filter((g) => !g.room_assignment),
  };

  return (
    <div className="space-y-4">
      <Suspense fallback={<Card><CardContent className="p-4"><Skeleton className="h-28 w-full" /></CardContent></Card>}><GuestHelpInbox eventId={eventId} /></Suspense>
      {managerMode && <Suspense fallback={<Card><CardContent className="p-4"><Skeleton className="h-32 w-full" /></CardContent></Card>}><GuestPortalSecurityDashboard eventId={eventId} /></Suspense>}

      {event && !event.rsvp_deadline && !eventMetadata.rsvpDeadline && (
        <Card className="border-warning/30 bg-warning-soft/20">
          <CardContent className="p-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h3 className="text-sm font-bold text-warning">
                Set an RSVP deadline
              </h3>
              <p className="text-xs text-fg-muted mt-1">
                A deadline powers reminder automation and gives owners a clear
                follow-up date.
              </p>
            </div>
            <div className="flex gap-2">
              <Input
                type="date"
                value={rsvpDeadline}
                onChange={(e) => setRsvpDeadline(e.target.value)}
                aria-label="RSVP deadline"
              />
              <Button
                size="sm"
                disabled={!rsvpDeadline || rsvpDeadlineMutation.isPending}
                isLoading={rsvpDeadlineMutation.isPending}
                onClick={() => rsvpDeadlineMutation.mutate()}
              >
                Save deadline
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {managerMode && (
        <>
          <GuestExceptionCommandCenter
            exceptions={guestExceptions}
            onFilter={(filter) => {
              setAdvancedFilter(filter);
              setStatusFilter(filter === "none" ? "all" : statusFilter);
            }}
          />
          <Suspense fallback={<Card><CardContent className="p-4"><Skeleton className="h-48 w-full" /></CardContent></Card>}>
            <GuestOperationsPanel
              guests={visibleGuests}
              exceptions={guestExceptions}
              onOpenGuest={handleRowClick}
              onTag={addGuestIssueTag}
              onLog={logGuestService}
            />
          </Suspense>
        </>
      )}

      {mobileLookupEnabled && (
        <Card className="sm:hidden border-brand/20 bg-brand/5">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-start gap-2">
              <UserSearch className="h-5 w-5 text-brand mt-0.5" />
              <div>
                <h3 className="text-sm font-bold text-fg">
                  Mobile guest lookup
                </h3>
                <p className="text-xs text-fg-muted">
                  Use this at the door or on the shuttle line to quickly find
                  RSVP, table, lodging, dietary, and accessibility notes.
                </p>
              </div>
            </div>
            <div className="relative">
              <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-muted" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search guest, household, email..."
                className="h-12 pl-9 text-base"
              />
            </div>
            <div className="space-y-2">
              {mobileLookupGuests.length ? (
                mobileLookupGuests.map((guest) => (
                  <button
                    key={guest.id}
                    type="button"
                    onClick={() => handleRowClick(guest)}
                    onKeyDown={(e) => {
                      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
                      e.preventDefault();
                      const rows = Array.from((e.currentTarget.parentElement?.querySelectorAll('button[type="button"]') ?? []));
                      const idx = rows.indexOf(e.currentTarget);
                      const next = rows[idx + (e.key === 'ArrowDown' ? 1 : -1)] as HTMLButtonElement | undefined;
                      next?.focus();
                    }}
                    className="w-full rounded-xl border border-border bg-surface p-3 text-left shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-semibold text-fg">
                          {guest.full_name}
                        </div>
                        <div className="text-xs text-fg-muted">
                          {guest.rsvp_status || "unknown"} ·{" "}
                          {guest.table_assignment || "No table"}
                          {guest.room_assignment
                            ? ` · ${guest.room_assignment}`
                            : ""}
                        </div>
                        {(guest.dietary_restrictions ||
                          guest.accessibility_notes) && (
                          <div className="mt-1 text-[11px] text-warning">
                            {guest.dietary_restrictions ||
                              guest.accessibility_notes}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-1">
                        {guest.phone && (
                          <a
                            href={`tel:${guest.phone}`}
                            onClick={(event) => event.stopPropagation()}
                            className="rounded-lg border border-border p-2 text-brand"
                            aria-label={`Call ${guest.full_name}`}
                          >
                            <Phone className="h-4 w-4" />
                          </a>
                        )}
                        {guest.phone && (
                          <a
                            href={`sms:${guest.phone}`}
                            onClick={(event) => event.stopPropagation()}
                            className="rounded-lg border border-border p-2 text-brand"
                            aria-label={`Text ${guest.full_name}`}
                          >
                            <MessageSquare className="h-4 w-4" />
                          </a>
                        )}
                      </div>
                    </div>
                  </button>
                ))
              ) : (
                <p className="rounded-lg border border-dashed border-border bg-surface p-3 text-xs text-fg-muted">
                  No guests match this lookup.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <GuestIntelligenceSummary
        householdCount={householdCount}
        dietaryCount={dietaryCount}
        accessibilityCount={accessibilityCount}
        vipCount={vipCount}
        guests={allGuests}
      />
      <HouseholdGroupingPanel guests={allGuests} eventId={eventId} />

      <GuestsToolbar
        eventId={eventId}
        search={search}
        onSearchChange={setSearch}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        advancedFilter={advancedFilter}
        onAdvancedFilterChange={setAdvancedFilter}
        counts={counts}
        selectedIds={[...selectedIds]}
        onSelectionCleared={() => setSelectedIds(new Set())}
        onAddClick={() => setCreateOpen(true)}
        onImportClick={() => setImportOpen(true)}
        onCopyEmails={() => {
          const emails = (query.data?.guests ?? [])
            .filter((g) => g.email)
            .map((g) => g.email)
            .join(", ");
          if (emails) {
            navigator.clipboard.writeText(emails);
          }
        }}
        onSendReminders={() => sendRemindersMutation.mutate()}
        onBulkMessage={() => {
          const emails = visibleGuests
            .filter((g) => g.email)
            .map((g) => g.email)
            .join(", ");
          if (emails) {
            navigator.clipboard.writeText(emails);
            toast({
              title: "Guest emails copied for bulk message",
              variant: "success",
            });
          }
        }}
      />

      {query.isLoading ? (
        <Card>
          <CardContent className="pt-6 space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10" />
            ))}
          </CardContent>
        </Card>
      ) : query.isError ? (
        <Card>
          <CardContent className="pt-6 text-sm text-danger">
            {(query.error as Error).message}
          </CardContent>
        </Card>
      ) : (
        <GuestsTable
          eventId={eventId}
          guests={visibleGuests}
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
          sortKey={sortKey}
          sortDir={sortDir}
          onSortChange={handleSortClick}
          onRowClick={handleRowClick}
          filtered={isFiltered}
          onClearFilters={clearFilters}
          onAddGuest={() => setCreateOpen(true)}
        />
      )}

      <ImportGuestsDialog
        eventId={eventId}
        existingGuests={allGuests}
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={() => query.refetch()}
      />

      <GuestFormDialog
        eventId={eventId}
        open={createOpen}
        onOpenChange={setCreateOpen}
      />

      <GuestDetailDrawer
        guest={detailGuest}
        open={detailOpen}
        onOpenChange={(v) => {
          setDetailOpen(v);
          if (!v) setDetailGuest(null);
        }}
        onDeleted={() => {
          setDetailOpen(false);
          setDetailGuest(null);
        }}
      />

      {/* Seating & Dietary & Lodging Actions */}
      <div className="flex justify-end gap-6 mt-2 print:hidden text-xs">
        <button
          onClick={() => setLodgingOpen(true)}
          className="text-fg-muted hover:text-brand underline flex items-center gap-1 font-bold"
        >
          🏨 Open Lodging &amp; Cabin Builder
        </button>
        <button
          onClick={() => setSeatingOpen(true)}
          className="text-fg-muted hover:text-brand underline font-bold"
        >
          Print Seating &amp; Dietary Report
        </button>
      </div>

      {seatingOpen && (
        <SeatingReport
          eventTitle={eventTitle}
          eventDate={eventDate}
          guests={visibleGuests}
          onClose={() => setSeatingOpen(false)}
        />
      )}

      {lodgingOpen && (
        <Suspense fallback={<Card><CardContent className="p-4"><Skeleton className="h-64 w-full" /></CardContent></Card>}>
          <LodgingBuilder
            eventId={eventId}
            venueId={firstVenue?.id || "demo-venue"}
            venueName={firstVenue?.name || "Grand Manor Suites"}
            venueWidth={firstVenue?.width || 60}
            venueHeight={firstVenue?.height || 40}
            initialFloors={parsedFloors}
            onSave={(floors) => saveLodgingMutation.mutate(floors)}
            onClose={() => setLodgingOpen(false)}
          />
        </Suspense>
      )}
    </div>
  );
}
