/**
 * CrossEventGuestBrowser — Browse guests across all events in the organization.
 *
 * Features:
 *   - Full-text search across name, email, party
 *   - RSVP status filter chips with live counts
 *   - Event filter dropdown
 *   - Paginated table with sortable columns
 *   - Click-through to event detail's guest tab
 *   - Inline RSVP status editing
 *   - Export to CSV
 */
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { toCsv } from '../../lib/csv';
import {
  Download, Search, Users, ChevronLeft, ChevronRight,
  Mail, Phone, Utensils, Accessibility,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { usePermission } from '../../lib/usePermission';
import { sdk } from '../../sdk';
import type { SdkGuest, SdkGuestCounts } from '../../sdk/types';
import { PageBody, PageHeader } from '../../ui/AppShell';
import { GuestMergePanel } from './GuestMergePanel';
import { Badge } from '../../ui/Badge';
import { Button } from '../../ui/Button';
import { Card, CardContent } from '../../ui/Card';
import { Input } from '../../ui/Input';
import { Skeleton } from '../../ui/Skeleton';
import { useToast } from '../../ui/Toast';
import { useDebouncedValue } from '../../lib/useDebouncedValue';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../../ui/Select';

const RSVP_META: Record<string, { label: string; variant: 'success' | 'warning' | 'danger' | 'default' }> = {
  attending:  { label: 'Attending',  variant: 'success' },
  pending:    { label: 'Pending',    variant: 'warning' },
  declined:   { label: 'Declined',   variant: 'danger' },
  maybe:      { label: 'Maybe',      variant: 'default' },
};

const PAGE_SIZE = 25;

interface Props {
  orgId: string;
}

export function CrossEventGuestBrowser({ orgId }: Props) {
  const canManageOrg = usePermission('org.manage');
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [rsvpFilter, setRsvpFilter] = useState<string | null>(null);
  const [eventFilter, setEventFilter] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const debouncedSearch = useDebouncedValue(search, 250);

  // Fetch events for the event filter dropdown
  const eventsQuery = useQuery({
    queryKey: ['events', orgId],
    queryFn: () => sdk.events.list(orgId),
    staleTime: 60_000,
  });

  // Fetch guests with current filters
  const guestsQuery = useQuery({
    queryKey: ['org-guests', orgId, debouncedSearch, rsvpFilter, eventFilter, page],
    queryFn: () => sdk.guests.listForOrg(orgId, {
      search: debouncedSearch || undefined,
      rsvpStatus: rsvpFilter ? [rsvpFilter] : undefined,
      eventId: eventFilter ?? undefined,
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
    }),
    placeholderData: keepPreviousData,
  });

  const guests = guestsQuery.data?.guests ?? [];
  const total = guestsQuery.data?.total ?? 0;
  const counts = guestsQuery.data?.counts ?? { pending: 0, attending: 0, declined: 0, maybe: 0 };
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const totalGuests = counts.pending + counts.attending + counts.declined + counts.maybe;

  // NOTE: guest records are couple-owned (server-enforced). This cross-event
  // browser is a read-only data-quality tool for staff/owners, so no inline
  // RSVP editing is offered here — the couple manages RSVPs in their event,
  // and the venue uses the read-only venue guest manifest.
  // CSV export
  function exportCSV() {
    const headers = ['Name', 'Email', 'Phone', 'Party', 'RSVP', 'Table', 'Event', 'Dietary'];
    const rows = guests.map(g => [
      g.full_name,
      g.email ?? '',
      g.phone ?? '',
      g.party_name ?? '',
      g.rsvp_status,
      g.table_assignment ?? '',
      g.event_title ?? '',
      g.dietary_restrictions ?? '',
    ]);
    const csv = toCsv([headers, ...rows]);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `guests-export-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: 'Export complete', description: `${guests.length} guests exported.`, variant: 'success' });
  }

  return (
    <>
      <PageHeader
        title="Guests"
        description="Browse and manage guests across every event in your organization."
        actions={
          <Button variant="outline" onClick={exportCSV} disabled={guests.length === 0}>
            <Download className="h-3.5 w-3.5 mr-1" />
            Export CSV
          </Button>
        }
      />
      <PageBody className="space-y-4">
        {/* KPI band */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <KPITile label="Total Guests" value={totalGuests} />
          <KPITile label="Attending" value={counts.attending} className="text-success" />
          <KPITile label="Pending" value={counts.pending} className="text-warning" />
          <KPITile label="Declined" value={counts.declined} className="text-danger" />
        </div>

        {/* Duplicate guest detection + merge — owner/admin-only data-quality tool */}
        {canManageOrg && <GuestMergePanel orgId={orgId} />}

        {/* Filters toolbar */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-fg-muted" />
            <Input
              placeholder="Search guests by name, email, party…"
              className="pl-9"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            />
          </div>

          {/* RSVP chips */}
          <div className="flex items-center gap-1.5">
            <FilterChip
              label={`All (${totalGuests})`}
              active={!rsvpFilter}
              onClick={() => { setRsvpFilter(null); setPage(0); }}
            />
            {Object.entries(RSVP_META).map(([key, meta]) => (
              <FilterChip
                key={key}
                label={`${meta.label} (${counts[key as keyof typeof counts] ?? 0})`}
                active={rsvpFilter === key}
                onClick={() => { setRsvpFilter(rsvpFilter === key ? null : key); setPage(0); }}
                variant={meta.variant}
              />
            ))}
          </div>

          {/* Event filter */}
          <Select
            value={eventFilter ?? '__all__'}
            onValueChange={(v) => { setEventFilter(v === '__all__' ? null : v); setPage(0); }}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="All events" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All events</SelectItem>
              {(eventsQuery.data?.events ?? []).map(e => (
                <SelectItem key={e.id} value={e.id}>{e.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            {guestsQuery.isLoading ? (
              <div className="p-6 space-y-3">
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : guests.length === 0 ? (
              <div className="py-16 text-center">
                <Users className="h-10 w-10 mx-auto text-fg-subtle mb-3" />
                <p className="text-fg-muted text-sm">
                  {debouncedSearch || rsvpFilter || eventFilter
                    ? 'No guests match your filters.'
                    : 'No guests yet. Add guests to an event to see them here.'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-surface-2/50">
                      <th className="px-4 py-3 text-left font-medium text-fg-muted">Name</th>
                      <th className="px-4 py-3 text-left font-medium text-fg-muted hidden sm:table-cell">Contact</th>
                      <th className="px-4 py-3 text-left font-medium text-fg-muted hidden md:table-cell">Party</th>
                      <th className="px-4 py-3 text-left font-medium text-fg-muted">Event</th>
                      <th className="px-4 py-3 text-left font-medium text-fg-muted">RSVP</th>
                      <th className="px-4 py-3 text-left font-medium text-fg-muted hidden lg:table-cell">Table</th>
                      <th className="px-4 py-3 text-left font-medium text-fg-muted hidden lg:table-cell">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {guests.map((guest) => (
                      <GuestRow
                        key={guest.id}
                        guest={guest}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between text-sm text-fg-muted">
            <span>
              Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total} guests
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline" size="sm"
                disabled={page === 0}
                onClick={() => setPage(p => p - 1)}
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Previous
              </Button>
              <span className="text-xs">Page {page + 1} of {totalPages}</span>
              <Button
                variant="outline" size="sm"
                disabled={page >= totalPages - 1}
                onClick={() => setPage(p => p + 1)}
              >
                Next
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </PageBody>
    </>
  );
}

// ─── Sub-components ─────────────────────────────────────────

function GuestRow({
  guest,
}: {
  guest: SdkGuest & { event_title: string };
}) {
  const meta = RSVP_META[guest.rsvp_status] ?? RSVP_META.pending;

  return (
    <tr className="border-b border-border/50 hover:bg-surface-2/30 transition-colors">
      <td className="px-4 py-3">
        <div className="font-medium text-fg">{guest.full_name}</div>
      </td>
      <td className="px-4 py-3 hidden sm:table-cell">
        <div className="flex items-center gap-3 text-fg-muted">
          {guest.email && (
            <a href={`mailto:${guest.email}`} className="flex items-center gap-1 hover:text-brand" title={guest.email}>
              <Mail className="h-3.5 w-3.5" />
              <span className="max-w-[120px] truncate">{guest.email}</span>
            </a>
          )}
          {guest.phone && (
            <a href={`tel:${guest.phone}`} className="flex items-center gap-1 hover:text-brand" title={guest.phone}>
              <Phone className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
      </td>
      <td className="px-4 py-3 text-fg-muted hidden md:table-cell">
        {guest.party_name ?? '—'}
      </td>
      <td className="px-4 py-3">
        <a
          href={`#/events/${guest.event_id}?tab=guests`}
          className="text-brand hover:underline text-xs"
        >
          {guest.event_title}
        </a>
      </td>
      <td className="px-4 py-3">
        <Badge variant={meta.variant} className="text-[11px]">
          {meta.label}
        </Badge>
      </td>
      {/* RSVP is couple-owned; the cross-event browser is read-only for staff/owners. */}
      <td className="px-4 py-3 text-fg-muted text-xs hidden lg:table-cell">
        {guest.table_assignment ?? '—'}
      </td>
      <td className="px-4 py-3 hidden lg:table-cell">
        <div className="flex items-center gap-2 text-fg-subtle">
          {guest.dietary_restrictions && (
            <span title={guest.dietary_restrictions}><Utensils className="h-3.5 w-3.5 text-warning" /></span>
          )}
          {guest.accessibility_notes && (
            <span title={guest.accessibility_notes}><Accessibility className="h-3.5 w-3.5 text-info" /></span>
          )}
        </div>
      </td>
    </tr>
  );
}

function FilterChip({
  label, active, onClick, variant,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  variant?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`
        px-2.5 py-1 rounded-full text-xs font-medium transition-colors cursor-pointer
        ${active
          ? 'bg-brand text-on-brand'
          : 'bg-surface-2 text-fg-muted hover:bg-surface-2/80'
        }
      `}
    >
      {label}
    </button>
  );
}

function KPITile({ label, value, className }: { label: string; value: number; className?: string }) {
  return (
    <Card>
      <CardContent className="py-3 px-4">
        <div className="text-xs text-fg-muted">{label}</div>
        <div className={`text-2xl font-bold font-display ${className ?? ''}`}>
          {value.toLocaleString()}
        </div>
      </CardContent>
    </Card>
  );
}
