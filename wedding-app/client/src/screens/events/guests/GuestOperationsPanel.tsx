import { useState, type ReactNode } from 'react';
import type { SdkGuest } from '../../../sdk/types';
import { Card, CardContent } from '../../../ui/Card';
import { Button } from '../../../ui/Button';
import { Input } from '../../../ui/Input';
import { useToast } from '../../../ui/Toast';
import { Accessibility, HeartHandshake, Luggage, MessageSquare, Phone, Shield, Tag, UserSearch } from 'lucide-react';

const GUEST_ISSUE_TAGS = [
  { id: 'arrived_early', label: 'Arrived early' },
  { id: 'lost_item', label: 'Lost item' },
  { id: 'accessibility_assistance', label: 'Accessibility assistance' },
  { id: 'shuttle_issue', label: 'Shuttle issue' },
  { id: 'intoxication_risk', label: 'Intoxication risk' },
  { id: 'vip_request', label: 'VIP request' },
] as const;

const MANAGER_COMM_TEMPLATES = [
  { id: 'shuttle', label: 'Shuttle reminder', body: 'Reminder: shuttle pickup details and timing are available in the guest portal. Please arrive 10 minutes early.' },
  { id: 'dietary', label: 'Dietary confirmation', body: 'We are confirming dietary needs for catering. Please reply if anything changed since your RSVP.' },
  { id: 'lodging', label: 'Lodging instruction', body: 'Your lodging/cabin details are available in the guest portal. Contact the venue team if you need assistance.' },
  { id: 'arrival', label: 'Arrival logistics', body: 'Please follow venue arrival signage and check in with staff when you arrive.' },
] as const;

function safeGuestMetadata(raw: string | null | undefined): Record<string, any> {
  try { return JSON.parse(raw || '{}'); } catch { return {}; }
}

function guestIssueTags(guest: SdkGuest): string[] {
  const meta = safeGuestMetadata(guest.metadata);
  return Array.isArray(meta.guestIssueTags) ? meta.guestIssueTags : [];
}

export function GuestOperationsPanel({ guests, exceptions, onOpenGuest, onTag, onLog }: { guests: SdkGuest[]; exceptions: Record<string, SdkGuest[]>; onOpenGuest: (guest: SdkGuest) => void; onTag: (guest: SdkGuest, tag: string) => void; onLog: (guest: SdkGuest, kind: string, note: string) => void }) {
  return (
    <>
      <ManagerGuestLookup guests={guests} onOpenGuest={onOpenGuest} onTag={onTag} onLog={onLog} />
      <ManagerCommunicationTemplates />
      <ManagerGuestOperationsBoards guests={guests} exceptions={exceptions} />
      <GuestPrivacyGuidance />
    </>
  );
}

function ManagerGuestLookup({ guests, onOpenGuest, onTag, onLog }: { guests: SdkGuest[]; onOpenGuest: (guest: SdkGuest) => void; onTag: (guest: SdkGuest, tag: string) => void; onLog: (guest: SdkGuest, kind: string, note: string) => void }) {
  const [serviceNoteByGuest, setServiceNoteByGuest] = useState<Record<string, string>>({});
  const top = guests.slice(0, 8);
  return (
    <Card className="border-border bg-surface"><CardContent className="p-4 space-y-3"><div className="flex items-start gap-2"><UserSearch className="h-5 w-5 text-brand mt-0.5" /><div><h3 className="text-sm font-bold text-fg">Day-of guest lookup</h3><p className="text-xs text-fg-muted">Permanent manager tool: search above, then open details, call/SMS, tag issues, or log service interactions.</p></div></div><div className="grid gap-2 md:grid-cols-2">{top.length ? top.map((guest) => { const tags = guestIssueTags(guest); return <div key={guest.id} className="rounded-xl border border-border bg-surface-2 p-3 text-sm"><div className="flex items-start justify-between gap-2"><button type="button" onClick={() => onOpenGuest(guest)} className="text-left min-w-0"><div className="font-semibold text-fg">{guest.full_name}</div><div className="text-xs text-fg-muted">{guest.rsvp_status} · {guest.table_assignment || 'No table'}{guest.room_assignment ? ` · ${guest.room_assignment}` : ''}</div>{(guest.dietary_restrictions || guest.accessibility_notes) && <div className="mt-1 text-[11px] text-warning">{guest.dietary_restrictions || guest.accessibility_notes}</div>}</button><div className="flex gap-1 shrink-0">{guest.phone && <a href={`tel:${guest.phone}`} className="rounded-lg border border-border p-2 text-brand" aria-label={`Call ${guest.full_name}`}><Phone className="h-4 w-4" /></a>}{guest.phone && <a href={`sms:${guest.phone}`} className="rounded-lg border border-border p-2 text-brand" aria-label={`Text ${guest.full_name}`}><MessageSquare className="h-4 w-4" /></a>}</div></div><div className="mt-2 flex flex-wrap gap-1">{GUEST_ISSUE_TAGS.map((tag) => <button key={tag.id} type="button" onClick={() => onTag(guest, tag.id)} className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${tags.includes(tag.id) ? 'border-brand bg-brand text-brand-fg' : 'border-border bg-surface text-fg-muted'}`}>{tag.label}</button>)}</div><div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto]"><Input value={serviceNoteByGuest[guest.id] ?? ''} onChange={(e) => setServiceNoteByGuest({ ...serviceNoteByGuest, [guest.id]: e.target.value })} placeholder="Service log note: shuttle, lost item, VIP request..." className="h-8 text-xs" /><Button size="xs" variant="outline" onClick={() => { const note = serviceNoteByGuest[guest.id]?.trim(); if (note) { onLog(guest, 'manager_note', note); setServiceNoteByGuest({ ...serviceNoteByGuest, [guest.id]: '' }); } }}>Log</Button></div></div>; }) : <p className="text-sm text-fg-muted">No guests match the current lookup.</p>}</div></CardContent></Card>
  );
}

function ManagerCommunicationTemplates() {
  const { toast } = useToast();
  return <Card><CardContent className="p-4 space-y-3"><div><h3 className="text-sm font-bold text-brand flex items-center gap-2"><MessageSquare className="h-4 w-4" /> Manager communication templates</h3><p className="text-xs text-fg-muted mt-1">Copy safe operational language for common guest-service moments. Use approved channels and avoid exposing PII.</p></div><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{MANAGER_COMM_TEMPLATES.map((template) => <button key={template.id} type="button" onClick={() => { try { void navigator.clipboard.writeText(template.body); } catch {} toast({ title: `${template.label} copied`, description: 'Review before sending to guests.', variant: 'success' }); }} className="rounded-xl border border-border bg-surface-2 p-3 text-left hover:border-brand/40"><div className="font-bold text-fg text-xs">{template.label}</div><p className="mt-1 text-[11px] text-fg-muted line-clamp-3">{template.body}</p></button>)}</div></CardContent></Card>;
}

function ManagerGuestOperationsBoards({ guests, exceptions }: { guests: SdkGuest[]; exceptions: Record<string, SdkGuest[]> }) {
  const vipGuests = exceptions.vip.slice(0, 6);
  const accessibilityGuests = exceptions.accessibility.slice(0, 6);
  const lodgingGuests = guests.filter((g) => g.room_assignment || guestIssueTags(g).includes('shuttle_issue')).slice(0, 6);
  const lostAndFound = guests.flatMap((guest) => { const log = safeGuestMetadata(guest.metadata).guestServiceLog; return Array.isArray(log) ? log.filter((entry: any) => /lost/i.test(`${entry.kind} ${entry.note}`)).map((entry: any) => ({ guest, entry })) : []; }).slice(0, 6);
  return <div className="grid gap-4 xl:grid-cols-4"><OperationsList title="VIP concierge list" icon={<HeartHandshake className="h-4 w-4" />} items={vipGuests.map((g) => `${g.full_name}${g.phone ? ` · ${g.phone}` : ''}`)} empty="No VIP guests tagged yet." /><OperationsList title="Accessibility assistance" icon={<Accessibility className="h-4 w-4" />} items={accessibilityGuests.map((g) => `${g.full_name}: ${g.accessibility_notes || 'Assistance requested'}`)} empty="No accessibility assistance requests." /><OperationsList title="Shuttle/lodging board" icon={<Luggage className="h-4 w-4" />} items={lodgingGuests.map((g) => `${g.full_name}: ${g.room_assignment || 'Shuttle/logistics issue'}`)} empty="No lodging or shuttle issues tagged." /><OperationsList title="Lost-and-found" icon={<Tag className="h-4 w-4" />} items={lostAndFound.map(({ guest, entry }: any) => `${guest.full_name}: ${entry.note}`)} empty="No lost-and-found records linked to guests." /></div>;
}

function OperationsList({ title, icon, items, empty }: { title: string; icon: ReactNode; items: string[]; empty: string }) {
  return <Card><CardContent className="p-4 space-y-2"><h3 className="text-sm font-bold text-brand flex items-center gap-2">{icon}{title}</h3>{items.length ? items.map((item) => <div key={item} className="rounded-lg border border-border bg-surface-2 p-2 text-xs text-fg-muted">{item}</div>) : <p className="text-xs text-fg-muted rounded-lg border border-dashed border-border p-2">{empty}</p>}</CardContent></Card>;
}

function GuestPrivacyGuidance() {
  return <Card className="border-warning/30 bg-warning-soft/20"><CardContent className="p-4 text-xs text-fg-muted space-y-2"><h3 className="font-bold text-warning flex items-center gap-2"><Shield className="h-4 w-4" /> Guest privacy and note visibility</h3><p>Guest records contain PII. Use call/SMS only for event operations, avoid copying personal details outside approved tools, and keep sensitive notes factual.</p><p><strong>Who can see this guest note?</strong> Manager service logs and issue tags are internal to authenticated venue users with guest permissions. Public guest portal users do not see manager notes, issue tags, or audit trail metadata.</p></CardContent></Card>;
}
