import type { SpaceCommitment } from './dashboardUtils';

export function SpaceCalendarGrid({ start, commitments, onOpen, conflictedIds }: {
  start: string;
  commitments: SpaceCommitment[];
  onOpen: (id: string) => void;
  /** Event ids involved in a space double-booking; rendered with a warning badge. */
  conflictedIds?: Set<string>;
}) {
  const date = new Date(start); const days = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const keyFor = (day: number) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return <div className="grid grid-cols-7 gap-1 text-xs"><div className="col-span-7 grid grid-cols-7 gap-1 text-center font-semibold text-fg-muted">{['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((day) => <span key={day}>{day}</span>)}</div>{Array.from({ length: date.getDay() }).map((_, index) => <div key={`blank-${index}`} />)}{Array.from({ length: days }).map((_, index) => { const key = keyFor(index + 1); const daysCommitments = commitments.filter((commitment) => commitment.start_date === key); return <div key={key} className="min-h-16 rounded border border-border p-1">{daysCommitments.length > 0 && <strong>{index + 1}</strong>}{daysCommitments.map((commitment) => <button key={commitment.id} onClick={() => onOpen(commitment.id)} className={`mt-1 block w-full truncate rounded px-1 text-left ${conflictedIds?.has(commitment.id) ? 'bg-warning/20 text-warning' : 'bg-brand-soft text-brand'}`}>{commitment.venue_name || 'Unassigned'} · {commitment.title}{conflictedIds?.has(commitment.id) ? ' ⚠' : ''}</button>)}</div>; })}</div>;
}
