/**
 * Centralized event status metadata. Every place that renders a status
 * label / color / badge variant goes through this so the platform looks
 * consistent.
 */
import type { SdkEvent } from '../../sdk/types';
import { Badge } from '../../ui/Badge';

export type EventStatus = SdkEvent['status'];

export interface StatusMeta {
  label: string;
  description: string;
  /** Kanban column dot color (chart palette for color-blind friendliness). */
  dotColor: string;
  /** Variant of our Badge component. */
  badgeVariant: 'default' | 'brand' | 'accent' | 'success' | 'warning' | 'danger' | 'info' | 'outline';
}

export const STATUS_META: Record<EventStatus, StatusMeta> = {
  lead:      { label: 'Lead',      description: 'Initial inquiry',         dotColor: 'rgb(var(--chart-7))', badgeVariant: 'info' },
  hold:      { label: 'Hold',      description: 'Tentative reservation',   dotColor: 'rgb(var(--chart-5))', badgeVariant: 'warning' },
  booked:    { label: 'Booked',    description: 'Contract signed',         dotColor: 'rgb(var(--chart-1))', badgeVariant: 'brand' },
  planning:  { label: 'Planning',  description: 'Active planning',         dotColor: 'rgb(var(--chart-4))', badgeVariant: 'info' },
  completed: { label: 'Completed', description: 'Event has happened',      dotColor: 'rgb(var(--chart-3))', badgeVariant: 'success' },
  cancelled: { label: 'Cancelled', description: 'Cancelled by client',     dotColor: 'rgb(var(--color-fg-subtle))', badgeVariant: 'outline' },
  lost:      { label: 'Lost',      description: 'Did not convert',         dotColor: 'rgb(var(--chart-8))', badgeVariant: 'danger' },
};

/** Pipeline-friendly display order (lead → ... → completed → cancelled → lost). */
export const statusOrder: EventStatus[] = [
  'lead', 'hold', 'booked', 'planning', 'completed', 'cancelled', 'lost',
];

export function StatusBadge({ status }: { status: EventStatus }) {
  const meta = STATUS_META[status];
  return <Badge variant={meta.badgeVariant}>{meta.label}</Badge>;
}
