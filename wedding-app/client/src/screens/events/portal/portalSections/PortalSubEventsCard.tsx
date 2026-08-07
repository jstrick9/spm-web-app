import { useState } from "react";
import {
  Settings,
  CalendarDays,
  Globe,
  Lock,
  Key,
  Link as LinkIcon,
  Save,
  ExternalLink,
  Heart,
  Sparkles,
  MessageSquare,
  CheckSquare,
  Palette,
  ShieldCheck,
  AlertTriangle,
  Smartphone,
  Mail,
  Inbox,
  Accessibility,
  ClipboardList,
  Plus,
} from "lucide-react";
import { Button } from "../../../../ui/Button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "../../../../ui/Card";
import { Input } from "../../../../ui/Input";

export interface PortalSubEventsCardProps {
  isLoading: any;
  subEvents: any[];
  updateSubEventMutation: any;
  createSubEventMutation?: any;
}

export function PortalSubEventsCard({ isLoading, subEvents, updateSubEventMutation, createSubEventMutation }: PortalSubEventsCardProps) {
  // Creating sub-events (rehearsal dinner, welcome party, brunch, after
  // party) was impossible from the UI — the SDK/server supported it but no
  // screen wired it. Guests never saw weekend itinerary cards unless the
  // venue created sub-events by API.
  const [newTitle, setNewTitle] = useState("");
  const [newStartsAt, setNewStartsAt] = useState("");
  const [newInviteOnly, setNewInviteOnly] = useState(false);

  const canCreate = !!createSubEventMutation;
  const create = () => {
    if (!newTitle.trim() || !newStartsAt) return;
    createSubEventMutation.mutate({ title: newTitle.trim(), startsAt: newStartsAt, inviteOnly: newInviteOnly });
    setNewTitle("");
    setNewStartsAt("");
    setNewInviteOnly(false);
  };

  return (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2"><CalendarDays className="h-4 w-4 text-brand" /> Guest-facing sub-event details</CardTitle>
              <CardDescription>Structured fields for rehearsal dinner, welcome party, brunch, after-party, and invite-only guest itinerary cards.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {canCreate && (
                <div className="rounded-lg border border-brand/20 bg-brand-soft/10 p-3 space-y-2">
                  <div className="text-sm font-bold flex items-center gap-2"><Plus className="h-4 w-4 text-brand" /> Add a sub-event</div>
                  <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto_auto]">
                    <Input aria-label="Sub-event title" placeholder="Rehearsal dinner, welcome party, brunch…" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
                    <Input aria-label="Sub-event start time" type="datetime-local" value={newStartsAt} onChange={(e) => setNewStartsAt(e.target.value)} />
                    <label className="flex items-center gap-2 text-sm whitespace-nowrap"><input type="checkbox" checked={newInviteOnly} onChange={(e) => setNewInviteOnly(e.target.checked)} /> Invite-only</label>
                    <Button size="sm" onClick={create} disabled={!newTitle.trim() || !newStartsAt || createSubEventMutation?.isPending} isLoading={createSubEventMutation?.isPending}>Add sub-event</Button>
                  </div>
                  <p className="text-xs text-fg-muted">The new sub-event appears in guests' weekend itinerary; then add guest-facing details below.</p>
                </div>
              )}
              {subEvents.length === 0 ? <p className="rounded-lg border border-dashed border-border p-3 text-sm text-fg-muted">{canCreate ? "No sub-events yet. Use the form above to add the first one." : "No sub-events created yet. Add rehearsal dinner or weekend events from the event timeline/sub-event tools."}</p> : subEvents.map((sub: any) => {
                const meta = typeof sub.metadata === 'string' ? JSON.parse(sub.metadata || '{}') : sub.metadata || {};
                const save = () => {
                  const fields = ['eventType','location','host','dressCode','parking','dietaryFields','lateArrivalInstructions','contactName','contactEmail','helpText'];
                  const next = { ...meta } as Record<string, unknown>;
                  for (const field of fields) {
                    const el = document.getElementById(`sub-${sub.id}-${field}`) as HTMLInputElement | HTMLTextAreaElement | null;
                    if (el) next[field] = el.value;
                  }
                  updateSubEventMutation.mutate({ id: sub.id, metadata: next });
                };
                return <div key={sub.id} className="rounded-xl border border-border bg-surface-2 p-3 space-y-2"><div className="flex items-center justify-between gap-2"><div><strong>{sub.title}</strong><p className="text-xs text-fg-muted">{sub.invite_only ? 'Invite-only' : 'Public'} · {sub.starts_at ? new Date(sub.starts_at).toLocaleString() : 'Time TBD'}</p></div><Button size="xs" onClick={save} isLoading={updateSubEventMutation.isPending}>Save details</Button></div><div className="grid gap-2 sm:grid-cols-3"><Input id={`sub-${sub.id}-eventType`} defaultValue={meta.eventType || ''} placeholder="eventType: rehearsal_dinner" /><Input id={`sub-${sub.id}-location`} defaultValue={meta.location || ''} placeholder="Location/address" /><Input id={`sub-${sub.id}-host`} defaultValue={meta.host || ''} placeholder="Host" /><Input id={`sub-${sub.id}-dressCode`} defaultValue={meta.dressCode || ''} placeholder="Dress code" /><Input id={`sub-${sub.id}-parking`} defaultValue={meta.parking || ''} placeholder="Parking" /><Input id={`sub-${sub.id}-dietaryFields`} defaultValue={meta.dietaryFields || ''} placeholder="Dietary notes" /><Input id={`sub-${sub.id}-contactName`} defaultValue={meta.contactName || ''} placeholder="Contact name" /><Input id={`sub-${sub.id}-contactEmail`} defaultValue={meta.contactEmail || ''} placeholder="Contact email" /><Input id={`sub-${sub.id}-lateArrivalInstructions`} defaultValue={meta.lateArrivalInstructions || ''} placeholder="Late-arrival instructions" /></div><textarea id={`sub-${sub.id}-helpText`} defaultValue={meta.helpText || ''} className="min-h-16 w-full rounded-md border border-border bg-surface p-2 text-sm" placeholder="Guest help text for this sub-event…" /></div>;
              })}
            </CardContent>
          </Card>
  );
}
