/**
 * GuestDetailDrawer — slide-over with full guest detail + inline editing
 * + RSVP submission history.
 */
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle, ExternalLink, Mail, MessageSquare, Phone, Trash2, UserCheck, Utensils,
} from 'lucide-react';
import { useState } from 'react';
import { sdk } from '../../../sdk';
import type { SdkGuest } from '../../../sdk/types';
import { Badge } from '../../../ui/Badge';
import { Button } from '../../../ui/Button';
import {
  Sheet, SheetBody, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle,
} from '../../../ui/Sheet';
import { Skeleton } from '../../../ui/Skeleton';
import { GuestFormDialog } from './GuestFormDialog';
import { DeleteConfirmDialog } from './DeleteConfirmDialog';
import { RsvpBadge } from './rsvpMeta';

interface Props {
  guest: SdkGuest | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted?: () => void;
}

export function GuestDetailDrawer({ guest, open, onOpenChange, onDeleted }: Props) {
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  // Load this event's RSVP submissions so we can show the history for this guest.
  const rsvpsQuery = useQuery({
    queryKey: ['rsvps', guest?.event_id],
    queryFn:  () => sdk.rsvps.list(guest!.event_id),
    enabled:  !!guest,
    staleTime: 30_000,
  });
  const myRsvps = (rsvpsQuery.data?.rsvps ?? []).filter((r) => r.guest_id === guest?.id);

  async function handleDelete() {
    if (!guest) return;
    setBusy(true);
    try {
      await sdk.guests.delete(guest.id);
      setDeleteOpen(false);
      onOpenChange(false);
      onDeleted?.();
    } finally { setBusy(false); }
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" width="lg">
          {!guest ? (
            <SheetBody><Skeleton className="h-40" /></SheetBody>
          ) : (
            <>
              <SheetHeader>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <SheetTitle className="font-display text-2xl">{guest.full_name}</SheetTitle>
                    <SheetDescription>
                      <span className="inline-flex flex-wrap items-center gap-2 mt-1">
                        <RsvpBadge status={guest.rsvp_status} />
                        {guest.party_name && (
                          <Badge variant="outline">Party: {guest.party_name}</Badge>
                        )}
                        {guest.plus_one_allowed === 1 && (
                          <Badge variant="brand">+1 allowed</Badge>
                        )}
                      </span>
                    </SheetDescription>
                  </div>
                </div>
              </SheetHeader>

              <SheetBody className="space-y-6">
                {/* Contact info */}
                <section className="space-y-2">
                  <h4 className="text-xs font-medium uppercase tracking-wider text-fg-subtle">Contact</h4>
                  <div className="space-y-2 text-sm">
                    <DetailRow icon={<Mail className="h-4 w-4" />} label="Email" value={guest.email} />
                    <DetailRow icon={<Phone className="h-4 w-4" />} label="Phone" value={guest.phone} />
                  </div>
                </section>

                {/* Assignment */}
                <section className="space-y-2">
                  <h4 className="text-xs font-medium uppercase tracking-wider text-fg-subtle">Assignment</h4>
                  <div className="space-y-2 text-sm">
                    <DetailRow icon={<UserCheck className="h-4 w-4" />} label="Table" value={guest.table_assignment} />
                    <DetailRow label="Room"  value={guest.room_assignment} />
                    <DetailRow label="Seat"  value={guest.seat_assignment} />
                  </div>
                </section>

                {/* Notes */}
                {(guest.dietary_restrictions || guest.accessibility_notes) && (
                  <section className="space-y-3">
                    <h4 className="text-xs font-medium uppercase tracking-wider text-fg-subtle">Notes</h4>
                    {guest.dietary_restrictions && (
                      <NoteCard
                        icon={<Utensils className="h-4 w-4 text-warning" />}
                        title="Dietary"
                        body={guest.dietary_restrictions}
                      />
                    )}
                    {guest.accessibility_notes && (
                      <NoteCard
                        icon={<AlertTriangle className="h-4 w-4 text-info" />}
                        title="Accessibility"
                        body={guest.accessibility_notes}
                      />
                    )}
                  </section>
                )}

                {/* RSVP history */}
                <section className="space-y-2">
                  <h4 className="text-xs font-medium uppercase tracking-wider text-fg-subtle">RSVP history</h4>
                  {rsvpsQuery.isLoading ? (
                    <Skeleton className="h-16" />
                  ) : myRsvps.length === 0 ? (
                    <p className="text-sm text-fg-subtle">No RSVPs submitted yet.</p>
                  ) : (
                    <ul className="space-y-2">
                      {myRsvps.map((r) => (
                        <li key={r.id} className="rounded-md border border-border bg-surface p-3 text-sm">
                          <div className="flex items-center justify-between">
                            <span className="font-medium">
                              {r.attending ? 'Attending' : 'Declined'}
                              {r.meal_choice && <span className="ml-1 text-fg-muted">· {r.meal_choice}</span>}
                            </span>
                            <span className="text-xs text-fg-subtle">{new Date(r.submitted_at).toLocaleString()}</span>
                          </div>
                          {r.notes && (
                            <p className="mt-1.5 text-fg-muted text-xs flex items-start gap-1">
                              <MessageSquare className="h-3 w-3 mt-0.5 shrink-0" />
                              <span>"{r.notes}"</span>
                            </p>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                {/* Portal access */}
                <section className="space-y-2 rounded-md border border-border bg-surface-2/40 p-4">
                  <h4 className="text-xs font-medium uppercase tracking-wider text-fg-subtle">Guest portal</h4>
                  <p className="text-sm text-fg-muted">
                    {guest.allow_portal_access === 1
                      ? 'This guest can RSVP via the public portal link.'
                      : 'Portal access is revoked. The guest cannot submit a new RSVP.'}
                  </p>
                  <a
                    href={`#/portal/${guest.event_id}`}
                    target="_blank" rel="noreferrer"
                    className="text-xs text-brand inline-flex items-center gap-1"
                  >
                    Open portal <ExternalLink className="h-3 w-3" />
                  </a>
                </section>
              </SheetBody>

              <SheetFooter>
                <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
                  <Trash2 className="h-4 w-4" /> Delete
                </Button>
                <div className="flex-1" />
                <Button variant="ghost" onClick={() => onOpenChange(false)}>Close</Button>
                <Button onClick={() => setEditOpen(true)}>Edit</Button>
              </SheetFooter>
            </>
          )}
        </SheetContent>
      </Sheet>

      {guest && (
        <GuestFormDialog
          guest={guest}
          open={editOpen}
          onOpenChange={setEditOpen}
        />
      )}

      <DeleteConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        count={1}
        title={guest ? `Delete ${guest.full_name}?` : 'Delete guest?'}
        busy={busy}
        onConfirm={handleDelete}
      />
    </>
  );
}

function DetailRow({
  icon, label, value,
}: { icon?: React.ReactNode; label: string; value: string | null | undefined }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="w-4 text-fg-subtle">{icon}</span>
      <span className="text-xs text-fg-subtle w-16">{label}</span>
      <span className={value ? 'text-fg' : 'text-fg-subtle italic'}>
        {value || 'none'}
      </span>
    </div>
  );
}

function NoteCard({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="rounded-md border border-border bg-surface p-3">
      <div className="flex items-center gap-2 text-xs font-medium text-fg-muted mb-1">
        {icon}{title}
      </div>
      <p className="text-sm text-fg whitespace-pre-wrap">{body}</p>
    </div>
  );
}
