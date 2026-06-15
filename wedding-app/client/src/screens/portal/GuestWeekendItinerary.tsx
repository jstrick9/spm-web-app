import { useMemo, useState } from 'react';
import { CalendarDays, HelpCircle, MapPin } from 'lucide-react';
import { Badge } from '../../ui/Badge';
import { Button } from '../../ui/Button';
import type { PortalGuestEntry } from '../../sdk/portalTypes';

type Palette = { surface: string; border: string; fg: string; fgMuted: string; primary: string; primaryFg: string };

type ScheduleTab = 'wedding' | 'subevents';

function dayKey(value?: string | null) {
  if (!value) return 'Date TBD';
  return new Date(value).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
}

export function GuestWeekendItinerary({
  eventId,
  timeline,
  subEvents,
  activeGuest,
  palette,
  guestSchedule,
}: {
  eventId: string;
  timeline: any[];
  subEvents: any[];
  activeGuest?: PortalGuestEntry;
  palette: Palette;
  guestSchedule?: { timezone: string; ceremonyArrivalTime: string | null; ceremonyStartTime: string | null; receptionEndTime: string | null; shuttleDepartureTime: string | null; afterPartyTime: string | null; calendarUrl: string; hiddenInternalCount: number; changeAlerts: Array<Record<string, any>> } | null;
}) {
  const [scheduleTab, setScheduleTab] = useState<ScheduleTab>('wedding');
  const groupedSubEvents = useMemo(() => {
    const visible = activeGuest
      ? subEvents.filter((sub: any) => sub.itineraryStatus === 'invited' || !sub.invite_only || activeGuest.subEventInvites?.includes(sub.id))
      : subEvents.filter((sub: any) => !sub.invite_only);
    const groups = new Map<string, any[]>();
    for (const sub of visible) {
      const key = dayKey(sub.starts_at);
      groups.set(key, [...(groups.get(key) || []), sub]);
    }
    return Array.from(groups.entries());
  }, [activeGuest, subEvents]);
  const hiddenInviteOnly = activeGuest ? subEvents.filter((sub: any) => sub.invite_only && sub.itineraryStatus !== 'invited' && !activeGuest.subEventInvites?.includes(sub.id)) : [];

  return (
    <div id="guest-schedule-info" className="space-y-4 pt-6" style={{ borderTop: `1px solid ${palette.border}` }}>
      <h3 className="font-display text-2xl text-center">Guest Schedule</h3><p className="text-center text-xs text-fg-muted">Guest-only schedule in {guestSchedule?.timezone || 'local time'} — internal setup, vendor arrival, staff, load-in/load-out, and private notes are hidden.</p>
      {guestSchedule?.hiddenInternalCount ? <p className="text-center text-[11px] text-fg-subtle">{guestSchedule.hiddenInternalCount} internal timeline item(s) hidden from guests.</p> : null}
      <div className="grid gap-2 sm:grid-cols-5 text-xs">
        <ScheduleStat label="Arrival" value={guestSchedule?.ceremonyArrivalTime || 'TBD'} palette={palette} />
        <ScheduleStat label="Ceremony" value={guestSchedule?.ceremonyStartTime || 'TBD'} palette={palette} />
        <ScheduleStat label="Reception ends" value={guestSchedule?.receptionEndTime || 'TBD'} palette={palette} />
        <ScheduleStat label="Shuttle" value={guestSchedule?.shuttleDepartureTime || 'TBD'} palette={palette} />
        <ScheduleStat label="After-party" value={guestSchedule?.afterPartyTime || 'TBD'} palette={palette} />
      </div>
      {(guestSchedule?.changeAlerts || []).length > 0 && <div className="rounded-xl border border-warning/30 bg-warning-soft/20 p-3 text-xs text-warning"><strong>Schedule changes:</strong>{guestSchedule!.changeAlerts.map((alert: any, index) => <p key={index}>{alert.title || 'Schedule updated'} — {alert.body || alert.message || ''}</p>)}</div>}
      <div className="flex flex-wrap justify-center gap-2"><Button asChild size="sm" variant="outline"><a href={guestSchedule?.calendarUrl || `/api/portal/${eventId}/calendar.ics`} download><CalendarDays className="h-4 w-4" /> Add full schedule to calendar</a></Button></div>
      <div className="flex justify-center border border-border p-1 rounded-xl bg-surface max-w-sm mx-auto">
        <button type="button" onClick={() => setScheduleTab('wedding')} className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${scheduleTab === 'wedding' ? 'bg-brand text-brand-fg' : 'text-fg-muted hover:bg-surface-2'}`}>Ceremony Run of Show</button>
        <button type="button" onClick={() => setScheduleTab('subevents')} className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${scheduleTab === 'subevents' ? 'bg-brand text-brand-fg' : 'text-fg-muted hover:bg-surface-2'}`}>Weekend Sub-Events</button>
      </div>
      {scheduleTab === 'wedding' ? (
        <div className="space-y-3 bg-surface p-4 rounded-xl border text-left" style={{ borderColor: palette.border }}>
          {timeline.length === 0 ? <p className="text-xs text-fg-subtle italic text-center py-4">No wedding milestones published yet.</p> : timeline.slice(0, 8).map((item: any) => <div key={item.id} className="flex gap-4 items-start text-xs border-b last:border-0 pb-2.5 last:pb-0"><Badge variant="outline" className="text-[9px] font-bold text-brand bg-brand-soft/10 select-none py-0.5 px-1.5 shrink-0">{item.starts_at ? new Date(item.starts_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : item.time || 'TBD'}</Badge><div className="space-y-0.5"><div className="font-bold text-fg">{item.title}</div>{item.description && <p className="text-[10px] text-fg-subtle font-semibold">{item.description}</p>}</div></div>)}
        </div>
      ) : (
        <div className="space-y-4 bg-surface p-4 rounded-xl border text-left" style={{ borderColor: palette.border }}>
          {groupedSubEvents.length === 0 ? <p className="text-xs text-fg-subtle italic text-center py-4">No public weekend sub-events scheduled yet.</p> : groupedSubEvents.map(([day, events]) => <div key={day} className="space-y-2"><h4 className="text-xs font-black uppercase tracking-widest" style={{ color: palette.primary }}>{day}</h4>{events.map((sub: any) => <SubEventCard key={sub.id} eventId={eventId} sub={sub} activeGuest={activeGuest} palette={palette} />)}</div>)}
          {hiddenInviteOnly.length > 0 && <div className="rounded-lg border border-border p-3 text-xs text-fg-muted"><strong>Not on your itinerary:</strong> {hiddenInviteOnly.map((sub: any) => sub.title).join(', ')}. If this looks wrong, contact the venue/couple from your invitation.</div>}
        </div>
      )}
    </div>
  );
}


function ScheduleStat({ label, value, palette }: { label: string; value: string; palette: Palette }) {
  return <div className="rounded-lg border p-2 text-center" style={{ borderColor: palette.border }}><div className="font-bold" style={{ color: palette.primary }}>{label}</div><div style={{ color: palette.fgMuted }}>{value}</div></div>;
}

function SubEventCard({ eventId, sub, activeGuest, palette }: { eventId: string; sub: any; activeGuest?: PortalGuestEntry; palette: Palette }) {
  const time = sub.starts_at ? new Date(sub.starts_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }) : 'TBD';
  const status = sub.guestRsvpStatus || activeGuest?.subEventStatuses?.[sub.id] || 'pending';
  const calendarUrl = sub.calendarUrl || `/api/portal/${eventId}/sub-events/${sub.id}.ics`;
  return (
    <div className="rounded-xl border p-3 text-sm" style={{ borderColor: palette.border }}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><div><div className="font-bold">You are invited to: {sub.title}</div><p className="text-xs" style={{ color: palette.fgMuted }}>{time} · {String(sub.eventType || 'sub event').replace(/_/g, ' ')}</p></div><Badge variant={status === 'accepted' ? 'success' : status === 'declined' ? 'danger' : 'outline'}>{status.replace('_', ' ')}</Badge></div>
      <div className="mt-2 grid gap-2 sm:grid-cols-2 text-xs" style={{ color: palette.fgMuted }}>
        {sub.location && <p><MapPin className="inline h-3.5 w-3.5 mr-1" />{sub.location}</p>}
        {sub.host && <p>Host: {sub.host}</p>}
        {sub.dressCode && <p>Dress code: {sub.dressCode}</p>}
        {sub.parking && <p>Parking: {sub.parking}</p>}
        {sub.dietaryFields && <p>Dietary: {sub.dietaryFields}</p>}
        {sub.lateArrivalInstructions && <p>Late arrival: {sub.lateArrivalInstructions}</p>}
        {(sub.contactName || sub.contactEmail || sub.helpText) && <p><HelpCircle className="inline h-3.5 w-3.5 mr-1" />{sub.helpText || `${sub.contactName || 'Contact'} ${sub.contactEmail || ''}`}</p>}
      </div>
      <Button asChild size="sm" variant="outline" className="mt-3"><a href={calendarUrl} download><CalendarDays className="h-4 w-4" /> Add this event to calendar</a></Button>
    </div>
  );
}
