/**
 * EventGuestsTab — the "Guests" tab inside EventDetail.
 * Composes toolbar + table + drawer + create dialog + Lodging & Cabin Builder.
 */
import { keepPreviousData, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useDebouncedValue } from '../../../lib/useDebouncedValue';
import { sdk } from '../../../sdk';
import type { SdkGuest } from '../../../sdk/types';
import { Card, CardContent } from '../../../ui/Card';
import { Skeleton } from '../../../ui/Skeleton';
import { GuestFormDialog } from './GuestFormDialog';
import { ImportGuestsDialog } from './ImportGuestsDialog';
import { GuestDetailDrawer } from './GuestDetailDrawer';
import { SeatingReport } from './SeatingReport';
import { GuestsTable, type GuestSortKey } from './GuestsTable';
import { GuestsToolbar, type GuestStatusFilter } from './GuestsToolbar';
import { LodgingBuilder, type LodgingFloor } from './LodgingBuilder';
import { useToast } from '../../../ui/Toast';

interface Props { eventId: string }

function sortValue(g: any, key: string): string {
  if (key === "name") return g.full_name?.toLowerCase() ?? "";
  if (key === "email") return g.email?.toLowerCase() ?? "";
  if (key === "rsvp") return g.rsvp_status ?? "";
  if (key === "table") return g.table_assignment?.toLowerCase() ?? "";
  if (key === "party") return g.party_name?.toLowerCase() ?? "";
  return "";
}

export function EventGuestsTab({ eventId }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 250);
  const [statusFilter, setStatusFilter] = useState<GuestStatusFilter>('all');
  const [sortKey, setSortKey] = useState<GuestSortKey>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [seatingOpen, setSeatingOpen] = useState(false);
  const [lodgingOpen, setLodgingOpen] = useState(false);
  const [detailGuest, setDetailGuest] = useState<SdkGuest | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const eventQuery = useQuery({
    queryKey: ["event", eventId],
    queryFn: () => sdk.events.get(eventId),
    staleTime: 60_000,
  });
  const eventTitle = eventQuery.data?.event?.title ?? "Event";
  const eventDate = eventQuery.data?.event?.start_date ?? null;
  const orgId = eventQuery.data?.event?.organization_id;

  // Fetch Venues for Lodging Settings
  const { data: venueData } = useQuery({
    queryKey: ['venues', orgId],
    queryFn: () => orgId ? sdk.venues.list(orgId) : Promise.resolve({ venues: [] }),
    enabled: !!orgId,
  });
  const venues = venueData?.venues || [];
  const firstVenue = venues[0];

  const query = useQuery({
    queryKey: ['guests', eventId],
    queryFn: () => sdk.guests.list(eventId),
    placeholderData: keepPreviousData,
  });

  const allGuests = query.data?.guests ?? [];
  const counts    = query.data?.counts;

  const visibleGuests = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    let out = allGuests;
    if (statusFilter !== 'all') {
      out = out.filter((g) => g.rsvp_status === statusFilter);
    }
    if (q) {
      out = out.filter((g) =>
        g.full_name.toLowerCase().includes(q) ||
        (g.email ?? '').toLowerCase().includes(q) ||
        (g.party_name ?? '').toLowerCase().includes(q),
      );
    }
    const factor = sortDir === 'asc' ? 1 : -1;
    out = [...out].sort((a, b) => {
      const ak = sortValue(a, sortKey);
      const bk = sortValue(b, sortKey);
      if (ak < bk) return -1 * factor;
      if (ak > bk) return  1 * factor;
      return 0;
    });
    return out;
  }, [allGuests, debouncedSearch, statusFilter, sortKey, sortDir]);

  function handleSortClick(k: GuestSortKey) {
    if (sortKey === k) {
      setSortDir((d) => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(k);
      setSortDir('asc');
    }
  }

  function handleRowClick(g: SdkGuest) {
    setDetailGuest(g);
    setDetailOpen(true);
  }

  const isFiltered = !!debouncedSearch || statusFilter !== 'all';
  function clearFilters() {
    setSearch('');
    setStatusFilter('all');
  }

  // Update lodging mutation - typed as Promise<void>
  const saveLodgingMutation = useMutation<void, Error, LodgingFloor[]>({
    mutationFn: async (floors: LodgingFloor[]) => {
      if (firstVenue) {
        const metadata = typeof (firstVenue as any).metadata === 'string' ? JSON.parse((firstVenue as any).metadata) : ((firstVenue as any).metadata || {});
        await sdk.venues.update(firstVenue.id, {
          metadata: { ...metadata, floors }
        });
      }
    },
    onSuccess: () => {
      toast({ title: 'Lodging layouts updated successfully', variant: 'success' });
      setLodgingOpen(false);
      if (orgId) qc.invalidateQueries({ queryKey: ['venues', orgId] });
    },
  });

  const parsedFloors = useMemo(() => {
    if (!firstVenue) return [];
    const metadata = typeof (firstVenue as any).metadata === 'string' ? JSON.parse((firstVenue as any).metadata) : ((firstVenue as any).metadata || {});
    return metadata.floors || [];
  }, [firstVenue]);

  return (
    <div className="space-y-4">
      <GuestsToolbar
        eventId={eventId}
        search={search}
        onSearchChange={setSearch}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        counts={counts}
        selectedIds={[...selectedIds]}
        onSelectionCleared={() => setSelectedIds(new Set())}
        onAddClick={() => setCreateOpen(true)}
        onImportClick={() => setImportOpen(true)}
        onCopyEmails={() => {
          const emails = (query.data?.guests ?? []).filter(g => g.email).map(g => g.email).join(", ");
          if (emails) { navigator.clipboard.writeText(emails); }
        }}
      />

      {query.isLoading ? (
        <Card><CardContent className="pt-6 space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10" />)}
        </CardContent></Card>
      ) : query.isError ? (
        <Card><CardContent className="pt-6 text-sm text-danger">
          {(query.error as Error).message}
        </CardContent></Card>
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
        <LodgingBuilder
          eventId={eventId}
          venueId={firstVenue?.id || 'demo-venue'}
          venueName={firstVenue?.name || 'Grand Manor Suites'}
          venueWidth={firstVenue?.width || 60}
          venueHeight={firstVenue?.height || 40}
          initialFloors={parsedFloors}
          onSave={(floors) => saveLodgingMutation.mutate(floors)}
          onClose={() => setLodgingOpen(false)}
        />
      )}
    </div>
  );
}
