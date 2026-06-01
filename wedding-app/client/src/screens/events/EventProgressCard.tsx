/**
 * EventProgressCard — visual readiness tracker for an event.
 *
 * Shows completion percentage across key milestones:
 *   - Guest RSVPs collected (% responded)
 *   - Vendor contracts in place (% with contract amounts)
 *   - Budget items tracked (any items exist?)
 *   - Timeline set (any timeline items?)
 *   - Contracts signed (% in signed status)
 *
 * Designed to sit on the Event Detail Overview tab.
 */
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Circle, Loader2 } from 'lucide-react';
import { sdk } from '../../sdk';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/Card';

interface Props { eventId: string }

interface Milestone {
  label: string;
  complete: boolean;
  detail: string;
}

export function EventProgressCard({ eventId }: Props) {
  const guestsQ = useQuery({
    queryKey: ['guests', eventId],
    queryFn: () => sdk.guests.list(eventId),
    staleTime: 30_000,
  });

  const vendorsQ = useQuery({
    queryKey: ['vendors-progress', eventId],
    queryFn: async () => {
      // We need the org ID — get it from the event
      const { event } = await sdk.events.get(eventId);
      return sdk.vendors.list(event.organization_id, { eventId });
    },
    staleTime: 30_000,
  });

  const timelineQ = useQuery({
    queryKey: ['timeline', eventId],
    queryFn: () => sdk.timeline.list(eventId),
    staleTime: 60_000,
  });

  const budgetQ = useQuery({
    queryKey: ['budget', eventId],
    queryFn: () => sdk.budget.list(eventId),
    staleTime: 60_000,
  });

  const contractsQ = useQuery({
    queryKey: ['contracts', eventId],
    queryFn: () => sdk.contracts.list(eventId),
    staleTime: 60_000,
  });

  const isLoading = guestsQ.isLoading || vendorsQ.isLoading || timelineQ.isLoading;

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <Loader2 className="h-5 w-5 animate-spin mx-auto text-fg-muted" />
        </CardContent>
      </Card>
    );
  }

  // Build milestones
  const counts = guestsQ.data?.counts ?? { pending: 0, attending: 0, declined: 0, maybe: 0 };
  const totalGuests = counts.pending + counts.attending + counts.declined + counts.maybe;
  const respondedGuests = counts.attending + counts.declined + counts.maybe;
  const rsvpPct = totalGuests > 0 ? Math.round((respondedGuests / totalGuests) * 100) : 0;

  const vendors = vendorsQ.data?.vendors ?? [];
  const vendorsWithContract = vendors.filter(v => (v.contract_amount_cents ?? 0) > 0).length;

  const timelineItems = timelineQ.data?.items ?? [];
  const budgetItems = budgetQ.data?.items ?? [];
  const contracts = contractsQ.data?.contracts ?? [];
  const signedContracts = contracts.filter(c => c.status === 'signed').length;

  const milestones: Milestone[] = [
    {
      label: 'Guest list created',
      complete: totalGuests > 0,
      detail: totalGuests > 0 ? `${totalGuests} guests added` : 'No guests yet',
    },
    {
      label: 'RSVPs collected',
      complete: rsvpPct >= 50,
      detail: totalGuests > 0 ? `${rsvpPct}% responded (${respondedGuests}/${totalGuests})` : 'Waiting for guests',
    },
    {
      label: 'Vendors booked',
      complete: vendors.length > 0 && vendorsWithContract >= Math.ceil(vendors.length * 0.5),
      detail: vendors.length > 0 ? `${vendorsWithContract}/${vendors.length} with contracts` : 'No vendors yet',
    },
    {
      label: 'Timeline planned',
      complete: timelineItems.length >= 3,
      detail: timelineItems.length > 0 ? `${timelineItems.length} items scheduled` : 'No timeline items',
    },
    {
      label: 'Budget tracked',
      complete: budgetItems.length > 0,
      detail: budgetItems.length > 0 ? `${budgetItems.length} line items` : 'No budget items',
    },
    {
      label: 'Contracts signed',
      complete: contracts.length > 0 && signedContracts >= contracts.length,
      detail: contracts.length > 0 ? `${signedContracts}/${contracts.length} signed` : 'No contracts yet',
    },
  ];

  const completedCount = milestones.filter(m => m.complete).length;
  const progressPct = Math.round((completedCount / milestones.length) * 100);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Event Readiness</CardTitle>
          <span className="text-sm font-semibold tabular-nums" style={{ color: progressPct >= 80 ? 'var(--color-success)' : progressPct >= 40 ? 'var(--color-warning)' : 'var(--color-fg-muted)' }}>
            {progressPct}%
          </span>
        </div>
        {/* Progress bar */}
        <div className="h-2 rounded-full bg-surface-2 overflow-hidden mt-2">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${progressPct}%`,
              background: progressPct >= 80 ? 'var(--color-success)' : progressPct >= 40 ? 'var(--color-warning)' : 'var(--color-brand)',
            }}
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-2.5">
        {milestones.map((m, i) => (
          <div key={i} className="flex items-start gap-2.5">
            {m.complete ? (
              <CheckCircle2 className="h-4 w-4 text-success shrink-0 mt-0.5" />
            ) : (
              <Circle className="h-4 w-4 text-fg-subtle shrink-0 mt-0.5" />
            )}
            <div className="min-w-0 flex-1">
              <span className={`text-xs sm:text-sm font-medium ${m.complete ? 'text-fg' : 'text-fg-muted'}`}>{m.label}</span>
              <p className="text-[11px] text-fg-subtle">{m.detail}</p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
