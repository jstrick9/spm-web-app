/**

 * EventsList — the spine of the platform. Lists all events in the active
 * organization with search, status filters, and two view modes:
 *
 *   1. "Kanban" — columns by status (lead / hold / booked / planning / etc.)
 *      Great for venue owners managing the sales pipeline.
 *   2. "Table"  — dense rows, sortable, exportable.
 *      Great for planners who want the spreadsheet view.
 *
 * Data fetched via TanStack Query so:
 *   - results cache across navigation
 *   - status counts re-render the moment a new event is created
 *   - the Command Palette can pre-warm by calling queryClient.prefetchQuery
 *
 * Permission gate: requires events.view. Create button shows only if
 * events.create.
 */
import { keepPreviousData, useQuery } from "@tanstack/react-query";
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
import { useDebouncedValue } from "../../lib/useDebouncedValue";
import { useRouter } from "../../lib/router";
import { sdk } from "../../sdk";
import type { SdkEvent } from "../../sdk/types";
import type { EventStatusCounts } from "../../sdk/events";

import { PageBody, PageHeader } from "../../ui/AppShell";
import { Badge } from "../../ui/Badge";
import { Button } from "../../ui/Button";
import { Card, CardContent } from "../../ui/Card";
import { DataTable, type Column } from "../../ui/DataTable";
import { EmptyState } from "../../ui/EmptyState";
import { Input } from "../../ui/Input";
import { Skeleton } from "../../ui/Skeleton";
import { cn } from "../../ui/lib/cn";
import { CreateEventDialog } from "./CreateEventDialog";
import { StatusBadge, STATUS_META, statusOrder } from "./statusMeta";
import { PipelineCommandCenter, PipelineMetric, StatusDefinitionStrip, parseEventMetadata, operationalStatusFor, eventComplexityScore, eventDaysUntil, applyManagerPipelineFilter, ManagerPipelineControls, SalesToOperationsHandoff, ManagerAssignmentBoard, Toolbar, StatusChip, KanbanView, KanbanCard, safeMetadata, eventSetupCompletion, TableView, ViewToggle, ListSkeleton } from './eventsListPanels';
import type { ViewMode, StatusFilter, ManagerPipelineFilter } from './eventsListPanels';


interface Props {
  orgId: string;
}

export function EventsList({ orgId }: Props) {
  const { navigate } = useRouter();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 250);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [view, setView] = useState<ViewMode>("kanban");
  const [managerFilter, setManagerFilter] =
    useState<ManagerPipelineFilter>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const isManager = (() => {
    try {
      return localStorage.getItem("wvi_registration_role") === "venue_manager";
    } catch {
      return false;
    }
  })();

  const query = useQuery({
    queryKey: ["events", orgId, { search: debouncedSearch, statusFilter }],
    queryFn: async () =>
      sdk.events.list(orgId, {
        search: debouncedSearch || undefined,
        status: statusFilter === "all" ? undefined : [statusFilter],
      }),
    placeholderData: keepPreviousData,
  });

  const events = query.data?.events ?? [];
  const counts = query.data?.counts;
  const visibleEvents = useMemo(
    () => applyManagerPipelineFilter(events, managerFilter),
    [events, managerFilter],
  );

  return (
    <>
      <PageHeader
        title="Events"
        description="Track inquiries, tours, proposals, booked events, planning work, and event closeout in one owner-friendly board."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <ViewToggle view={view} onChange={setView} />
            <Button variant="outline" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" />
              New lead inquiry
            </Button>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" />
              New event
            </Button>
          </div>
        }
      />

      <PageBody className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-brand">
              Event Pipeline Board
            </h2>
            <p className="text-xs text-fg-muted">
              Move work from inquiry to proposal/quote, booked, planning,
              completed, cancelled, or lost.
            </p>
          </div>
        </div>
        <PipelineCommandCenter counts={counts} events={events} />
        {isManager && (
          <>
            <ManagerPipelineControls
              active={managerFilter}
              onChange={setManagerFilter}
              events={events}
            />
            <SalesToOperationsHandoff events={events} />
            <ManagerAssignmentBoard events={events} />
          </>
        )}
        <StatusDefinitionStrip />
        <Toolbar
          search={search}
          onSearchChange={setSearch}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          counts={counts}
        />

        {query.isLoading && <ListSkeleton view={view} />}

        {query.isError && (
          <Card>
            <CardContent className="pt-6 text-sm text-danger">
              Failed to load events: {(query.error as Error).message}
            </CardContent>
          </Card>
        )}

        {query.isSuccess && visibleEvents.length === 0 && (
          <Card>
            <EmptyState
              icon={<Calendar className="h-5 w-5" />}
              title={
                search || statusFilter !== "all"
                  ? "No events match your filters"
                  : "No events yet"
              }
              description={
                search || statusFilter !== "all"
                  ? "Try clearing filters or adjusting your search."
                  : "Create your first event to get started."
              }
              action={
                search || statusFilter !== "all" ? (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSearch("");
                      setStatusFilter("all");
                    }}
                  >
                    Clear filters
                  </Button>
                ) : (
                  <Button onClick={() => setCreateOpen(true)}>
                    <Plus className="h-4 w-4" />
                    New event
                  </Button>
                )
              }
            />
          </Card>
        )}

        {query.isSuccess && visibleEvents.length > 0 && view === "kanban" && (
          <KanbanView
            events={visibleEvents}
            onSelect={(e) => navigate(`/events/${e.id}`)}
          />
        )}

        {query.isSuccess && visibleEvents.length > 0 && view === "table" && (
          <TableView
            events={visibleEvents}
            onSelect={(e) => navigate(`/events/${e.id}`)}
          />
        )}
      </PageBody>

      <CreateEventDialog
        orgId={orgId}
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(e) => navigate(`/events/${e.id}`)}
      />
    </>
  );
}

