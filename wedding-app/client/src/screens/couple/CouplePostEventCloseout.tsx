import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Heart } from 'lucide-react';
import { sdk } from '../../sdk';
import { Badge } from '../../ui/Badge';
import { Button } from '../../ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/Card';
import { Skeleton } from '../../ui/Skeleton';
import { useToast } from '../../ui/Toast';
import { usePrompt } from '../../ui/usePrompt';

export function CouplePostEventCloseout({ eventId, venueContactEmail, coupleNames }: { eventId: string; venueContactEmail?: string; coupleNames?: string }) {
  const { ask, askForm, promptNode } = usePrompt();
  const qc = useQueryClient();
  const { toast } = useToast();
  const postEventQuery = useQuery({ queryKey: ['couple-post-event', eventId], queryFn: () => sdk.couple.postEvent(eventId), enabled: !!eventId });
  const [postEventSurveyDraft, setPostEventSurveyDraft] = useState<Record<string, string>>({ npsScore: '10', overallRating: '5', whatWentWell: '', whatCouldImprove: '', publicTestimonial: '', photoGalleryUrl: '', memoryShareUrl: '' });

  const postEventSurveyMutation = useMutation({
    mutationFn: () => sdk.couple.submitPostEventSurvey(eventId, {
      npsScore: Number(postEventSurveyDraft.npsScore || 10),
      overallRating: Number(postEventSurveyDraft.overallRating || 5),
      whatWentWell: postEventSurveyDraft.whatWentWell,
      whatCouldImprove: postEventSurveyDraft.whatCouldImprove,
      publicTestimonial: postEventSurveyDraft.publicTestimonial,
      mayUseTestimonial: true,
      permissionToContact: true,
      photoGalleryUrl: postEventSurveyDraft.photoGalleryUrl,
      memoryShareUrl: postEventSurveyDraft.memoryShareUrl,
      anniversaryOptIn: postEventSurveyDraft.anniversaryOptIn === 'true',
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['couple-post-event', eventId] }); qc.invalidateQueries({ queryKey: ['couple-requests', eventId] }); toast({ title: 'Post-event survey saved', variant: 'success' }); },
  });
  const lostItemMutation = useMutation({
    mutationFn: (input: { itemDescription: string; lastSeenLocation?: string }) => sdk.couple.reportLostItem(eventId, { ...input, contactPreference: 'email', contactValue: venueContactEmail }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['couple-post-event', eventId] }); toast({ title: 'Lost item report sent to venue', variant: 'success' }); },
  });
  const reviewWorkflowMutation = useMutation({
    mutationFn: (input: { testimonial?: string }) => sdk.couple.submitReviewWorkflow(eventId, { platform: 'google', rating: Number(postEventSurveyDraft.overallRating || 5), testimonial: postEventSurveyDraft.publicTestimonial || input.testimonial || undefined, permissionToPublish: true, reviewerName: coupleNames }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['couple-post-event', eventId] }); toast({ title: 'Review/testimonial workflow saved', variant: 'success' }); },
  });

  const postEvent = postEventQuery.data;
  const postEventComplete = postEvent?.closeoutItems.filter((item) => ['sent','submitted','paid','available','opted_in','ready'].includes(item.status)).length ?? 0;

  return (
    <Card className="border-brand/20 bg-surface" id="couple-post-event-closeout">
        {promptNode}
      <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Heart className="h-4 w-4 text-brand" /> Couple Post-Event Closeout</CardTitle><CardDescription>Lost items, damage deposit, final invoice, feedback/NPS, gallery links, thank-you message, reviews, and anniversary nurture in one couple-friendly closeout flow.</CardDescription></CardHeader>
      <CardContent className="space-y-4">
        {postEventQuery.isLoading ? <Skeleton className="h-48 w-full" /> : null}
        <div className="grid gap-2 sm:grid-cols-4 text-sm"><div className="rounded-lg border border-border bg-surface-2 p-3"><strong>{postEventComplete}/{postEvent?.closeoutItems.length ?? 8}</strong><p className="text-xs text-fg-muted">closeout steps ready/done</p></div><div className="rounded-lg border border-border bg-surface-2 p-3"><strong>{postEvent?.nps.score ?? '—'}</strong><p className="text-xs text-fg-muted">NPS score</p></div><div className="rounded-lg border border-border bg-surface-2 p-3"><strong>{postEvent?.finalInvoice.status || 'pending'}</strong><p className="text-xs text-fg-muted">final invoice</p></div><div className="rounded-lg border border-border bg-surface-2 p-3"><strong>{postEvent?.damageDeposit.status || 'pending'}</strong><p className="text-xs text-fg-muted">damage deposit</p></div></div>
        <div className="grid gap-2 lg:grid-cols-2">{(postEvent?.closeoutItems || []).map((item) => <div key={item.key} className="rounded-lg border border-border bg-surface-2 p-3 text-sm"><div className="flex items-start justify-between gap-2"><div><strong>{item.label}</strong><p className="text-xs text-fg-muted">{item.detail}</p></div><Badge variant={['sent','submitted','paid','opted_in'].includes(item.status) ? 'success' : item.status === 'pending' ? 'warning' : 'outline'}>{item.status.replace(/_/g, ' ')}</Badge></div></div>)}</div>
        <div className="grid gap-3 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-2 rounded-lg border border-border bg-surface-2 p-3 text-sm"><strong>NPS + venue improvement survey</strong><div className="grid gap-2 sm:grid-cols-2"><label className="text-xs font-bold uppercase text-fg-subtle">NPS 0-10<input type="number" min="0" max="10" value={postEventSurveyDraft.npsScore} onChange={(e) => setPostEventSurveyDraft((d) => ({ ...d, npsScore: e.target.value }))} className="mt-1 h-9 w-full rounded-md border border-border bg-surface px-2 text-sm font-normal text-fg" /></label><label className="text-xs font-bold uppercase text-fg-subtle">Overall 1-5<input type="number" min="1" max="5" value={postEventSurveyDraft.overallRating} onChange={(e) => setPostEventSurveyDraft((d) => ({ ...d, overallRating: e.target.value }))} className="mt-1 h-9 w-full rounded-md border border-border bg-surface px-2 text-sm font-normal text-fg" /></label></div><textarea value={postEventSurveyDraft.whatWentWell} onChange={(e) => setPostEventSurveyDraft((d) => ({ ...d, whatWentWell: e.target.value }))} placeholder="What went well? Team shout-outs?" className="min-h-16 w-full rounded-md border border-border bg-surface p-2 text-sm" /><textarea value={postEventSurveyDraft.whatCouldImprove} onChange={(e) => setPostEventSurveyDraft((d) => ({ ...d, whatCouldImprove: e.target.value }))} placeholder="What could the venue improve for future couples?" className="min-h-16 w-full rounded-md border border-border bg-surface p-2 text-sm" /><textarea value={postEventSurveyDraft.publicTestimonial} onChange={(e) => setPostEventSurveyDraft((d) => ({ ...d, publicTestimonial: e.target.value }))} placeholder="Optional public testimonial/review draft" className="min-h-16 w-full rounded-md border border-border bg-surface p-2 text-sm" /><div className="grid gap-2 sm:grid-cols-2"><input aria-label="Photo gallery URL" value={postEventSurveyDraft.photoGalleryUrl} onChange={(e) => setPostEventSurveyDraft((d) => ({ ...d, photoGalleryUrl: e.target.value }))} placeholder="Photo gallery URL" className="h-9 rounded-md border border-border bg-surface px-2 text-sm" /><input aria-label="Memory sharing URL" value={postEventSurveyDraft.memoryShareUrl} onChange={(e) => setPostEventSurveyDraft((d) => ({ ...d, memoryShareUrl: e.target.value }))} placeholder="Memory/photo sharing URL" className="h-9 rounded-md border border-border bg-surface px-2 text-sm" /></div><label className="flex items-center gap-2 text-xs text-fg-muted"><input type="checkbox" checked={postEventSurveyDraft.anniversaryOptIn === 'true'} onChange={(e) => setPostEventSurveyDraft((d) => ({ ...d, anniversaryOptIn: String(e.target.checked) }))} /> Opt in to anniversary/future event nurture</label><div className="flex flex-wrap gap-2"><Button size="sm" onClick={() => postEventSurveyMutation.mutate()} isLoading={postEventSurveyMutation.isPending}>Submit feedback/NPS</Button><Button size="sm" variant="outline" onClick={async () => { const testimonial = await ask({ title: 'Add a testimonial', label: 'Optional testimonial/review text', multiline: true }); if (testimonial == null) return; reviewWorkflowMutation.mutate({ testimonial: testimonial || undefined }); }} isLoading={reviewWorkflowMutation.isPending}>Start review/testimonial workflow</Button></div></div>
          <div className="space-y-3 rounded-lg border border-brand/20 bg-brand-soft/10 p-3 text-sm"><strong>Post-event final packet</strong><p className="text-xs text-fg-muted">Includes closeout statuses, final invoice/payment summary, damage deposit status, NPS/review state, thank-you message, memory links, and privacy notes.</p><ul className="list-disc pl-4 text-xs text-fg-muted">{(postEvent?.debriefQuestions || []).slice(0, 5).map((q) => <li key={q}>{q}</li>)}</ul><div className="space-y-1 text-xs"><strong>Memory links</strong>{(postEvent?.photoSharing.links || []).length ? (postEvent?.photoSharing.links || []).map((link) => <a key={link.url} href={link.url} className="block text-brand underline">{link.label}</a>) : <p className="text-fg-muted">No gallery links yet. Add links in the survey or upload post-event gallery documents.</p>}</div><p className="rounded-md border border-border bg-surface p-2 text-xs text-fg-muted">{postEvent?.thankYouMessage || 'Thank-you message will appear after closeout starts.'}</p><div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={async () => { const values = await askForm({ title: 'Report a lost item', fields: [{ key: 'item', label: 'Describe the lost item', multiline: true, required: true }, { key: 'location', label: 'Where was it last seen?', placeholder: 'e.g., ceremony lawn, parking lot' }] }); if (values) lostItemMutation.mutate({ itemDescription: values.item, lastSeenLocation: values.location || undefined }); }} isLoading={lostItemMutation.isPending}>Report lost item</Button><Button asChild size="sm"><a href={postEvent?.finalPacketUrl || `/api/events/${eventId}/couple-post-event/final-packet.txt`} download>Download post-event final packet</a></Button></div><p className="text-xs text-fg-subtle">Hidden from this couple view: {(postEvent?.hiddenInternalFields || []).join(', ') || 'internal incident/staff/vendor/owner records'}.</p></div>
        </div>
      </CardContent>
    </Card>
  );
}
