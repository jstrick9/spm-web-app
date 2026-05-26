/**
 * DataTable — minimal but solid table primitive. For Phase 3 we use a
 * hand-rolled component instead of @tanstack/table to keep the dependency
 * list lean. Promote to TanStack Table in Phase 5 if we need column
 * pinning, virtualization, or pivots.
 *
 *   <DataTable
 *     data={guests}
 *     columns={[
 *       { id: 'name',  header: 'Name',   cell: (g) => g.full_name },
 *       { id: 'rsvp',  header: 'RSVP',   cell: (g) => <Badge>{g.rsvp_status}</Badge> },
 *       { id: 'actions', header: '',     cell: (g) => <Button size="xs">Edit</Button>,
 *         className: 'w-0 text-right' },
 *     ]}
 *     emptyMessage="No guests yet."
 *   />
 */
import type { ReactNode } from 'react';
import { cn } from './lib/cn';

export interface Column<T> {
  id: string;
  header: ReactNode;
  cell: (row: T, index: number) => ReactNode;
  className?: string;
  headerClassName?: string;
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
}

export function DataTable<T extends { id?: string }>({
  data, columns, getRowKey, dense, emptyMessage = 'No data.', onRowClick, className,
}: DataTableProps<T>) {
  const rowKey = getRowKey ?? ((r: T, i: number) => r.id ?? String(i));
  const padY = dense ? 'py-2' : 'py-3';

  return (
    <div className={cn('overflow-x-auto rounded-card border border-border bg-surface', className)}>
      <table className="w-full text-sm">
        <thead className="bg-surface-2/60">
          <tr>
            {columns.map((c) => (
              <th
                key={c.id}
                className={cn(
                  'px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-fg-subtle',
                  c.headerClassName,
                )}
                scope="col"
              >
                {c.header}
              </th>
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
