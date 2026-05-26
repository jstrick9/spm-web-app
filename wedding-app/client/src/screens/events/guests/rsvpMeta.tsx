/**
 * RSVP status meta — labels + colors used by guest screens. Mirrors the
 * event-status pattern so the platform looks consistent.
 */
import type { SdkRsvpStatus } from '../../../sdk/types';
import { Badge } from '../../../ui/Badge';

export interface RsvpMeta {
  label: string;
  description: string;
  dotColor: string;
  badgeVariant: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'outline';
}

export const RSVP_META: Record<SdkRsvpStatus, RsvpMeta> = {
  pending:   { label: 'Pending',   description: 'Has not yet responded', dotColor: 'rgb(var(--warning))', badgeVariant: 'warning' },
  attending: { label: 'Attending', description: 'Confirmed yes',         dotColor: 'rgb(var(--success))', badgeVariant: 'success' },
  declined:  { label: 'Declined',  description: 'Cannot attend',         dotColor: 'rgb(var(--danger))',  badgeVariant: 'danger' },
  maybe:     { label: 'Maybe',     description: 'Tentative',             dotColor: 'rgb(var(--info))',    badgeVariant: 'info' },
};

export const rsvpOrder: SdkRsvpStatus[] = ['pending', 'attending', 'declined', 'maybe'];

export function RsvpBadge({ status }: { status: SdkRsvpStatus }) {
  const meta = RSVP_META[status];
  return <Badge variant={meta.badgeVariant}>{meta.label}</Badge>;
}
