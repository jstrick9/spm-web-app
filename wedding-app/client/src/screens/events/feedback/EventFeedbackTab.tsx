import React, { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { sdk } from '../../../sdk';
import { Card, CardContent, CardHeader, CardTitle } from '../../../ui/Card';
import { Button } from '../../../ui/Button';
import { Badge } from '../../../ui/Badge';
import { Input } from '../../../ui/Input';
import { useToast } from '../../../ui/Toast';
import { Skeleton } from '../../../ui/Skeleton';
import { MessageSquare, Star, BarChart, Plus, Check, HeartHandshake, Link as LinkIcon } from 'lucide-react';
import { cn } from '../../../ui/lib/cn';

interface Props {
  eventId: string;
}

export function EventFeedbackTab({ eventId }: Props) {
  const qc = useQueryClient();
  const { toast } = useToast();
  
  const [newPollQuestion, setNewPollQuestion] = useState('');
  const [newPollOptions, setNewPollOptions] = useState(['', '']);
  const [reviewLinksDraft, setReviewLinksDraft] = useState<Record<string, string>>({ google: '', theKnot: '', weddingwire: '', zola: '', other: '' });
  const [selectedCloseoutIds, setSelectedCloseoutIds] = useState<string[]>([]);

  const { data: pollsData, isLoading: pollsLoading } = useQuery({
    queryKey: ['polls', eventId],
    queryFn: () => sdk.feedback.getPolls(eventId),
  });

  const { data: feedbackData, isLoading: feedbackLoading } = useQuery({
    queryKey: ['feedback', eventId],
    queryFn: () => sdk.feedback.getFeedback(eventId),
  });

  const { data: postEventQueue, isLoading: postEventLoading } = useQuery({
    queryKey: ['event-post-event-review-queue', eventId],
    queryFn: () => sdk.couple.postEventReviewQueue(eventId),
  });

  useEffect(() => {
    if (postEventQueue?.reviewLinks) setReviewLinksDraft((current) => ({ ...current, ...postEventQueue.reviewLinks }));
  }, [postEventQueue?.reviewLinks]);

  const saveReviewLinks = useMutation({
    mutationFn: () => sdk.couple.updatePostEventReviewLinks(eventId, reviewLinksDraft),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['event-post-event-review-queue', eventId] }); toast({ title: 'Review links saved', variant: 'success' }); },
    onError: (e: any) => toast({ title: 'Could not save review links', description: e.message, variant: 'destructive' }),
  });

  const updateCloseoutRequest = useMutation({
    mutationFn: (input: { requestId: string; status: 'approved' | 'completed' | 'rejected'; note?: string }) => sdk.couple.updateRequest(eventId, input.requestId, { status: input.status, note: input.note }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['event-post-event-review-queue', eventId] }); toast({ title: 'Closeout request updated', variant: 'success' }); },
    onError: (e: any) => toast({ title: 'Could not update request', description: e.message, variant: 'destructive' }),
  });

  const bulkCloseoutMutation = useMutation({
    mutationFn: (input: { status?: 'pending' | 'approved' | 'rejected' | 'completed' | 'cancelled'; assignedTo?: string; slaDays?: number; note?: string }) => sdk.couple.bulkUpdatePostEventReviewQueue(eventId, { requestIds: selectedCloseoutIds, ...input }),
    onSuccess: () => { setSelectedCloseoutIds([]); qc.invalidateQueries({ queryKey: ['event-post-event-review-queue', eventId] }); toast({ title: 'Bulk closeout update applied', variant: 'success' }); },
    onError: (e: any) => toast({ title: 'Could not bulk update', description: e.message, variant: 'destructive' }),
  });

  const followUpMutation = useMutation({
    mutationFn: () => sdk.couple.queuePostEventFollowUp(eventId, { requestIds: selectedCloseoutIds, channel: 'email', message: window.prompt('Follow-up message to queue for selected couple closeout requests', 'Hi! We are following up on your post-event closeout request and will update you shortly.') || '' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['event-post-event-review-queue', eventId] }); toast({ title: 'Follow-up queued', variant: 'success' }); },
    onError: (e: any) => toast({ title: 'Could not queue follow-up', description: e.message, variant: 'destructive' }),
  });

  const createPoll = useMutation({
    mutationFn: async () => {
      const validOptions = newPollOptions.filter(o => o.trim()).map((o, i) => ({ id: `opt-${i}`, text: o, votes: 0 }));
      if (!newPollQuestion.trim() || validOptions.length < 2) throw new Error('Requires question and at least 2 options.');
      return sdk.feedback.createPoll(eventId, { question: newPollQuestion, options: validOptions, status: 'active' });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['polls', eventId] });
      setNewPollQuestion('');
      setNewPollOptions(['', '']);
      toast({ title: 'Poll Created', variant: 'success' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' })
  });

  // Render Stars
  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }).map((_, i) => (
      <Star key={i} className={cn("w-4 h-4", i < rating ? "text-amber-400 fill-amber-400" : "text-border")} />
    ));
  };

  if (pollsLoading || feedbackLoading || postEventLoading) {
    return <div className="space-y-4">{Array.from({length:3}).map((_,i) => <Skeleton key={i} className="h-48 w-full" />)}</div>;
  }

  const polls = pollsData?.polls || [];
  const feedback = feedbackData?.feedback || [];

  const avgRating = feedback.length > 0 
    ? (feedback.reduce((acc, f) => acc + f.rating, 0) / feedback.length).toFixed(1) 
    : '0.0';

  return (
    <div className="space-y-6">
      <Card className="border-brand/20 bg-brand-soft/10">
        <CardHeader className="pb-3 border-b border-border">
          <CardTitle className="text-base flex items-center gap-2"><HeartHandshake className="w-4 h-4 text-brand" /> Couple post-event closeout review queue</CardTitle>
        </CardHeader>
        <CardContent className="pt-4 space-y-4">
          <div className="grid gap-3 md:grid-cols-4 text-sm"><div className="rounded-lg border border-border bg-surface p-3"><strong>{postEventQueue?.openRequests.length ?? 0}</strong><p className="text-xs text-fg-muted">open closeout requests</p></div><div className="rounded-lg border border-border bg-surface p-3"><strong>{postEventQueue?.nps.averageScore ?? '—'}</strong><p className="text-xs text-fg-muted">avg couple NPS</p></div><div className="rounded-lg border border-border bg-surface p-3"><strong>{postEventQueue?.configuredReviewLinks ?? 0}</strong><p className="text-xs text-fg-muted">review links configured</p></div><div className="rounded-lg border border-border bg-surface p-3"><strong>{postEventQueue?.closeoutApprovals.feedbackToDebrief ?? 0}</strong><p className="text-xs text-fg-muted">debrief responses</p></div></div>
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface p-3 text-xs"><strong>{selectedCloseoutIds.length}</strong><span>selected</span><Button size="xs" variant="outline" disabled={selectedCloseoutIds.length === 0 || bulkCloseoutMutation.isPending} onClick={() => { const assignedTo = window.prompt('Assign selected requests to email'); if (assignedTo) bulkCloseoutMutation.mutate({ assignedTo, slaDays: 3, note: 'Assigned with 3-day SLA from venue queue.' }); }}>Assign + 3-day SLA</Button><Button size="xs" variant="outline" disabled={selectedCloseoutIds.length === 0 || followUpMutation.isPending} onClick={() => followUpMutation.mutate()}>Queue email follow-up</Button><Button size="xs" disabled={selectedCloseoutIds.length === 0 || bulkCloseoutMutation.isPending} onClick={() => bulkCloseoutMutation.mutate({ status: 'completed', note: 'Completed in bulk from venue queue.' })}>Bulk complete</Button></div>
          <div className="grid gap-3 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="rounded-lg border border-border bg-surface p-3 space-y-2"><div className="flex items-center gap-2 text-sm font-bold"><LinkIcon className="h-4 w-4 text-brand" /> Venue review links</div><div className="grid gap-2 sm:grid-cols-2">{(['google','theKnot','weddingwire','zola','other'] as const).map((key) => <Input key={key} placeholder={`${key} review URL`} value={reviewLinksDraft[key] || ''} onChange={(e) => setReviewLinksDraft((draft) => ({ ...draft, [key]: e.target.value }))} />)}</div><Button size="sm" onClick={() => saveReviewLinks.mutate()} disabled={saveReviewLinks.isPending}>Save review links</Button><p className="text-xs text-fg-muted">These links power the couple-facing review/testimonial workflow instead of leaving platform URLs as placeholders.</p></div>
            <div className="rounded-lg border border-border bg-surface p-3 space-y-2"><div className="text-sm font-bold">Open lost item / feedback / testimonial requests</div>{(postEventQueue?.openRequests || []).length === 0 ? <p className="text-sm text-fg-muted">No open couple closeout requests.</p> : (postEventQueue?.openRequests || []).map((request) => <div key={request.id} className="rounded-md border border-border bg-surface-2 p-3 text-sm"><div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><input aria-label={`Select closeout request ${request.id}`} type="checkbox" checked={selectedCloseoutIds.includes(request.id)} onChange={(e) => setSelectedCloseoutIds((ids) => e.target.checked ? [...new Set([...ids, request.id])] : ids.filter((id) => id !== request.id))} /><strong>{request.requestType.replace(/_/g, ' ')}</strong><Badge variant={request.status === 'pending' ? 'warning' : 'outline'}>{request.status}</Badge><Badge variant={request.sla?.status === 'overdue' ? 'warning' : 'outline'}>{request.sla?.status || 'unassigned'}</Badge></div><p className="text-xs text-fg-muted">{request.note || 'No note provided.'}</p><p className="text-xs text-fg-subtle">Assigned: {request.assignment?.assignedTo || 'unassigned'} · SLA: {request.sla?.dueAt || 'not set'} · follow-ups: {request.followUp?.followUpCount ?? 0}</p><p className="text-xs text-fg-subtle">Metadata: {JSON.stringify(request.metadata).slice(0, 180)}</p></div><div className="flex shrink-0 gap-1"><Button size="xs" variant="outline" onClick={() => updateCloseoutRequest.mutate({ requestId: request.id, status: 'completed', note: 'Completed from venue post-event review queue.' })}>Complete</Button><Button size="xs" variant="ghost" onClick={() => updateCloseoutRequest.mutate({ requestId: request.id, status: 'rejected', note: 'Closed from venue post-event review queue.' })}>Close</Button></div></div></div>)}</div>
          </div>
          <div className="rounded-lg border border-warning/30 bg-warning-soft/20 p-3 text-xs text-warning"><strong>Privacy boundaries:</strong><ul className="mt-1 list-disc pl-4">{(postEventQueue?.privacyBoundaries || []).map((item) => <li key={item}>{item}</li>)}</ul></div>
        </CardContent>
      </Card>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Left Column: Polls */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3 border-b border-border">
              <CardTitle className="text-base flex items-center gap-2"><BarChart className="w-4 h-4 text-brand" /> Active Polls</CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-6">
              
              {/* Poll Builder */}
              <div className="bg-surface-2 p-4 rounded-lg border border-border">
                <h4 className="text-sm font-medium mb-3">Create New Poll</h4>
                <div className="space-y-3">
                  <Input placeholder="E.g., Which centerpiece design?" value={newPollQuestion} onChange={e => setNewPollQuestion(e.target.value)} />
                  {newPollOptions.map((opt, i) => (
                    <Input key={i} placeholder={`Option ${i+1}`} value={opt} onChange={e => {
                      const newOpts = [...newPollOptions];
                      newOpts[i] = e.target.value;
                      setNewPollOptions(newOpts);
                    }} />
                  ))}
                  <Button variant="outline" size="sm" onClick={() => setNewPollOptions([...newPollOptions, ''])} className="w-full border-dashed"><Plus className="w-4 h-4 mr-1"/> Add Option</Button>
                  <Button onClick={() => createPoll.mutate()} disabled={createPoll.isPending} className="w-full">Publish Poll</Button>
                </div>
              </div>

              {/* Poll List */}
              <div className="space-y-4">
                {polls.map(poll => {
                  const totalVotes = poll.options.reduce((acc, o) => acc + o.votes, 0);
                  return (
                    <div key={poll.id} className="border border-border rounded-lg p-4 bg-surface">
                      <div className="flex justify-between items-start mb-3">
                        <h4 className="font-medium">{poll.question}</h4>
                        <Badge variant={poll.status === 'active' ? 'success' : 'outline'} className="text-[10px] uppercase">{poll.status}</Badge>
                      </div>
                      <div className="space-y-2">
                        {poll.options.map(opt => {
                          const pct = totalVotes > 0 ? Math.round((opt.votes / totalVotes) * 100) : 0;
                          return (
                            <div key={opt.id} className="relative h-8 rounded-md overflow-hidden bg-surface-2 flex items-center px-3 border border-border">
                               <div className="absolute top-0 left-0 bottom-0 bg-brand/20 transition-all duration-500" style={{ width: `${pct}%` }} />
                               <div className="relative z-10 flex justify-between w-full text-sm">
                                 <span>{opt.text}</span>
                                 <span className="font-medium text-fg-muted">{opt.votes} ({pct}%)</span>
                               </div>
                            </div>
                          );
                        })}
                      </div>
                      <div className="mt-3 text-xs text-fg-subtle text-right">Total Votes: {totalVotes}</div>
                    </div>
                  );
                })}
              </div>

            </CardContent>
          </Card>
        </div>

        {/* Right Column: Feedback */}
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-3 border-b border-border flex flex-row items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2"><MessageSquare className="w-4 h-4 text-brand" /> Post-Event Feedback</CardTitle>
              <div className="flex items-center gap-1 font-bold text-lg">
                {avgRating} <Star className="w-5 h-5 text-amber-400 fill-amber-400 -mt-0.5" />
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              {feedback.length === 0 ? (
                <div className="text-center py-12 text-fg-muted">
                  <Star className="w-12 h-12 mx-auto mb-3 opacity-20" />
                  <p>No feedback collected yet.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {feedback.map(f => (
                    <div key={f.id} className="border border-border rounded-lg p-4 bg-surface space-y-2 hover:shadow-sm transition-shadow">
                      <div className="flex justify-between items-center">
                        <span className="font-medium text-sm text-fg">{f.target}</span>
                        <div className="flex">{renderStars(f.rating)}</div>
                      </div>
                      {f.comments && <p className="text-sm text-fg-muted italic">"{f.comments}"</p>}
                      <div className="text-[10px] text-fg-subtle uppercase tracking-wider">Submitted by {f.submittedBy}</div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

      </div>
    </div>
  );
}
