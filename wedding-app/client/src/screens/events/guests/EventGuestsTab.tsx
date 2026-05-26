/**
 * EventGuestsTab — the "Guests" tab inside EventDetail.
 *
 * Composes the toolbar + table + drawer + create dialog. Owns search /
 * filter / sort / selection state so the toolbar's bulk-actions bar can
 * see the selected ids.
 */
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useDebouncedValue } from '../../../lib/useDebouncedValue';
import { sdk } from '../../../sdk';
import type { SdkGuest } from '../../../sdk/types';
import { Card, CardContent } from '../../../ui/Card';
import { Skeleton } from '../../../ui/Skeleton';
import { GuestFormDialog } from './GuestFormDialog';
import { GuestDetailDrawer } from './GuestDetailDrawer';
import { GuestsTable, type GuestSortKey } from './GuestsTable';
import { GuestsToolbar, type GuestStatusFilter } from './GuestsToolbar';

interface Props { eventId: string }

export function EventGuestsTab({ eventId }: Props) {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 250);
  const [statusFilter, setStatusFilter] = useState<GuestStatusFilter>('all');
  const [sortKey, setSortKey] = useState<GuestSortKey>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [createOpen, setCreateOpen] = useState(false);
  const [detailGuest, setDetailGuest] = useState<SdkGuest | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const query = useQuery({
    queryKey: ['guests', eventId],
    queryFn: () => sdk.guests.list(eventId),
    placeholderData: keepPreviousData,
  });

  const allGuests = query.data?.guests ?? [];
  const counts    = query.data?.counts;

  // Client-side filter + sort. (Server-side will arrive when we have
  // events with > 500 guests; for now this gives instant UX.)
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
    </div>
  );
}

function sortValue(g: SdkGuest, k: GuestSortKey): string {
  switch (k) {
    case 'name':  return g.full_name.toLowerCase();
    case 'email': return (g.email ?? '').toLowerCase();
    case 'party': return (g.party_name ?? '').toLowerCase();
    case 'rsvp':  return g.rsvp_status;
    case 'table': return (g.table_assignment ?? '').toLowerCase();
  }
}
