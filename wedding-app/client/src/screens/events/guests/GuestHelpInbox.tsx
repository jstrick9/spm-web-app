import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { sdk } from '../../../sdk';
import { Card, CardContent } from '../../../ui/Card';
import { Badge } from '../../../ui/Badge';
import { Button } from '../../../ui/Button';
import { useToast } from '../../../ui/Toast';

export function GuestHelpInbox({ eventId }: { eventId: string }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const query = useQuery({ queryKey: ['guest-help-requests', eventId], queryFn: () => sdk.guests.guestHelpRequests(eventId) });
  const update = useMutation({
    mutationFn: ({ id, status, note, assignedTo, slaDays }: { id: string; status?: 'open' | 'in_review' | 'resolved' | 'closed'; note?: string; assignedTo?: string; slaDays?: number }) => sdk.guests.updateGuestHelpRequest(eventId, id, { status, resolutionNote: note, assignedTo, slaDays }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['guest-help-requests', eventId] }); toast({ title: 'Guest help request updated', variant: 'success' }); },
    onError: (e: any) => toast({ title: 'Could not update guest help request', description: e.message, variant: 'destructive' }),
  });
  const reply = useMutation({
    mutationFn: ({ id, channel, closeRequest }: { id: string; channel: 'email' | 'sms' | 'in_app'; closeRequest?: boolean }) => sdk.guests.replyGuestHelpRequest(eventId, id, { channel, closeRequest, message: window.prompt('Reply message to guest', 'Thanks for reaching out. We are checking your invitation details and will follow up shortly.') || '' }),
    onSuccess: (res) => { qc.invalidateQueries({ queryKey: ['guest-help-requests', eventId] }); toast({ title: 'Guest reply queued', description: res.dispatchStatus, variant: 'success' }); },
    onError: (e: any) => toast({ title: 'Could not queue reply', description: e.message, variant: 'destructive' }),
  });

  const assign = (id: string) => {
    const assignedTo = window.prompt('Assign to coordinator email');
    if (!assignedTo) return;
    update.mutate({ id, status: 'in_review', assignedTo, slaDays: 2 });
  };

  return (
    <Card className="border-brand/20 bg-brand-soft/5">
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-sm font-bold text-brand">Guest portal help inbox</h3>
            <p className="text-xs text-fg-muted">Cannot-find-name, wrong-link, expired/revoked link, and guest identity recovery requests from the public portal.</p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs"><Badge variant={(query.data?.counts.open || 0) ? 'warning' : 'success'}>{query.data?.counts.open || 0} open</Badge><Badge variant="outline">{query.data?.counts.inReview || 0} in review</Badge></div>
        </div>
        <div className="grid gap-2 md:grid-cols-2">{(query.data?.requests || []).slice(0, 4).map((request) => <div key={request.id} className="rounded-lg border border-border bg-surface p-3 text-sm"><div className="flex items-start justify-between gap-2"><div><div className="flex flex-wrap items-center gap-2"><strong>{request.kind.replace(/_/g, ' ')}</strong><Badge variant={request.status === 'open' ? 'warning' : request.status === 'resolved' ? 'success' : 'outline'}>{request.status.replace('_', ' ')}</Badge><Badge variant={request.slaStatus === 'overdue' ? 'warning' : 'outline'}>{request.slaStatus || 'sla unset'}</Badge></div><p className="text-xs text-fg-muted">{request.name || 'Unknown guest'}{request.email ? ` · ${request.email}` : ''}</p><p className="text-xs text-fg-muted">{request.message || 'No message provided.'}</p><p className="text-xs text-fg-subtle">Assigned: {request.assignedTo || 'unassigned'} · SLA: {request.slaDueAt || 'not set'} · reply: {request.lastReplyStatus || 'none'}</p></div><div className="flex shrink-0 flex-wrap gap-1"><Button size="xs" variant="outline" onClick={() => update.mutate({ id: request.id, status: 'in_review' })}>Review</Button><Button size="xs" variant="outline" onClick={() => assign(request.id)}>Assign</Button><Button size="xs" variant="ghost" onClick={() => reply.mutate({ id: request.id, channel: 'email' })}>Email</Button><Button size="xs" variant="ghost" onClick={() => reply.mutate({ id: request.id, channel: 'sms' })}>SMS</Button><Button size="xs" onClick={() => reply.mutate({ id: request.id, channel: 'email', closeRequest: true })}>Reply + resolve</Button></div></div></div>)}</div>
        {(query.data?.requests || []).length === 0 && <p className="rounded-lg border border-dashed border-border p-3 text-center text-sm text-fg-muted">No guest portal help requests yet.</p>}
      </CardContent>
    </Card>
  );
}
