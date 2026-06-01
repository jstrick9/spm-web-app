/**
 * EventQuickSwitcher — dropdown in EventDetail to jump between events.
 *
 * Shows a compact dropdown of all org events sorted by date,
 * with status badges. Click → navigate to that event's detail.
 */
import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, Calendar } from 'lucide-react';
import { sdk } from '../../sdk';
import { useRouter } from '../../lib/router';
import { Badge } from '../../ui/Badge';
import { cn } from '../../ui/lib/cn';

interface Props {
  currentEventId: string;
  orgId: string;
}

const STATUS_COLOR: Record<string, string> = {
  lead: 'bg-chart-1', hold: 'bg-chart-4', booked: 'bg-chart-2',
  planning: 'bg-chart-3', completed: 'bg-chart-5', cancelled: 'bg-surface-2', lost: 'bg-surface-2',
};

export function EventQuickSwitcher({ currentEventId, orgId }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { navigate } = useRouter();

  const { data } = useQuery({
    queryKey: ['events', orgId],
    queryFn: () => sdk.events.list(orgId),
    staleTime: 30_000,
  });

  const events = data?.events ?? [];
  const otherEvents = events.filter(e => e.id !== currentEventId);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  if (otherEvents.length === 0) return null;

  return (
    <div ref={ref} className="relative inline-block">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1 text-xs text-fg-muted hover:text-fg transition-colors rounded px-2 py-1 hover:bg-surface-2"
        aria-label="Switch to another event"
      >
        <Calendar className="h-3 w-3" />
        Switch event
        <ChevronDown className={cn("h-3 w-3 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 z-50 w-72 rounded-lg border border-border bg-surface shadow-elev-2 py-1 max-h-64 overflow-y-auto">
          {otherEvents
            .sort((a, b) => (a.start_date ?? '').localeCompare(b.start_date ?? ''))
            .map(e => (
              <button
                key={e.id}
                onClick={() => { setOpen(false); navigate(`/events/${e.id}`); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-surface-2 transition-colors"
              >
                <span className={cn("w-2 h-2 rounded-full shrink-0", STATUS_COLOR[e.status] ?? 'bg-surface-2')} />
                <span className="flex-1 truncate font-medium">{e.title}</span>
                <span className="text-[10px] text-fg-subtle shrink-0">{e.start_date ?? 'TBD'}</span>
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
