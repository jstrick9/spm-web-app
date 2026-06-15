/**
 * Centralized event status metadata. Every place that renders a status
 * label / color / badge variant goes through this so the platform looks
 * consistent and owner-friendly.
 */
import type { SdkEvent } from '../../sdk/types';
import { Badge } from '../../ui/Badge';

export type EventStatus = SdkEvent['status'];

export interface StatusMeta {
  label: string;
  description: string;
  ownerDefinition: string;
  nextStep: string;
  dotColor: string;
  badgeVariant: 'default' | 'brand' | 'accent' | 'success' | 'warning' | 'danger' | 'info' | 'outline';
}

export const STATUS_META: Record<EventStatus, StatusMeta> = {
  lead: {
    label: 'Lead',
    description: 'New inquiry',
    ownerDefinition: 'Someone asked about availability, pricing, or touring your venue. They have not committed yet.',
    nextStep: 'Reply quickly, capture source, schedule a tour, and prepare a quote.',
    dotColor: 'rgb(var(--chart-7))',
    badgeVariant: 'info',
  },
  hold: {
    label: 'Hold',
    description: 'Date temporarily held',
    ownerDefinition: 'You are temporarily protecting a date while the client decides or waits for a proposal.',
    nextStep: 'Set an expiration/follow-up reminder and move to Booked, Lost, or Cancelled.',
    dotColor: 'rgb(var(--chart-5))',
    badgeVariant: 'warning',
  },
  booked: {
    label: 'Booked',
    description: 'Contract or deposit received',
    ownerDefinition: 'The client has committed. Contract/payment milestones should now drive the workflow.',
    nextStep: 'Confirm contract, deposit, guest portal, vendor portal, and planning timeline.',
    dotColor: 'rgb(var(--chart-1))',
    badgeVariant: 'brand',
  },
  planning: {
    label: 'Planning',
    description: 'Actively preparing event',
    ownerDefinition: 'The event is operationally active: guests, vendors, layout, budget, and timeline are being finalized.',
    nextStep: 'Work through event readiness until go-live checks are complete.',
    dotColor: 'rgb(var(--chart-4))',
    badgeVariant: 'info',
  },
  completed: {
    label: 'Completed',
    description: 'Event has happened',
    ownerDefinition: 'The event day is over. Use this for reporting, feedback, vendor scoring, and closeout.',
    nextStep: 'Collect feedback, reconcile payments, score vendors, and archive records.',
    dotColor: 'rgb(var(--chart-3))',
    badgeVariant: 'success',
  },
  cancelled: {
    label: 'Cancelled',
    description: 'Cancelled after engagement',
    ownerDefinition: 'The event was cancelled after meaningful planning or booking activity.',
    nextStep: 'Record cancellation reason, update payments/contracts, and release held resources.',
    dotColor: 'rgb(var(--color-fg-subtle))',
    badgeVariant: 'outline',
  },
  lost: {
    label: 'Lost',
    description: 'Inquiry did not convert',
    ownerDefinition: 'The lead or hold chose another venue, stopped responding, or is no longer viable.',
    nextStep: 'Record why it was lost and use lead source attribution to improve future conversion.',
    dotColor: 'rgb(var(--chart-8))',
    badgeVariant: 'danger',
  },
};

export const statusOrder: EventStatus[] = [
  'lead', 'hold', 'booked', 'planning', 'completed', 'cancelled', 'lost',
];

export function StatusBadge({ status }: { status: EventStatus }) {
  const meta = STATUS_META[status];
  return <Badge variant={meta.badgeVariant}>{meta.label}</Badge>;
}
