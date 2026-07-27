import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, MessageSquarePlus, Send } from 'lucide-react';
import { layoutsSdk } from '../../../sdk/layouts';
import { Button } from '../../../ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../ui/Card';
import { Input } from '../../../ui/Input';
import { useToast } from '../../../ui/Toast';

export function LayoutCollaborationPanel({ layoutId, canApprove }: { layoutId: string; canApprove: boolean }) {
  const { toast } = useToast(); const qc = useQueryClient(); const [comment, setComment] = useState('');
  const { data } = useQuery({ queryKey: ['layout-collaboration', layoutId], queryFn: () => layoutsSdk.collaboration(layoutId) });
  const refresh = () => qc.invalidateQueries({ queryKey: ['layout-collaboration', layoutId] });
  const add = useMutation({ mutationFn: () => layoutsSdk.addComment(layoutId, { body: comment }), onSuccess: () => { setComment(''); refresh(); toast({ title: 'Comment added', variant: 'success' }); } });
  const request = useMutation({ mutationFn: () => layoutsSdk.requestReview(layoutId), onSuccess: () => { refresh(); toast({ title: 'Review requested', description: 'The venue can now approve or request changes.', variant: 'success' }); } });
  const decide = useMutation({ mutationFn: ({ id, decision }: { id: string; decision: 'approved'|'changes_requested'|'rejected' }) => layoutsSdk.decideReview(layoutId, id, { decision }), onSuccess: () => { refresh(); toast({ title: 'Review decision saved', variant: 'success' }); } });
  return <Card><CardHeader><CardTitle>Review and collaboration</CardTitle><CardDescription>Planners and couples can leave feedback; venue managers provide the final operational approval.</CardDescription></CardHeader><CardContent className="space-y-4"><div className="flex gap-2"><Input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Add a layout comment or change request" /><Button disabled={!comment.trim()} isLoading={add.isPending} onClick={() => add.mutate()}><Send className="h-4 w-4" /> Add comment</Button></div><div className="space-y-2">{data?.comments?.map((item: any) => <div key={item.id} className="rounded-lg border border-border p-3 text-sm"><strong>{item.author_label || 'Collaborator'}</strong><p>{item.body}</p><span className="text-xs text-fg-muted">Revision {item.revision} · {item.status}</span></div>) ?? <p className="text-sm text-fg-muted">No comments yet.</p>}</div><div className="flex flex-wrap gap-2 border-t border-border pt-3"><Button variant="outline" isLoading={request.isPending} onClick={() => request.mutate()}><MessageSquarePlus className="h-4 w-4" /> Request venue review</Button>{canApprove && data?.reviews?.filter((r: any) => r.decision === 'pending').map((review: any) => <div key={review.id} className="flex gap-1"><Button size="sm" onClick={() => decide.mutate({ id: review.id, decision: 'approved' })}><Check className="h-4 w-4" /> Approve</Button><Button size="sm" variant="outline" onClick={() => decide.mutate({ id: review.id, decision: 'changes_requested' })}>Request changes</Button></div>)}</div></CardContent></Card>;
}
