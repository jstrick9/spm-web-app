/**
 * SeatingReport — Printable table-by-table seating chart with dietary notes.
 *
 * Designed to be handed to:
 *   - The catering team (dietary requirements per table)
 *   - The day-of coordinator (who sits where)
 *   - The couple (for review/approval)
 *
 * Optimized for @media print — hides the app shell, uses serif font,
 * page-break-friendly layout.
 */
import { useMemo } from 'react';
import type { SdkGuest } from '../../../sdk/types';

interface Props {
  eventTitle: string;
  eventDate: string | null;
  guests: SdkGuest[];
  onClose: () => void;
}

export function SeatingReport({ eventTitle, eventDate, guests, onClose }: Props) {
  // Group guests by table assignment
  const tables = useMemo(() => {
    const map = new Map<string, SdkGuest[]>();
    for (const g of guests) {
      const table = g.table_assignment || 'Unassigned';
      if (!map.has(table)) map.set(table, []);
      map.get(table)!.push(g);
    }
    // Sort: named tables first, "Unassigned" last
    return Array.from(map.entries()).sort((a, b) => {
      if (a[0] === 'Unassigned') return 1;
      if (b[0] === 'Unassigned') return -1;
      return a[0].localeCompare(b[0]);
    });
  }, [guests]);

  // Dietary summary
  const dietarySummary = useMemo(() => {
    const counts = new Map<string, number>();
    for (const g of guests) {
      const diet = g.dietary_restrictions?.trim() || 'Standard';
      counts.set(diet, (counts.get(diet) ?? 0) + 1);
    }
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [guests]);

  return (
    <div className="fixed inset-0 z-50 bg-white overflow-auto print:static print:z-auto">
      {/* Screen-only header */}
      <div className="print:hidden sticky top-0 bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Seating & Dietary Report</h2>
        <div className="flex gap-2">
          <button onClick={() => window.print()} className="px-4 py-2 bg-black text-white rounded-md text-sm font-medium hover:bg-gray-800">
            🖨️ Print
          </button>
          <button onClick={onClose} className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium hover:bg-gray-50">
            Close
          </button>
        </div>
      </div>

      {/* Printable content */}
      <div className="max-w-4xl mx-auto p-8 font-serif text-black">
        {/* Title block */}
        <div className="text-center mb-8 pb-6 border-b-2 border-black">
          <h1 className="text-3xl font-bold tracking-tight">{eventTitle}</h1>
          {eventDate && (
            <p className="text-lg mt-2 text-gray-600">
              {new Date(eventDate).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          )}
          <p className="text-sm text-gray-500 mt-1">
            {guests.length} guests · {tables.length} tables · Generated {new Date().toLocaleDateString()}
          </p>
        </div>

        {/* Dietary summary */}
        <div className="mb-8 p-4 bg-gray-50 rounded-lg print:bg-white print:border print:border-gray-300">
          <h2 className="text-sm font-bold uppercase tracking-wider text-gray-600 mb-3">Dietary Summary for Catering</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {dietarySummary.map(([diet, count]) => (
              <div key={diet} className="flex justify-between text-sm">
                <span>{diet}</span>
                <span className="font-bold tabular-nums">{count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Table-by-table layout */}
        {tables.map(([tableName, tableGuests]) => (
          <div key={tableName} className="mb-6 break-inside-avoid">
            <h3 className="text-lg font-bold border-b border-gray-300 pb-1 mb-2">
              {tableName}
              <span className="text-sm font-normal text-gray-500 ml-2">({tableGuests.length} guests)</span>
            </h3>
            <div className="overflow-x-auto"><table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 text-xs uppercase tracking-wider">
                  <th className="py-1 pr-4">Name</th>
                  <th className="py-1 pr-4">RSVP</th>
                  <th className="py-1 pr-4">Dietary</th>
                  <th className="py-1">Notes</th>
                </tr>
              </thead>
              <tbody>
                {tableGuests.map(g => (
                  <tr key={g.id} className="border-b border-gray-100">
                    <td className="py-1.5 pr-4 font-medium">{g.full_name}</td>
                    <td className="py-1.5 pr-4">
                      <span className={
                        g.rsvp_status === 'attending' ? 'text-green-700' :
                        g.rsvp_status === 'declined' ? 'text-red-600' :
                        g.rsvp_status === 'maybe' ? 'text-yellow-600' : 'text-gray-400'
                      }>
                        {g.rsvp_status}
                      </span>
                    </td>
                    <td className="py-1.5 pr-4">{g.dietary_restrictions || '—'}</td>
                    <td className="py-1.5 text-gray-500 text-xs">
                      {g.accessibility_notes || ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          </div>
        ))}

        {/* Footer */}
        <div className="mt-12 pt-4 border-t border-gray-300 text-center text-xs text-gray-400">
          Wedding Venue Intelligence Platform · Seating Report · {eventTitle}
        </div>
      </div>
    </div>
  );
}
