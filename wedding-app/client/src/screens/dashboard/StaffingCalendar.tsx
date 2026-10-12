import { useState } from 'react';
import { Button } from '../../ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/Card';

type CalendarData = { calendar?: { events: Array<any>; shifts: Array<any> } };

export function StaffingCalendar({ data, isLoading, monthOffset, onMonthChange }: {
  data: CalendarData | undefined;
  isLoading: boolean;
  monthOffset: number;
  onMonthChange: (next: number) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  const days = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
  const dateKey = (day: number) => `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const selectedShifts = data?.calendar?.shifts.filter((shift: any) => String(shift.starts_at).slice(0, 10) === selected) || [];

  return <Card>
    <CardHeader>
      <div className="flex items-center justify-between gap-2">
        <div><CardTitle>Staffing calendar</CardTitle><CardDescription>Venue-wide monthly commitments. Select an event to drill into event-week staffing.</CardDescription></div>
        <div className="flex gap-2"><Button size="xs" variant="outline" onClick={() => onMonthChange(monthOffset - 1)}>Previous</Button><span className="text-sm font-medium">{start.toLocaleString(undefined, { month: 'long', year: 'numeric' })}</span><Button size="xs" variant="outline" onClick={() => onMonthChange(monthOffset + 1)}>Next</Button></div>
      </div>
    </CardHeader>
    <CardContent>{isLoading ? <p className="text-sm text-fg-muted">Loading calendar…</p> : <>
      <div className="grid grid-cols-7 gap-1 text-xs">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => <span key={day} className="text-center font-semibold text-fg-muted">{day}</span>)}
        {Array.from({ length: start.getDay() }).map((_, index) => <div key={`blank-${index}`} />)}
        {Array.from({ length: days }).map((_, index) => {
          const key = dateKey(index + 1);
          const events = data?.calendar?.events.filter((event) => event.start_date === key) || [];
          const shifts = data?.calendar?.shifts.filter((shift: any) => String(shift.starts_at).slice(0, 10) === key) || [];
          const label = `${new Date(`${key}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })} — ${events.length} event(s), ${shifts.length} shift(s)`;
          return <div key={key} className={`min-h-16 rounded border border-border p-1 ${selected === key ? 'ring-2 ring-brand' : ''}`}>
            <Button type="button" variant="ghost" size="xs" className="h-auto w-full justify-start p-0 text-left" aria-label={label} onClick={() => setSelected(key)}>
              <span className="block w-full"><strong>{index + 1}</strong>{events.map((event) => <span key={event.id} className="mt-1 block w-full truncate rounded bg-brand-soft px-1 text-left text-brand">{event.title}</span>)}{shifts.length > 0 && <span className="mt-1 block text-fg-muted">{shifts.length} shift{shifts.length === 1 ? '' : 's'}</span>}</span>
            </Button>
          </div>;
        })}
      </div>
      {selected && <div className="mt-3 rounded border border-border p-3"><strong>Shifts for {selected}</strong>{selectedShifts.length === 0 ? <p className="text-sm text-fg-muted">No shifts scheduled.</p> : <ul className="mt-2 text-sm">{selectedShifts.map((shift: any) => <li key={shift.id}>{shift.staff_name || 'Unassigned'} · {new Date(shift.starts_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</li>)}</ul>}</div>}
    </>}</CardContent>
  </Card>;
}
