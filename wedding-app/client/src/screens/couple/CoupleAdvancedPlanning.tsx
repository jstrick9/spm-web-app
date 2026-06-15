import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BadgeCheck, Box, Brain, Bus, Camera, CloudRain, Gem, HeartHandshake, MapPinned, Music, Palette, Shirt, Sparkles, UsersRound } from 'lucide-react';
import { sdk } from '../../sdk';
import { Badge } from '../../ui/Badge';
import { Button } from '../../ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/Card';
import { Skeleton } from '../../ui/Skeleton';
import { useToast } from '../../ui/Toast';

const ICONS: Record<string, any> = {
  visionBoard: Palette,
  budgetEstimator: Gem,
  ceremony: HeartHandshake,
  weddingParty: Shirt,
  vipNotes: UsersRound,
  photoShotList: Camera,
  music: Music,
  transportation: Bus,
  rainPlan: CloudRain,
  travelMicrosite: MapPinned,
  weddingWeekendMode: BadgeCheck,
  vendorMarketplace: Sparkles,
  memoryBook: Box,
};

function defaultDraft() {
  return {
    visionBoard: { mood: 'romantic garden dinner', colors: 'ivory, sage, champagne', linkedVenueSpaceIds: [] },
    budgetEstimator: { selectedAddOns: [], targetCents: 250000 },
    ceremony: { processional: ['parents', 'wedding party', 'couple'], readers: ['TBD'], music: 'String trio or acoustic', rituals: '', officiantNotes: '' },
    weddingParty: { members: [{ name: 'Alex', role: 'Maid of Honor', phone: '', attire: 'sage' }], rehearsalReminder: true, arrivalReminder: true },
    vipNotes: { notes: [{ person: 'Parent VIP', note: 'Seat near aisle', visibility: 'venue_planner_only' }], privacy: 'venue_planner_only' },
    photoShotList: { mustHave: ['first look', 'family portraits', 'golden hour couple portraits'], family: [], details: ['rings', 'flat lay', 'tablescape'] },
    music: { mustPlay: ['first dance song TBD'], doNotPlay: ['line dances if possible'], specialDances: [] },
    signage: { checklist: ['welcome sign', 'bar menu', 'guest book sign', 'seating chart'], stationeryNotes: '' },
    transportation: { shuttles: [{ route: 'hotel to venue', time: 'TBD' }], lodgingBlocks: [], vipTransport: '' },
    accessibility: { guestCare: ['mobility seating review'], mobility: '', language: '', sensory: '' },
    culturalTraditions: { templates: ['unity ceremony'], notes: '' },
    rainPlan: { preference: 'decide 72 hours before wedding', decisionDeadline: '', communicationDraft: 'If weather changes ceremony location, guests will be directed by venue signage and coordinators.' },
    travelMicrosite: { enabled: true, welcome: 'We cannot wait to celebrate with you.', travelTips: 'Please arrive early and follow venue parking signage.', lodging: '', schedule: '' },
    weddingWeekendMode: { enabled: true, contactsPinned: true, offlinePacket: true },
    vendorMarketplace: { categories: ['florist', 'late-night snack', 'transportation'], recommendationNotes: 'Venue-approved recommendations only.' },
    memoryBook: { enabled: true, prompts: ['Favorite moment from the weekend?', 'Advice for the couple?'], galleryLinks: [] },
  };
}

export function CoupleAdvancedPlanning({ eventId }: { eventId: string }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ['couple-advanced-planning', eventId], queryFn: () => sdk.couple.advancedPlanning(eventId), enabled: !!eventId });
  const [draft, setDraft] = useState<Record<string, any>>(defaultDraft());
  useEffect(() => { if (query.data?.plan) setDraft((current) => ({ ...current, ...query.data!.plan })); }, [query.data?.plan]);

  const saveMutation = useMutation({
    mutationFn: () => sdk.couple.saveAdvancedPlanning(eventId, draft),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['couple-advanced-planning', eventId] }); toast({ title: 'Advanced planning modules saved', variant: 'success' }); },
  });
  const escalateMutation = useMutation({
    mutationFn: (moduleKey?: string) => sdk.couple.escalateAdvancedPlanning(eventId, { moduleKey, urgency: 'normal', question: window.prompt('What should the venue answer or approve?') || 'Please review this advanced planning item.' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['couple-advanced-planning', eventId] }); toast({ title: 'Concierge question escalated to venue', variant: 'success' }); },
  });

  const selectedAddOns = useMemo(() => query.data?.venueLinks.visibleAddOns.slice(0, 4) || [], [query.data?.venueLinks.visibleAddOns]);
  const estimatedAddOnCents = selectedAddOns.reduce((sum, item) => sum + Number(item.estimatedCents || 0), 0);

  if (query.isLoading) return <Card><CardContent className="pt-6"><Skeleton className="h-56 w-full" /></CardContent></Card>;

  return (
    <Card className="border-brand/20 bg-surface" id="couple-best-in-class-planning">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base"><Brain className="h-4 w-4 text-brand" /> Best-in-class couple planning suite</CardTitle>
        <CardDescription>Advanced couple modules with venue-approved AI-style guidance, client-safe inventory/add-ons, privacy controls, guest travel microsite, wedding weekend mode, and memory-book planning.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2 sm:grid-cols-4 text-sm"><div className="rounded-lg border border-border bg-surface-2 p-3"><strong>{query.data?.progress.percent ?? 0}%</strong><p className="text-xs text-fg-muted">advanced suite complete</p></div><div className="rounded-lg border border-border bg-surface-2 p-3"><strong>{query.data?.venueLinks.spaces.length ?? 0}</strong><p className="text-xs text-fg-muted">venue spaces linked</p></div><div className="rounded-lg border border-border bg-surface-2 p-3"><strong>{query.data?.venueLinks.inventory.length ?? 0}</strong><p className="text-xs text-fg-muted">inventory options</p></div><div className="rounded-lg border border-border bg-surface-2 p-3"><strong>${(estimatedAddOnCents / 100).toLocaleString()}</strong><p className="text-xs text-fg-muted">visible add-on estimate</p></div></div>

        <div className="grid gap-3 lg:grid-cols-[1fr_0.8fr]">
          <div className="rounded-lg border border-brand/20 bg-brand-soft/10 p-3 text-sm"><div className="flex items-center gap-2 font-bold text-brand"><Brain className="h-4 w-4" /> Couple AI planning concierge</div><p className="mt-1 text-xs text-fg-muted">Mode: {query.data?.aiConcierge.mode}. Answers are deterministic, venue-approved guidance with escalation when approval is needed.</p><div className="mt-2 grid gap-2">{(query.data?.aiConcierge.answers || []).map((answer) => <div key={answer.question} className="rounded-md border border-border bg-surface p-2 text-xs"><strong>{answer.question}</strong><p className="text-fg-muted">{answer.answer}</p><Badge variant="success">venue approved</Badge></div>)}</div><Button className="mt-2" size="sm" variant="outline" onClick={() => escalateMutation.mutate('aiConcierge')}>Escalate concierge question</Button></div>
          <div className="rounded-lg border border-border bg-surface-2 p-3 text-sm"><strong>Venue spaces + inventory tie-in</strong><p className="mt-1 text-xs text-fg-muted">Vision boards and estimates only reference client-safe spaces, inventory, and add-ons.</p><div className="mt-2 flex flex-wrap gap-1">{(query.data?.venueLinks.spaces || []).slice(0, 6).map((space) => <Badge key={space.id} variant="outline">{space.name}</Badge>)}</div><div className="mt-2 flex flex-wrap gap-1">{selectedAddOns.map((item) => <Badge key={item.id} variant="outline">{item.name}</Badge>)}</div></div>
        </div>

        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">{(query.data?.modules || []).map((module) => { const Icon = ICONS[module.key] || Sparkles; return <div key={module.key} className="rounded-lg border border-border bg-surface-2 p-3 text-sm"><div className="flex items-start justify-between gap-2"><div><div className="flex items-center gap-2 font-bold"><Icon className="h-4 w-4 text-brand" /> {module.label}</div><p className="mt-1 text-xs text-fg-muted">{module.tiedTo.join(' · ')}</p></div><Badge variant={module.priority === 'P2' ? 'default' : 'outline'}>{module.priority}</Badge></div><Button className="mt-2" size="xs" variant="ghost" onClick={() => escalateMutation.mutate(module.key)}>Ask venue</Button></div>; })}</div>

        <div className="grid gap-3 lg:grid-cols-3 text-sm"><label className="rounded-lg border border-border bg-surface-2 p-3"><strong>Rain-plan communication</strong><textarea value={draft.rainPlan?.communicationDraft || ''} onChange={(e) => setDraft((d) => ({ ...d, rainPlan: { ...(d.rainPlan || {}), communicationDraft: e.target.value } }))} className="mt-2 min-h-20 w-full rounded-md border border-border bg-surface p-2 text-sm" /></label><label className="rounded-lg border border-border bg-surface-2 p-3"><strong>Guest travel microsite welcome</strong><textarea value={draft.travelMicrosite?.welcome || ''} onChange={(e) => setDraft((d) => ({ ...d, travelMicrosite: { ...(d.travelMicrosite || {}), welcome: e.target.value } }))} className="mt-2 min-h-20 w-full rounded-md border border-border bg-surface p-2 text-sm" /></label><label className="rounded-lg border border-border bg-surface-2 p-3"><strong>Music do-not-play</strong><textarea value={(draft.music?.doNotPlay || []).join('\n')} onChange={(e) => setDraft((d) => ({ ...d, music: { ...(d.music || {}), doNotPlay: e.target.value.split('\n').filter(Boolean) } }))} className="mt-2 min-h-20 w-full rounded-md border border-border bg-surface p-2 text-sm" /></label></div>

        <div className="flex flex-wrap gap-2"><Button size="sm" onClick={() => saveMutation.mutate()} isLoading={saveMutation.isPending}>Save advanced planning suite</Button>{(query.data?.exports || []).map((item) => <Button key={item.href} asChild size="sm" variant="outline"><a href={item.href} download>{item.label}</a></Button>)}</div>
      </CardContent>
    </Card>
  );
}
