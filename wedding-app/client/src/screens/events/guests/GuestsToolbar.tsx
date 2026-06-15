import { Bell, Mail, Plus, Search, Send, Upload, X } from 'lucide-react';
import type { SdkRsvpStatus } from '../../../sdk/types';
import { Button } from '../../../ui/Button';
import { Input } from '../../../ui/Input';
import { cn } from '../../../ui/lib/cn';
import { BulkActionsMenu } from './BulkActionsMenu';
import { RSVP_META, rsvpOrder } from './rsvpMeta';

export type GuestAdvancedFilter = 'none' | 'no_email' | 'no_phone' | 'dietary' | 'accessibility' | 'not_seated' | 'no_lodging' | 'vip';
export type GuestStatusFilter = SdkRsvpStatus | 'all';

interface Props {
  eventId: string;
  search: string;
  onSearchChange: (s: string) => void;
  statusFilter: GuestStatusFilter;
  onStatusFilterChange: (s: GuestStatusFilter) => void;
  advancedFilter?: GuestAdvancedFilter;
  onAdvancedFilterChange?: (s: GuestAdvancedFilter) => void;
  counts?: { pending: number; attending: number; declined: number; maybe: number };
  selectedIds: string[];
  onSelectionCleared: () => void;
  onAddClick: () => void;
  onImportClick?: () => void;
  onCopyEmails?: () => void;
  onSendReminders?: () => void;
  onBulkMessage?: () => void;
}

export function GuestsToolbar({
  eventId, search, onSearchChange, statusFilter, onStatusFilterChange,
  advancedFilter = 'none', onAdvancedFilterChange,
  counts, selectedIds, onSelectionCleared, onAddClick, onImportClick, onCopyEmails, onSendReminders, onBulkMessage,
}: Props) {
  const total = counts ? counts.pending + counts.attending + counts.declined + counts.maybe : 0;
  return (
    <div className="flex flex-col gap-2 sm:gap-3 sm:flex-row sm:items-center">
      <div className="flex-1 min-w-0">
        <Input
          startSlot={<Search className="h-4 w-4" />}
          endSlot={search ? (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="p-0.5 hover:text-fg rounded"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
          placeholder="Search by name, email, party…"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="max-w-md"
        />
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <StatusChip active={statusFilter === 'all'} onClick={() => onStatusFilterChange('all')} count={total}>
          All
        </StatusChip>
        {rsvpOrder.map((s) => (
          <StatusChip
            key={s}
            active={statusFilter === s}
            onClick={() => onStatusFilterChange(s)}
            count={counts?.[s] ?? 0}
          >
            {RSVP_META[s].label}
          </StatusChip>
        ))}
        {onAdvancedFilterChange && (
          <select
            value={advancedFilter}
            onChange={(e) => onAdvancedFilterChange(e.target.value as GuestAdvancedFilter)}
            className="h-8 rounded-md border border-border bg-surface px-2 text-xs font-semibold text-fg"
            aria-label="Guest quality filter"
          >
            <option value="none">All guest details</option>
            <option value="no_email">No email</option>
            <option value="no_phone">No phone</option>
            <option value="dietary">Dietary restrictions</option>
            <option value="accessibility">Accessibility notes</option>
            <option value="not_seated">Not seated</option>
            <option value="no_lodging">No lodging assignment</option>
            <option value="vip">VIP tagged</option>
          </select>
        )}
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
        {selectedIds.length > 0 && (
          <BulkActionsMenu
            eventId={eventId}
            selectedIds={selectedIds}
            onCleared={onSelectionCleared}
          />
        )}
        {onImportClick && (
          <Button variant="outline" onClick={onImportClick}>
            <Upload className="h-4 w-4" /> Import CSV
          </Button>
        )}
        {onSendReminders && (
          <Button variant="outline" onClick={onSendReminders}>
            <Bell className="h-4 w-4" /> Send reminders
          </Button>
        )}
        {onBulkMessage && (
          <Button variant="outline" onClick={onBulkMessage}>
            <Send className="h-4 w-4" /> Message guests
          </Button>
        )}
        {onCopyEmails && (
          <Button variant="outline" onClick={onCopyEmails}>
            <Mail className="h-4 w-4" /> Copy Emails
          </Button>
        )}
        <Button onClick={onAddClick}>
          <Plus className="h-4 w-4" /> Add guest
        </Button>
      </div>
    </div>
  );
}

function StatusChip({
  active, onClick, count, children,
}: { active: boolean; onClick: () => void; count: number; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-pill px-3 py-1 text-xs font-medium transition-colors',
        'border border-border',
        active
          ? 'bg-brand text-brand-fg border-brand'
          : 'bg-surface text-fg-muted hover:bg-surface-2',
      )}
    >
      {children}
      <span
        className={cn(
          'rounded-pill px-1.5 text-[10px] tabular-nums',
          active ? 'bg-brand-strong/30' : 'bg-surface-2',
        )}
      >
        {count}
      </span>
    </button>
  );
}
