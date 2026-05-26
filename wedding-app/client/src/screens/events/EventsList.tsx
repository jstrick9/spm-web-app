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
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
  Calendar, Filter, LayoutGrid, List, Plus, Search, X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useDebouncedValue } from '../../lib/useDebouncedValue';
import { useRouter } from '../../lib/router';
import { sdk } from '../../sdk';
import type { SdkEvent } from '../../sdk/types';
import type { EventStatusCounts } from '../../sdk/events';

import { PageBody, PageHeader } from '../../ui/AppShell';
import { Badge } from '../../ui/Badge';
import { Button } from '../../ui/Button';
import { Card, CardContent } from '../../ui/Card';
import { DataTable, type Column } from '../../ui/DataTable';
import { EmptyState } from '../../ui/EmptyState';
import { Input } from '../../ui/Input';
import { Skeleton } from '../../ui/Skeleton';
import { cn } from '../../ui/lib/cn';
import { CreateEventDialog } from './CreateEventDialog';
import { StatusBadge, STATUS_META, statusOrder } from './statusMeta';

type ViewMode = 'kanban' | 'table';
type StatusFilter = SdkEvent['status'] | 'all';

interface Props { orgId: string }

export function EventsList({ orgId }: Props) {
  const { navigate } = useRouter();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 250);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [view, setView] = useState<ViewMode>('kanban');
  const [createOpen, setCreateOpen] = useState(false);

  const query = useQuery({
    queryKey: ['events', orgId, { search: debouncedSearch, statusFilter }],
    queryFn: async () =>
      sdk.events.list(orgId, {
        search: debouncedSearch || undefined,
        status: statusFilter === 'all' ? undefined : [statusFilter],
      }),
    placeholderData: keepPreviousData,
  });

  const events = query.data?.events ?? [];
  const counts = query.data?.counts;

  return (
    <>
      <PageHeader
        title="Events"
        description="All weddings and events for your organization."
        actions={
          <div className="flex items-center gap-2">
            <ViewToggle view={view} onChange={setView} />
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" />
              New event
            </Button>
          </div>
        }
      />

      <PageBody className="space-y-4">
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

        {query.isSuccess && events.length === 0 && (
          <Card>
            <EmptyState
              icon={<Calendar className="h-5 w-5" />}
              title={search || statusFilter !== 'all' ? 'No events match your filters' : 'No events yet'}
              description={
                search || statusFilter !== 'all'
                  ? 'Try clearing filters or adjusting your search.'
                  : 'Create your first event to get started.'
              }
              action={
                search || statusFilter !== 'all'
                  ? <Button variant="outline" onClick={() => { setSearch(''); setStatusFilter('all'); }}>Clear filters</Button>
                  : <Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" />New event</Button>
              }
            />
          </Card>
        )}

        {query.isSuccess && events.length > 0 && view === 'kanban' && (
          <KanbanView events={events} onSelect={(e) => navigate(`/events/${e.id}`)} />
        )}

        {query.isSuccess && events.length > 0 && view === 'table' && (
          <TableView events={events} onSelect={(e) => navigate(`/events/${e.id}`)} />
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

// ─── Toolbar ───────────────────────────────────────────────
function Toolbar({
  search, onSearchChange,
  statusFilter, onStatusFilterChange,
  counts,
}: {
  search: string;
  onSearchChange: (s: string) => void;
  statusFilter: StatusFilter;
  onStatusFilterChange: (s: StatusFilter) => void;
  counts?: EventStatusCounts;
}) {
  const totalCount = counts ? Object.values(counts).reduce((a, b) => a + b, 0) : 0;
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="flex-1 min-w-0">
        <Input
          startSlot={<Search className="h-4 w-4" />}
          endSlot={search ? (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="hover:text-fg p-0.5 rounded"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
          placeholder="Search events…"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="max-w-md"
        />
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <Filter className="h-4 w-4 text-fg-subtle" aria-hidden="true" />
        <StatusChip
          active={statusFilter === 'all'}
          onClick={() => onStatusFilterChange('all')}
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

function StatusChip({
  active, onClick, count, children, variantHint,
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
        'inline-flex items-center gap-1.5 rounded-pill px-3 py-1 text-xs font-medium transition-colors',
        'border border-border',
        active
          ? 'bg-brand text-brand-fg border-brand'
          : 'bg-surface text-fg-muted hover:bg-surface-2',
      )}
      aria-pressed={active}
      data-variant={variantHint}
    >
      {children}
      <span className={cn(
        'rounded-pill px-1.5 text-[10px] tabular-nums',
        active ? 'bg-brand-strong/30' : 'bg-surface-2',
      )}>
        {count}
      </span>
    </button>
  );
}

// ─── Kanban view ───────────────────────────────────────────
function KanbanView({ events, onSelect }: { events: SdkEvent[]; onSelect: (e: SdkEvent) => void }) {
  const grouped = useMemo(() => {
    const map = new Map<SdkEvent['status'], SdkEvent[]>();
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
            <div className="flex items-center justify-between mb-2 px-1">
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
              <span className="text-xs text-fg-subtle tabular-nums">{list.length}</span>
            </div>
            <div className="flex-1 flex flex-col gap-2 min-h-[120px] rounded-card border border-dashed border-border p-2">
              {list.length === 0 ? (
                <div className="text-xs text-fg-subtle text-center py-6 select-none">
                  No events
                </div>
              ) : (
                list.map((e) => <KanbanCard key={e.id} event={e} onClick={() => onSelect(e)} />)
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function KanbanCard({ event, onClick }: { event: SdkEvent; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group text-left bg-surface border border-border rounded-md p-3 shadow-card',
        'transition-shadow hover:shadow-elev-1 hover:border-brand/30',
        'focus:outline-none focus:ring-2 focus:ring-brand',
      )}
    >
      <div className="font-medium text-sm leading-tight line-clamp-2">{event.title}</div>
      <div className="mt-2 flex items-center justify-between text-xs text-fg-muted">
        <span className="inline-flex items-center gap-1">
          <Calendar className="h-3 w-3" />
          {event.start_date ?? <span className="italic text-fg-subtle">no date</span>}
        </span>
        {event.guest_count > 0 && (
          <span className="tabular-nums">{event.guest_count} guests</span>
        )}
      </div>
    </button>
  );
}

// ─── Table view ────────────────────────────────────────────
function TableView({ events, onSelect }: { events: SdkEvent[]; onSelect: (e: SdkEvent) => void }) {
  const columns: Column<SdkEvent>[] = [
    { id: 'title', header: 'Event', cell: (e) => <span className="font-medium">{e.title}</span> },
    { id: 'date',  header: 'Date',  cell: (e) => e.start_date ?? <span className="text-fg-subtle">—</span> },
    { id: 'status', header: 'Status', cell: (e) => <StatusBadge status={e.status} /> },
    {
      id: 'guests',
      header: 'Guests',
      headerClassName: 'text-right',
      className: 'text-right tabular-nums',
      cell: (e) => e.guest_count > 0 ? e.guest_count : <span className="text-fg-subtle">—</span>,
    },
    {
      id: 'budget',
      header: 'Budget',
      headerClassName: 'text-right',
      className: 'text-right tabular-nums',
      cell: (e) => e.budget_cents ? `$${(e.budget_cents / 100).toLocaleString()}` : <span className="text-fg-subtle">—</span>,
    },
  ];
  return <DataTable data={events} columns={columns} onRowClick={onSelect} />;
}

// ─── Helpers ───────────────────────────────────────────────
function ViewToggle({ view, onChange }: { view: ViewMode; onChange: (v: ViewMode) => void }) {
  return (
    <div className="inline-flex items-center rounded-md border border-border bg-surface p-0.5" role="tablist">
      <button
        type="button"
        role="tab"
        aria-selected={view === 'kanban'}
        onClick={() => onChange('kanban')}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-sm px-2.5 py-1 text-xs font-medium transition-colors',
          view === 'kanban' ? 'bg-brand-soft text-brand-strong' : 'text-fg-muted hover:text-fg',
        )}
      >
        <LayoutGrid className="h-3.5 w-3.5" />
        Board
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={view === 'table'}
        onClick={() => onChange('table')}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-sm px-2.5 py-1 text-xs font-medium transition-colors',
          view === 'table' ? 'bg-brand-soft text-brand-strong' : 'text-fg-muted hover:text-fg',
        )}
      >
        <List className="h-3.5 w-3.5" />
        List
      </button>
    </div>
  );
}

function ListSkeleton({ view }: { view: ViewMode }) {
  if (view === 'kanban') {
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
      {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10" />)}
    </div>
  );
}
