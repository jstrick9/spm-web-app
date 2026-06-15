/**
 * BulkActionsMenu — appears in the toolbar when 1+ guests are selected.
 * Lets the planner take action on the whole selection in one shot.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, Loader2, Shield, Star, Tag, Trash2, UserCheck, UserX, XCircle } from 'lucide-react';
import { useState } from 'react';
import { sdk } from '../../../sdk';
import type { SdkRsvpStatus } from '../../../sdk/types';
import { Button } from '../../../ui/Button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '../../../ui/DropdownMenu';
import { useToast } from '../../../ui/Toast';
import { DeleteConfirmDialog } from './DeleteConfirmDialog';
import { RSVP_META, rsvpOrder } from './rsvpMeta';

interface Props {
  eventId: string;
  selectedIds: string[];
  /** Called after an action so the table can clear its selection. */
  onCleared: () => void;
}

export function BulkActionsMenu({ eventId, selectedIds, onCleared }: Props) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [deleteOpen, setDeleteOpen] = useState(false);

  const count = selectedIds.length;

  /**
   * Bulk update. Phase 1 backend doesn't have a /bulk-update endpoint,
   * so we fan out PATCH requests in parallel (max 8 concurrent to be
   * polite to the SQLite write-lock). Server adds a real bulk endpoint
   * in Week 2 — this code keeps the same UX and just swaps the impl.
   */
  const bulkPatch = useMutation({
    mutationFn: async (patch: Parameters<typeof sdk.guests.update>[1]) => {
      const queue = [...selectedIds];
      const errors: Array<{ id: string; err: Error }> = [];
      const CONCURRENCY = 8;
      async function worker() {
        while (queue.length) {
          const id = queue.shift()!;
          try {
            await sdk.guests.update(id, patch);
          } catch (err) {
            errors.push({ id, err: err as Error });
          }
        }
      }
      await Promise.all(Array.from({ length: CONCURRENCY }, worker));
      return { errors };
    },
    onSuccess: ({ errors }) => {
      qc.invalidateQueries({ queryKey: ['guests', eventId] });
      qc.invalidateQueries({ queryKey: ['guests-counts', eventId] });
      if (errors.length === 0) {
        toast({ title: `${count} guest${count === 1 ? '' : 's'} updated`, variant: 'success' });
      } else if (errors.length < count) {
        toast({
          title: `Updated ${count - errors.length} of ${count}`,
          description: `${errors.length} failed — try again or check the audit log.`,
          variant: 'destructive',
        });
      } else {
        toast({ title: 'No guests updated', description: 'All requests failed.', variant: 'destructive' });
      }
      onCleared();
    },
  });

  const bulkDelete = useMutation({
    mutationFn: async () => {
      const queue = [...selectedIds];
      const errors: Array<{ id: string; err: Error }> = [];
      const CONCURRENCY = 8;
      async function worker() {
        while (queue.length) {
          const id = queue.shift()!;
          try { await sdk.guests.delete(id); }
          catch (err) { errors.push({ id, err: err as Error }); }
        }
      }
      await Promise.all(Array.from({ length: CONCURRENCY }, worker));
      return { errors };
    },
    onSuccess: ({ errors }) => {
      qc.invalidateQueries({ queryKey: ['guests', eventId] });
      qc.invalidateQueries({ queryKey: ['guests-counts', eventId] });
      setDeleteOpen(false);
      if (errors.length === 0) {
        toast({ title: `Deleted ${count} guest${count === 1 ? '' : 's'}`, variant: 'success' });
      } else {
        toast({
          title: `Deleted ${count - errors.length} of ${count}`,
          description: `${errors.length} failed.`,
          variant: 'destructive',
        });
      }
      onCleared();
    },
  });

  return (
    <>
      <div className="flex items-center gap-2 rounded-md border border-border bg-brand-soft px-3 py-1.5">
        <span className="text-sm font-medium text-brand-strong">
          {count} selected
        </span>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="secondary" disabled={bulkPatch.isPending || bulkDelete.isPending}>
              {(bulkPatch.isPending || bulkDelete.isPending) && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Actions
              <ChevronDown className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuLabel>Set RSVP status</DropdownMenuLabel>
            {rsvpOrder.map((s) => (
              <DropdownMenuItem
                key={s}
                onSelect={() => bulkPatch.mutate({ rsvpStatus: s })}
              >
                <SetRsvpIcon status={s} />
                {RSVP_META[s].label}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Portal access</DropdownMenuLabel>
            <DropdownMenuItem
              onSelect={() => bulkPatch.mutate({ allowPortalAccess: true })}
            >
              <UserCheck className="h-4 w-4" /> Allow portal access
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => bulkPatch.mutate({ allowPortalAccess: false })}
            >
              <UserX className="h-4 w-4" /> Revoke portal access
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Guest intelligence</DropdownMenuLabel>
            <DropdownMenuItem onSelect={() => bulkPatch.mutate({ metadata: { vip: true, managerAuditTrail: [{ action: 'bulk-mark-vip', at: new Date().toISOString(), actor: 'manager' }] } })}>
              <Star className="h-4 w-4" /> Mark VIP
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => bulkPatch.mutate({ metadata: { repeatGuest: true, managerAuditTrail: [{ action: 'bulk-mark-repeat-guest', at: new Date().toISOString(), actor: 'manager' }] } })}>
              <UserCheck className="h-4 w-4" /> Mark repeat guest
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Manager issue tags</DropdownMenuLabel>
            {[
              ['arrived_early', 'Arrived early'],
              ['lost_item', 'Lost item'],
              ['accessibility_assistance', 'Accessibility assistance'],
              ['shuttle_issue', 'Shuttle issue'],
              ['intoxication_risk', 'Intoxication risk'],
              ['vip_request', 'VIP request'],
            ].map(([id, label]) => (
              <DropdownMenuItem key={id} onSelect={() => bulkPatch.mutate({ metadata: { guestIssueTags: [id], managerAuditTrail: [{ action: `bulk-tag:${id}`, at: new Date().toISOString(), actor: 'manager' }] } })}>
                <Tag className="h-4 w-4" /> {label}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Manager-safe actions</DropdownMenuLabel>
            <DropdownMenuItem disabled>
              <Shield className="h-4 w-4" /> Audit trail is recorded in guest metadata
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={() => setDeleteOpen(true)}>
              <Trash2 className="h-4 w-4" /> Delete {count} guest{count === 1 ? '' : 's'}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button size="sm" variant="ghost" onClick={onCleared} aria-label="Clear selection">
          <XCircle className="h-4 w-4" />
        </Button>
      </div>

      <DeleteConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        count={count}
        busy={bulkDelete.isPending}
        onConfirm={() => bulkDelete.mutate()}
      />
    </>
  );
}

function SetRsvpIcon({ status }: { status: SdkRsvpStatus }) {
  return (
    <span
      className="inline-block h-2.5 w-2.5 rounded-pill"
      style={{ background: RSVP_META[status].dotColor }}
      aria-hidden="true"
    />
  );
}
