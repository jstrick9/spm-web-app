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
 *
 * ── Phase 34c: aria-sort on sort column headers ───────────────────────────
 *
 * BUG FIXED: SortHeader previously rendered a sort button with NO:
 *   - aria-sort on the <th>        (WCAG 1.3.1 / ARIA 1.2 violation)
 *   - aria-label on the button     (icon-only button, WCAG 4.1.2 violation)
 *   - aria-hidden on the sort icon (icon was announced by screen readers)
 *
 * WCAG impact: A screen reader user clicking "Name" to sort had NO way to
 * know the current sort state. The column appeared identical whether sorted
 * ascending or descending. NVDA / JAWS announce aria-sort as "sorted
 * ascending" / "sorted descending" / "sortable" automatically — zero extra
 * visual change is needed.
 *
 * FIX APPLIED:
 *   1. aria-sort on <th> — values: 'ascending' | 'descending' | 'none'
 *      - 'none' = sortable but not the active sort column
 *      - absent = not sortable (Tags, checkbox column — intentional)
 *   2. aria-label on button — describes current state + next action:
 *      "Sort by Name"
 *      "Sort by Name, currently ascending. Click to sort descending."
 *      "Sort by Name, currently descending. Click to clear sort."
 *   3. aria-hidden="true" on the sort icon SVG — it is decorative beside text
 *
 * All other behaviour (sorting logic, row selection, inline RSVP, tag cell)
 * is identical to the prior version.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, ChevronsUpDown, Mail, Plus } from 'lucide-react';
import type { ReactNode } from 'react';
import { sdk } from '../../../sdk';
import type { SdkGuest, SdkRsvpStatus } from '../../../sdk/types';
import { Checkbox } from '../../../ui/Checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
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

// ── Column metadata (label used for aria-label generation) ────────────────
const SORT_COLUMN_LABELS: Record<GuestSortKey, string> = {
  name:  'Name',
  email: 'Email',
  party: 'Party',
  rsvp:  'RSVP',
  table: 'Table',
};

export function GuestsTable({
  eventId,
  guests,
  selectedIds,
  onSelectionChange,
  sortKey,
  sortDir,
  onSortChange,
  onRowClick,
  filtered,
  onClearFilters,
  onAddGuest,
}: GuestsTableProps) {
  const qc = useQueryClient();
  const { toast } = useToast();

  const allSelected = guests.length > 0 && guests.every((g) => selectedIds.has(g.id));
  const someSelected = !allSelected && guests.some((g) => selectedIds.has(g.id));
  const selectAllState = allSelected ? true : someSelected ? ('indeterminate' as const) : false;

  function toggleAll(next: boolean | 'indeterminate') {
    const wantAll = next === true || next === 'indeterminate';
    const out = new Set(selectedIds);
    for (const g of guests) {
      if (wantAll) out.add(g.id);
      else out.delete(g.id);
    }
    onSelectionChange(out);
  }

  function toggleOne(id: string, next: boolean | 'indeterminate') {
    const out = new Set(selectedIds);
    if (next === true) out.add(id);
    else out.delete(id);
    onSelectionChange(out);
  }

  // Inline RSVP update with optimistic refresh
  const updateRsvp = useMutation({
    mutationFn: ({ id, status }: { id: string; status: SdkRsvpStatus }) =>
      sdk.guests.update(id, { rsvpStatus: status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['guests', eventId] });
      qc.invalidateQueries({ queryKey: ['guests-counts', eventId] });
    },
    onError: (e) =>
      toast({
        title: 'Could not update RSVP',
        description: (e as Error).message,
        variant: 'destructive',
      }),
  });

  // ── Empty state ──────────────────────────────────────────────────────────
  if (guests.length === 0) {
    return (
      <div className="rounded-card border border-border bg-surface">
        <EmptyState
          icon={<Mail className="h-5 w-5" />}
          title={filtered ? 'No guests match your filters' : 'No guests yet'}
          description={
            filtered
              ? 'Try clearing filters or adjusting your search.'
              : 'Add your first guest manually or import a CSV.'
          }
          action={
            filtered ? (
              <Button variant="outline" onClick={onClearFilters}>Clear filters</Button>
            ) : (
              <Button onClick={onAddGuest}>
                <Plus className="h-4 w-4" aria-hidden="true" />
                Add guest
              </Button>
            )
          }
        />
      </div>
    );
  }

  // ── Table ────────────────────────────────────────────────────────────────
  return (
    <div className="overflow-x-auto rounded-card border border-border bg-surface">
      <table
        className="w-full text-sm"
        aria-label="Guest list"
      >
        <thead className="bg-surface-2/60">
          <tr>
            {/* Checkbox column — not sortable, no aria-sort */}
            <th
              className="w-10 px-3 py-2.5"
              scope="col"
              aria-label="Select all rows"
            >
              <Checkbox
                checked={selectAllState}
                onCheckedChange={toggleAll}
                aria-label="Select all guests"
              />
            </th>

            {/* Sortable columns — each gets aria-sort on <th> + aria-label on button */}
            <SortHeader k="name"  sortKey={sortKey} sortDir={sortDir} onSortChange={onSortChange} />
            <SortHeader k="email" sortKey={sortKey} sortDir={sortDir} onSortChange={onSortChange} />
            <SortHeader k="party" sortKey={sortKey} sortDir={sortDir} onSortChange={onSortChange} />
            <SortHeader k="rsvp"  sortKey={sortKey} sortDir={sortDir} onSortChange={onSortChange} />
            <SortHeader k="table" sortKey={sortKey} sortDir={sortDir} onSortChange={onSortChange} />

            {/* Tags column — not sortable, no aria-sort */}
            <th
              className="px-3 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-fg-subtle"
              scope="col"
            >
              Tags
            </th>
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
              {/* Checkbox cell — stopPropagation so click doesn't open drawer */}
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

              {/* RSVP — inline dropdown, stopPropagation so click doesn't open drawer */}
              <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="inline-flex items-center focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none rounded"
                      aria-label={`Change RSVP status for ${g.full_name}, currently ${g.rsvp_status}`}
                    >
                      <RsvpBadge status={g.rsvp_status} />
                      {(g as any).lateSubmission && (
                        <span className="ml-1.5 inline-flex items-center rounded-full border border-warning/40 bg-warning-soft px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-warning" title="RSVP arrived after the RSVP deadline">
                          Late RSVP
                        </span>
                      )}
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
                          className="inline-block h-2.5 w-2.5 rounded-pill mr-2"
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

// ── SortHeader ────────────────────────────────────────────────────────────
/**
 * Renders a <th> with correct ARIA sort semantics.
 *
 * WCAG 1.3.1 + ARIA 1.2 compliance:
 *   • aria-sort on <th>, NOT on the button inside
 *   • aria-sort="none" when sortable but not the active column
 *   • aria-sort="ascending" / "descending" when active
 *   • Sort icon is aria-hidden="true"
 *   • Button aria-label describes: current state + what clicking will do
 */
function SortHeader({
  k,
  sortKey,
  sortDir,
  onSortChange,
}: {
  k: GuestSortKey;
  sortKey: GuestSortKey;
  sortDir: 'asc' | 'desc';
  onSortChange: (key: GuestSortKey) => void;
}) {
  const isActive = sortKey === k;
  const label = SORT_COLUMN_LABELS[k];

  // ── aria-sort value ──────────────────────────────────────────────────────
  // 'none'        = sortable, but not currently the sorted column
  // 'ascending'   = this column is sorted low → high
  // 'descending'  = this column is sorted high → low
  const ariaSortValue: 'none' | 'ascending' | 'descending' = isActive
    ? sortDir === 'asc'
      ? 'ascending'
      : 'descending'
    : 'none';

  // ── Button aria-label ────────────────────────────────────────────────────
  // Describes what is currently happening AND what clicking will do.
  const buttonAriaLabel = !isActive
    ? `Sort by ${label}`
    : sortDir === 'asc'
      ? `Sort by ${label}, currently ascending. Click to sort descending.`
      : `Sort by ${label}, currently descending. Click to sort ascending.`;

  // ── Sort icon selection ──────────────────────────────────────────────────
  const SortIcon = !isActive ? ChevronsUpDown : sortDir === 'asc' ? ArrowUp : ArrowDown;

  return (
    <th
      scope="col"
      className="px-3 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-fg-subtle"
      aria-sort={ariaSortValue}
    >
      <button
        type="button"
        onClick={() => onSortChange(k)}
        className={cn(
          'inline-flex items-center gap-1 transition-colors',
          'hover:text-fg',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand rounded',
          isActive && 'text-fg',
        )}
        aria-label={buttonAriaLabel}
      >
        {label}
        <SortIcon
          className={cn('h-3 w-3', !isActive && 'opacity-40')}
          aria-hidden="true"
        />
      </button>
    </th>
  );
}

// ── TagCell ───────────────────────────────────────────────────────────────

function TagCell({ guest }: { guest: SdkGuest }) {
  const tags: string[] = [];
  if (guest.plus_one_allowed === 1) tags.push('+1');
  if (guest.dietary_restrictions) tags.push('Diet');
  if (guest.accessibility_notes) tags.push('Access');
  if (guest.allow_portal_access === 0) tags.push('No portal');

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
