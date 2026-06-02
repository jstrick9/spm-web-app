/**
 * DataTable — minimal but solid table primitive.
 *
 * For Phase 3 we use a hand-rolled component instead of @tanstack/table to
 * keep the dependency list lean. Promote to TanStack Table in a future phase
 * if we need column pinning, virtualization, or pivots.
 *
 * <DataTable
 *   data={guests}
 *   columns={[
 *     { id: 'name',    header: 'Name',    cell: (g) => g.full_name },
 *     { id: 'rsvp',    header: 'RSVP',    cell: (g) => <Badge>{g.rsvp_status}</Badge> },
 *     { id: 'actions', header: '',         cell: (g) => <Button size="xs">Edit</Button>,
 *       className: 'w-0 text-right' },
 *   ]}
 *   emptyMessage="No guests yet."
 * />
 *
 * ── Phase 34c: aria-sort support ─────────────────────────────────────────
 * Added to Column<T>:
 *   sortDir?: 'ascending' | 'descending' | 'none'
 *   onSort?:  () => void
 *   sortLabel?: string      // overrides the default aria-label on the button
 *
 * WCAG 1.3.1 + ARIA 1.2 compliance:
 *   • aria-sort is placed on <th>, not on the button inside.
 *   • Only "ascending" | "descending" | "none" are valid values.
 *     "none" = sortable but not currently sorted.
 *     ABSENT = not sortable at all.
 *   • The sort icon button has an aria-label describing current state and
 *     what will happen on click.
 *   • The sort icon SVG is aria-hidden="true" (purely decorative beside text).
 *   • Non-sortable columns (no onSort) have no aria-sort — its presence
 *     implies sortability per the ARIA spec.
 *
 * Back-compat: all existing Column<T> consumers that omit sortDir/onSort
 * continue to work identically — the <th> renders exactly as before.
 */
import { type ReactNode } from 'react';
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import { cn } from './lib/cn';

// ── Types ─────────────────────────────────────────────────────────────────

/**
 * aria-sort values per ARIA 1.2 spec.
 * 'none'       = column is sortable, but not currently sorted.
 * 'ascending'  = sorted low→high.
 * 'descending' = sorted high→low.
 * Absent       = column is NOT sortable (do not set to 'none' for non-sortable).
 */
export type AriaSortValue = 'none' | 'ascending' | 'descending';

export interface Column<T> {
  id: string;
  header: ReactNode;
  cell: (row: T, index: number) => ReactNode;
  className?: string;
  headerClassName?: string;

  // ── Sort support (Phase 34c) ───────────────────────────────────────────
  /**
   * Current sort direction for this column.
   * Set to 'none' when the column is sortable but not currently the active
   * sort key. Omit entirely for non-sortable columns.
   *
   * Drives aria-sort on the <th> element.
   */
  sortDir?: AriaSortValue;
  /**
   * Called when the user clicks the column header to sort.
   * Presence of this prop is what marks a column as sortable.
   * When provided, the header renders as a button with aria-sort on <th>.
   */
  onSort?: () => void;
  /**
   * Custom aria-label for the sort button. Defaults to a generated label:
   *   "Sort by [header text]"
   *   "Sort by [header text], ascending. Click to sort descending."
   *   "Sort by [header text], descending. Click to clear sort."
   *
   * Override when the header ReactNode is not plain text (e.g. an icon).
   */
  sortLabel?: string;
}

export interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  /** Function returning a unique key per row (default: `row.id`). */
  getRowKey?: (row: T, index: number) => string;
  /** Compact density for dashboard layouts. */
  dense?: boolean;
  emptyMessage?: ReactNode;
  /** Optional click handler for the entire row. */
  onRowClick?: (row: T) => void;
  className?: string;
  /** Accessible label for the table (used when aria-label or caption needed). */
  tableLabel?: string;
}

// ── Component ─────────────────────────────────────────────────────────────

export function DataTable<T extends { id?: string }>({
  data,
  columns,
  getRowKey,
  dense,
  emptyMessage = 'No data.',
  onRowClick,
  className,
  tableLabel,
}: DataTableProps<T>) {
  const rowKey = getRowKey ?? ((r: T, i: number) => r.id ?? String(i));
  const padY = dense ? 'py-2' : 'py-3';

  return (
    <div className={cn('overflow-x-auto rounded-card border border-border bg-surface', className)}>
      <table
        className="w-full text-sm"
        aria-label={tableLabel}
      >
        <thead className="bg-surface-2/60">
          <tr>
            {columns.map((c) => (
              <SortableHeader key={c.id} column={c} />
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-12 text-center text-fg-subtle">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((row, i) => (
              <tr
                key={rowKey(row, i)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn(
                  'transition-colors',
                  onRowClick && 'hover:bg-surface-2 cursor-pointer',
                )}
              >
                {columns.map((c) => (
                  <td key={c.id} className={cn(`px-4 ${padY}`, c.className)}>
                    {c.cell(row, i)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

// ── SortableHeader ────────────────────────────────────────────────────────
/**
 * Renders a single <th>. When the column has onSort, wraps the header content
 * in a button and applies aria-sort to the <th>.
 *
 * ARIA rules applied:
 *   • aria-sort on <th> (not on button) — per ARIA 1.2 §6.6.19
 *   • aria-sort present only when column IS sortable (onSort defined)
 *   • aria-sort="none" for sortable-but-not-active columns
 *   • Sort icon aria-hidden="true" (decorative — label is in button text)
 *   • button aria-label describes current state AND next action
 */
function SortableHeader<T>({ column: c }: { column: Column<T> }) {
  const baseThClass = cn(
    'px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-fg-subtle',
    c.headerClassName,
  );

  if (!c.onSort) {
    // Non-sortable column — plain <th>, no aria-sort
    return (
      <th key={c.id} scope="col" className={baseThClass}>
        {c.header}
      </th>
    );
  }

  // Sortable column — aria-sort on <th>, button inside
  const dir = c.sortDir ?? 'none';
  const isActive = dir !== 'none';

  // Determine which icon to show
  const SortIcon = isActive
    ? dir === 'ascending'
      ? ChevronUp
      : ChevronDown
    : ChevronsUpDown;

  // Generate aria-label for the button
  const headerText =
    typeof c.header === 'string' ? c.header : 'column';
  const label =
    c.sortLabel ??
    (dir === 'none'
      ? `Sort by ${headerText}`
      : dir === 'ascending'
        ? `Sort by ${headerText}, currently ascending. Click to sort descending.`
        : `Sort by ${headerText}, currently descending. Click to clear sort.`);

  return (
    <th
      scope="col"
      className={baseThClass}
      aria-sort={dir}          // WCAG 1.3.1 / ARIA 1.2 — on <th>, not on button
    >
      <button
        type="button"
        onClick={c.onSort}
        className={cn(
          'inline-flex items-center gap-1 hover:text-fg transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand rounded',
          isActive && 'text-fg',
        )}
        aria-label={label}
      >
        {c.header}
        <SortIcon
          className={cn('h-3 w-3', !isActive && 'opacity-40')}
          aria-hidden="true"   // icon is decorative — meaning is in aria-label
        />
      </button>
    </th>
  );
}
