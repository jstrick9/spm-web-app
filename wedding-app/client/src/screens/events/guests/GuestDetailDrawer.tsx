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
        <SheetContent side="right" width="lg" className="bg-[#FDFBF7] border-l border-[#e1d5c9] shadow-2xl animate-in slide-in-from-right duration-300">
          {!guest ? (
            <SheetBody className="bg-[#FDFBF7]"><Skeleton className="h-40 w-full rounded-xl" /></SheetBody>
          ) : (
            <>
              <SheetHeader className="border-b border-[#e1d5c9]">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <SheetTitle className="font-serif font-bold text-2xl text-fg">{guest.full_name}</SheetTitle>
                    <SheetDescription className="mt-1">
                      <span className="inline-flex flex-wrap items-center gap-2 mt-1">
                        <RsvpBadge status={guest.rsvp_status} />
                        {guest.party_name && (
                          <Badge variant="outline" className="border-[#e1d5c9] text-fg bg-white">Party: {guest.party_name}</Badge>
                        )}
                        {guest.plus_one_allowed === 1 && (
                          <Badge variant="brand">+1 allowed</Badge>
                        )}
                      </span>
                    </SheetDescription>
                  </div>
                </div>
              </SheetHeader>

              <SheetBody className="space-y-6 bg-[#FDFBF7]">
                {/* Contact info */}
                <section className="space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-fg-subtle font-serif">Contact</h4>
                  <div className="space-y-2 text-sm">
                    <DetailRow icon={<Mail className="h-4 w-4" />} label="Email" value={guest.email} />
                    <DetailRow icon={<Phone className="h-4 w-4" />} label="Phone" value={guest.phone} />
                  </div>
                </section>

                {/* Assignment */}
                <section className="space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-fg-subtle font-serif">Assignment</h4>
                  <div className="space-y-2 text-sm">
                    <DetailRow icon={<UserCheck className="h-4 w-4" />} label="Table" value={guest.table_assignment} />
                    <DetailRow icon={<Shield className="h-4 w-4" />} label="Room"  value={guest.room_assignment} />
                    <DetailRow icon={<UserCheck className="h-4 w-4" />} label="Seat"  value={guest.seat_assignment} />
                  </div>
                </section>

                {/* Notes */}
                {(guest.dietary_restrictions || guest.accessibility_notes) && (
                  <section className="space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-fg-subtle font-serif">Notes</h4>
                    {guest.dietary_restrictions && (
                      <NoteCard
                        icon={<Utensils className="h-4 w-4 text-warning" />}
                        title="Dietary Restrictions"
                        body={guest.dietary_restrictions}
                      />
                    )}
                    {guest.accessibility_notes && (
                      <NoteCard
                        icon={<AlertTriangle className="h-4 w-4 text-info" />}
                        title="Accessibility Requirements"
                        body={guest.accessibility_notes}
                      />
                    )}
                  </section>
                )}

                {/* RSVP history */}
                <section className="space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-fg-subtle font-serif">RSVP history</h4>
                  {rsvpsQuery.isLoading ? (
                    <Skeleton className="h-16 w-full rounded-xl" />
                  ) : myRsvps.length === 0 ? (
                    <p className="text-xs text-fg-subtle italic">No RSVPs submitted yet.</p>
                  ) : (
                    <ul className="space-y-2">
                      {myRsvps.map((r) => (
                        <li key={r.id} className="rounded-xl border border-[#e1d5c9] bg-white p-3 text-xs shadow-sm">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-fg">
                              {r.attending ? 'Attending' : 'Declined'}
                              {r.meal_choice && <span className="ml-1.5 text-fg-muted font-semibold">· {r.meal_choice}</span>}
                            </span>
                            <span className="text-[10px] text-fg-subtle font-semibold">{new Date(r.submitted_at).toLocaleString()}</span>
                          </div>
                          {r.notes && (
                            <p className="mt-2 text-fg-muted text-xs flex items-start gap-1 bg-[#FDFBF7] p-2 rounded border border-[#e1d5c9]/40 italic">
                              <MessageSquare className="h-3 w-3 mt-0.5 shrink-0 text-brand" />
                              <span>"{r.notes}"</span>
                            </p>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </section>

                {/* Portal access */}
                <section className="space-y-2 rounded-xl border border-[#e1d5c9] bg-white p-4 shadow-sm">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-fg-subtle font-serif">Guest portal</h4>
                  <p className="text-xs text-fg-muted leading-relaxed font-semibold">
                    {guest.allow_portal_access === 1
                      ? 'This guest can RSVP via the public portal link.'
                      : 'Portal access is revoked. The guest cannot submit a new RSVP.'}
                  </p>
                  <a
                    href={`#/portal/${guest.event_id}`}
                    target="_blank" rel="noreferrer"
                    className="text-xs text-brand hover:text-brand-strong inline-flex items-center gap-1 font-bold underline"
                  >
                    Open portal <ExternalLink className="h-3 w-3" />
                  </a>
                </section>
              </SheetBody>

              <SheetFooter className="border-t border-[#e1d5c9]">
                <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
                  <Trash2 className="h-4 w-4 mr-1.5" /> Delete Guest
                </Button>
                <div className="flex-1" />
                <Button variant="ghost" onClick={() => onOpenChange(false)}>Close</Button>
                <Button onClick={() => setEditOpen(true)}>Edit Details</Button>
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
    <div className="flex items-center gap-3 bg-white border border-[#e1d5c9] p-3 rounded-xl shadow-xs">
      <span className="text-brand shrink-0">{icon}</span>
      <span className="text-[10px] text-fg-subtle w-16 uppercase font-bold tracking-wider">{label}</span>
      <span className={value ? 'text-fg font-semibold truncate' : 'text-fg-subtle italic'}>
        {value || 'None'}
      </span>
    </div>
  );
}

function NoteCard({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="rounded-xl border border-[#e1d5c9] bg-white p-3.5 shadow-xs">
      <div className="flex items-center gap-2 text-xs font-bold text-fg-muted mb-1.5 font-serif">
        {icon}{title}
      </div>
      <p className="text-sm text-fg whitespace-pre-wrap font-medium">{body}</p>
    </div>
  );
}

function Shield({ className }: { className?: string }) {
  return (
    <svg 
      className={className} 
      xmlns="http://www.w3.org/2000/svg" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    >
      <path d="M20 13c0 5-3.5 7.5-7.66 9.7a1 1 0 0 1-.68 0C7.5 20.5 4 18 4 13V6a1 1 0 0 1 .76-.97l7-2a1 1 0 0 1 .48 0l7 2A1 1 0 0 1 20 6z" />
    </svg>
  );
}
