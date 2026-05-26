/**
 * DeleteConfirmDialog — destructive-action confirmation.
 *
 * Used for single-guest delete (from the table or detail drawer) and bulk
 * delete (from the bulk-actions menu). Requires the user to type the word
 * "DELETE" for 5+-item bulk operations, otherwise a single click suffices.
 */
import { useState } from 'react';
import { Button } from '../../../ui/Button';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '../../../ui/Dialog';
import { Input } from '../../../ui/Input';
import { Label } from '../../../ui/Label';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  count: number;
  /** Confirmation prompt body. */
  description?: React.ReactNode;
  /** Optional title override. */
  title?: string;
  onConfirm: () => void;
  busy?: boolean;
}

/** When at least this many items are about to be deleted, require typed confirmation. */
const TYPED_CONFIRM_THRESHOLD = 5;

export function DeleteConfirmDialog({
  open, onOpenChange, count, description, title, onConfirm, busy,
}: Props) {
  const requireType = count >= TYPED_CONFIRM_THRESHOLD;
  const [typed, setTyped] = useState('');
  const canConfirm = !requireType || typed === 'DELETE';

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!busy) { setTyped(''); onOpenChange(v); } }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {title ?? (count === 1 ? 'Delete guest?' : `Delete ${count} guests?`)}
          </DialogTitle>
          <DialogDescription>
            {description ?? (
              count === 1
                ? 'This will remove the guest from this event. Their RSVP history will be detached but preserved in audit logs.'
                : `This will remove ${count} guests from this event. Their RSVP history will be detached but preserved in audit logs.`
            )}
          </DialogDescription>
        </DialogHeader>

        {requireType && (
          <div className="space-y-1.5">
            <Label htmlFor="confirm-input">
              Type <span className="font-mono font-semibold">DELETE</span> to confirm
            </Label>
            <Input
              id="confirm-input"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder="DELETE"
              autoFocus
            />
          </div>
        )}

        <DialogFooter>
          <Button
            type="button" variant="ghost"
            disabled={busy}
            onClick={() => { setTyped(''); onOpenChange(false); }}
          >
            Cancel
          </Button>
          <Button
            type="button" variant="destructive"
            disabled={!canConfirm}
            isLoading={busy}
            onClick={onConfirm}
          >
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
