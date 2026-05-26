/**
 * GuestsTable — sortable, multi-selectable guests table.
 *
 * - Click a row → open the detail drawer
 * - Click the checkbox cell → toggle row selection (doesn't open drawer)
 * - Click a column header → sort by that column (asc → desc → none)
 * - Inline RSVP status pill is a dropdown — click to change without
 *   opening the drawer
 *
 * Sorting + selection state are owned by the parent (EventGuestsTab)
 * because the toolbar needs to show selected count + bulk actions.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, ChevronsUpDown, Mail, Plus } from 'lucide-react';
import type { ReactNode } from 'react';
import { sdk } from '../../../sdk';
import type { SdkGuest, SdkRsvpStatus } from '../../../sdk/types';
import { Checkbox } from '../../../ui/Checkbox';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '../../../ui/DropdownMenu';
import { EmptyState } from '../../../ui/EmptyState';
import { Button } from '../../../ui/Button';
import { cn } from '../../../ui/lib/cn';
import { useToast } from '../../../ui/Toast';
import { RSVP_META, rsvpOrder, RsvpBadge } from './rsvpMeta';

export type GuestSortKey = 'name' | 'rsvp' | 'table' | 'email' | 'party';

export interface GuestsTableProps {
  eventId: string;
  guests: SdkGuest[];
  selectedIds: Set<string>;
  onSelectionChange: (next: Set<string>) => void;
  sortKey: GuestSortKey;
  sortDir: 'asc' | 'desc';
  onSortChange: (key: GuestSortKey) => void;
  onRowClick: (g: SdkGuest) => void;
  /** If search/filter is active, render a more useful empty-state CTA. */
  filtered: boolean;
  onClearFilters: () => void;
  onAddGuest: () => void;
}

export function GuestsTable({
  eventId, guests, selectedIds, onSelectionChange,
  sortKey, sortDir, onSortChange,
  onRowClick, filtered, onClearFilters, onAddGuest,
}: GuestsTableProps) {
  const qc = useQueryClient();
  const { toast } = useToast();

  const allSelected     = guests.length > 0 && guests.every((g) => selectedIds.has(g.id));
  const someSelected    = !allSelected && guests.some((g) => selectedIds.has(g.id));
  const selectAllState  = allSelected ? true : someSelected ? 'indeterminate' as const : false;

  function toggleAll(next: boolean | 'indeterminate') {
    const wantAll = next === true || next === 'indeterminate';
    const out = new Set(selectedIds);
    for (const g of guests) {
      if (wantAll) out.add(g.id);
      else         out.delete(g.id);
    }
    onSelectionChange(out);
  }

  function toggleOne(id: string, next: boolean | 'indeterminate') {
    const out = new Set(selectedIds);
    if (next === true) out.add(id);
    else               out.delete(id);
    onSelectionChange(out);
  }

  // Inline RSVP update with optimistic refresh.
  const updateRsvp = useMutation({
    mutationFn: ({ id, status }: { id: string; status: SdkRsvpStatus }) =>
      sdk.guests.update(id, { rsvpStatus: status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['guests', eventId] });
      qc.invalidateQueries({ queryKey: ['guests-counts', eventId] });
    },
    onError: (e) => toast({
      title: 'Could not update RSVP',
      description: (e as Error).message,
      variant: 'destructive',
    }),
  });

  if (guests.length === 0) {
    return (
      <div className="rounded-card border border-border bg-surface">
        <EmptyState
          icon={<Mail className="h-5 w-5" />}
          title={filtered ? 'No guests match your filters' : 'No guests yet'}
          description={filtered ? 'Try clearing filters or adjusting your search.' : 'Add your first guest manually or import a CSV.'}
          action={filtered
            ? <Button variant="outline" onClick={onClearFilters}>Clear filters</Button>
            : <Button onClick={onAddGuest}><Plus className="h-4 w-4" />Add guest</Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-card border border-border bg-surface">
      <table className="w-full text-sm">
        <thead className="bg-surface-2/60">
          <tr>
            <th className="w-10 px-3 py-2.5">
              <Checkbox
                checked={selectAllState}
                onCheckedChange={toggleAll}
                aria-label="Select all guests"
              />
            </th>
            <SortHeader k="name"  current={sortKey} dir={sortDir} onClick={onSortChange}>Name</SortHeader>
            <SortHeader k="email" current={sortKey} dir={sortDir} onClick={onSortChange}>Email</SortHeader>
            <SortHeader k="party" current={sortKey} dir={sortDir} onClick={onSortChange}>Party</SortHeader>
            <SortHeader k="rsvp"  current={sortKey} dir={sortDir} onClick={onSortChange}>RSVP</SortHeader>
            <SortHeader k="table" current={sortKey} dir={sortDir} onClick={onSortChange}>Table</SortHeader>
            <th className="px-3 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-fg-subtle">Tags</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {guests.map((g) => (
            <tr
              key={g.id}
              onClick={() => onRowClick(g)}
              className={cn(
                'cursor-pointer transition-colors',
                selectedIds.has(g.id) ? 'bg-brand-soft/40' : 'hover:bg-surface-2/60',
              )}
            >
              <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                <Checkbox
                  checked={selectedIds.has(g.id)}
                  onCheckedChange={(v) => toggleOne(g.id, v)}
                  aria-label={`Select ${g.full_name}`}
                />
              </td>
              <td className="px-3 py-2.5 font-medium">{g.full_name}</td>
              <td className="px-3 py-2.5 text-fg-muted">
                {g.email ?? <span className="text-fg-subtle">—</span>}
              </td>
              <td className="px-3 py-2.5 text-fg-muted">
                {g.party_name ?? <span className="text-fg-subtle">—</span>}
              </td>
              <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="inline-flex items-center"
                      aria-label={`Change RSVP for ${g.full_name}`}
                    >
                      <RsvpBadge status={g.rsvp_status} />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    {rsvpOrder.map((s) => (
                      <DropdownMenuItem
                        key={s}
                        onSelect={() => updateRsvp.mutate({ id: g.id, status: s })}
                        disabled={s === g.rsvp_status}
                      >
                        <span
                          className="inline-block h-2.5 w-2.5 rounded-pill"
                          style={{ background: RSVP_META[s].dotColor }}
                          aria-hidden="true"
                        />
                        {RSVP_META[s].label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </td>
              <td className="px-3 py-2.5 text-fg-muted">
                {g.table_assignment ?? <span className="text-fg-subtle">—</span>}
              </td>
              <td className="px-3 py-2.5">
                <TagCell guest={g} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Helpers ───────────────────────────────────────────────
function SortHeader({
  k, current, dir, onClick, children,
}: {
  k: GuestSortKey; current: GuestSortKey; dir: 'asc' | 'desc';
  onClick: (k: GuestSortKey) => void; children: ReactNode;
}) {
  const isActive = current === k;
  const Icon = !isActive ? ChevronsUpDown : dir === 'asc' ? ArrowUp : ArrowDown;
  return (
    <th className="px-3 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-fg-subtle">
      <button
        type="button"
        onClick={() => onClick(k)}
        className={cn(
          'inline-flex items-center gap-1 hover:text-fg transition-colors',
          isActive && 'text-fg',
        )}
      >
        {children}
        <Icon className={cn('h-3 w-3', !isActive && 'opacity-40')} />
      </button>
    </th>
  );
}

function TagCell({ guest }: { guest: SdkGuest }) {
  const tags: string[] = [];
  if (guest.plus_one_allowed === 1) tags.push('+1');
  if (guest.dietary_restrictions)   tags.push('🍽 diet');
  if (guest.accessibility_notes)    tags.push('♿ access');
  if (guest.allow_portal_access === 0) tags.push('🔒 no portal');
  if (tags.length === 0) return <span className="text-fg-subtle text-xs">—</span>;
  return (
    <span className="flex flex-wrap gap-1">
      {tags.map((t) => (
        <span
          key={t}
          className="inline-flex items-center rounded-pill bg-surface-2 px-2 py-0.5 text-[10px] text-fg-muted"
        >
          {t}
        </span>
      ))}
    </span>
  );
}
