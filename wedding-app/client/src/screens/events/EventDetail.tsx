/**
 * EventDetail — the screen you land on when you click an event.
 *
 * Tab structure (the "spine" of all per-event work):
 *   - Overview  → intelligence widgets + headline numbers (Day 1)
 *   - Guests    → guest list, RSVPs, table assignment (Day 2)
 *   - Timeline  → day-of schedule (Week 8)
 *   - Vendors   → vendors booked for this event (Week 5)
 *   - Layout    → floor plan canvas (Week 2-3)
 *   - Portal    → guest portal config + share link (Day 4)
 *   - Settings  → status, dates, budget, primary contact (Day 1 inline)
 *
 * Tabs that aren't ready yet show a friendly "coming soon" stub instead
 * of being hidden. That way the platform looks complete from day one;
 * each subsequent day fills in another tab.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Calendar, ChevronRight, ClipboardList, Cog, ExternalLink,
  LayoutGrid, Link as LinkIcon, MapPin, MessageCircle, Truck, Users,
} from 'lucide-react';
import { sdk, ApiError } from '../../sdk';
import { useRouter } from '../../lib/router';
import { PageBody, PageHeader } from '../../ui/AppShell';
import { Button } from '../../ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/Card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../ui/Tabs';
import { Badge } from '../../ui/Badge';
import { Skeleton } from '../../ui/Skeleton';
import { StatCard } from '../../ui/StatCard';
import { useToast } from '../../ui/Toast';
import { WidgetSlot } from '../../config/widgets/WidgetSlot';
import { STATUS_META, StatusBadge, statusOrder } from './statusMeta';
import { EventGuestsTab } from './guests/EventGuestsTab';
import { CanvasPage } from './layouts/CanvasPage';
import { GuestPortalSettingsTab } from './portal/GuestPortalSettingsTab';
import { EventInvitesTab } from './invites/EventInvitesTab';
import { EventFeedbackTab } from './feedback/EventFeedbackTab';
import { BarChart } from 'lucide-react';
import { Mail } from 'lucide-react';
import { EventVendorsTab } from './vendors/EventVendorsTab';
import { EventTimelineTab } from './timeline/EventTimelineTab';
import { EventStaffTab } from './staff/EventStaffTab';
import { ChatSystem } from './chat/ChatSystem';
import { EventBudgetTab } from './budget/EventBudgetTab';
import { EventContractsTab } from './contracts/EventContractsTab';
import { EventGalleryTab } from './gallery/EventGalleryTab';
import { DollarSign, Printer, FileSignature, ImageIcon, ScanLine } from 'lucide-react';
import { ClipboardCheck } from 'lucide-react';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '../../ui/Select';
import { useEffect, useState } from 'react';

interface Props { eventId: string }

type TabId = 'overview' | 'guests' | 'timeline' | 'vendors' | 'budget' | 'contracts' | 'gallery' | 'staff' | 'layout' | 'invites' | 'feedback' | 'chat' | 'portal' | 'settings';

export function EventDetail({ eventId, user }: Props & { user: any }) {
  const { navigate, query } = useRouter();
  const initialTab = (query.get('tab') as TabId | null) ?? 'overview';
  const [tab, setTab] = useState<TabId>(initialTab);

  // Keep tab in URL so refresh + sharing works
  useEffect(() => {
    const sp = new URLSearchParams();
    if (tab !== 'overview') sp.set('tab', tab);
    const qs = sp.toString();
    const desired = `/events/${eventId}${qs ? `?${qs}` : ''}`;
    if (window.location.hash.slice(1) !== desired) {
      navigate(desired, { replace: true });
    }
  }, [tab, eventId, navigate]);

  const eventQuery = useQuery({
    queryKey: ['event', eventId],
    queryFn: () => sdk.events.get(eventId),
  });

  const guestsQuery = useQuery({
    queryKey: ['guests', eventId],
    queryFn: () => sdk.guests.list(eventId),
    staleTime: 10_000,
  });

  if (eventQuery.isLoading) {
    return (
      <>
        <PageHeader title={<Skeleton className="h-7 w-64" />} />
        <PageBody><Skeleton className="h-48" /></PageBody>
      </>
    );
  }
  if (eventQuery.isError) {
    return (
      <>
        <PageHeader title="Event not found" />
        <PageBody>
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-danger">
                {(eventQuery.error as Error).message}
              </p>
              <Button variant="outline" className="mt-3" onClick={() => navigate('/events')}>
                Back to events
              </Button>
            </CardContent>
          </Card>
        </PageBody>
      </>
    );
  }

  const event = eventQuery.data!.event;

  return (
    <>
      <PageHeader
        back={{ label: 'All events', href: '#/events' }}
        title={
          <span className="flex items-center gap-3 flex-wrap">
            <span className="font-display">{event.title}</span>
            <StatusBadge status={event.status} />
          </span>
        }
        description={
          <span className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            {event.start_date && (
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                {event.start_date}{event.end_date && event.end_date !== event.start_date ? ` – ${event.end_date}` : ''}
              </span>
            )}
            {event.guest_count > 0 && (
              <span className="inline-flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" />
                {event.guest_count} guests expected
              </span>
            )}
            {event.budget_cents !== null && (
              <span>
                Budget: ${(event.budget_cents / 100).toLocaleString()}
              </span>
            )}
          </span>
        }
        actions={
          <>
          <a href={`#/portal/${eventId}`} target="_blank" rel="noreferrer">
            <Button variant="outline">
              <ExternalLink className="h-3.5 w-3.5" />
              View guest portal
            </Button>
          </a>
          <a href={`#/events/${eventId}/run-sheet`} target="_blank" rel="noreferrer">
            <Button variant="outline">
              <Printer className="h-3.5 w-3.5 mr-1" />
              Print Run Sheet
            </Button>
          </a>
          <a href={`#/events/${eventId}/check-in`} target="_blank" rel="noreferrer">
            <Button variant="default">
              <ScanLine className="h-3.5 w-3.5 mr-1" />
              Vendor Check-In
            </Button>
          </a>
          </>
        }
      />

      <PageBody className="space-y-6">
        <Tabs value={tab} onValueChange={(v) => setTab(v as TabId)} className="print:hidden">
          <TabsList className="overflow-x-auto">
            <TabsTrigger value="overview"><LayoutGrid className="h-3.5 w-3.5 mr-1" />Overview</TabsTrigger>
            <TabsTrigger value="guests"><Users className="h-3.5 w-3.5 mr-1" />Guests</TabsTrigger>
            <TabsTrigger value="invites"><Mail className="h-3.5 w-3.5 mr-1" />Invites</TabsTrigger>
            <TabsTrigger value="feedback"><BarChart className="h-3.5 w-3.5 mr-1" />Polls & Feedback</TabsTrigger>
            <TabsTrigger value="timeline"><ClipboardList className="h-3.5 w-3.5 mr-1" />Timeline</TabsTrigger>
            <TabsTrigger value="vendors"><Truck className="h-3.5 w-3.5 mr-1" />Vendors</TabsTrigger>
            <TabsTrigger value="budget"><DollarSign className="h-3.5 w-3.5 mr-1" />Budget</TabsTrigger>
            <TabsTrigger value="contracts"><FileSignature className="h-3.5 w-3.5 mr-1" />Contracts</TabsTrigger>
            <TabsTrigger value="gallery"><ImageIcon className="h-3.5 w-3.5 mr-1" />Gallery</TabsTrigger>
            <TabsTrigger value="staff"><ClipboardCheck className="h-3.5 w-3.5 mr-1" />Staff</TabsTrigger>
            <TabsTrigger value="chat"><MessageCircle className="h-3.5 w-3.5 mr-1" />Chat</TabsTrigger>
            <TabsTrigger value="layout"><MapPin className="h-3.5 w-3.5 mr-1" />Layout</TabsTrigger>
            <TabsTrigger value="portal"><LinkIcon className="h-3.5 w-3.5 mr-1" />Portal</TabsTrigger>
            <TabsTrigger value="settings"><Cog className="h-3.5 w-3.5 mr-1" />Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <OverviewTab eventId={eventId} counts={guestsQuery.data?.counts} />
          </TabsContent>

          <TabsContent value="guests">
            <EventGuestsTab eventId={eventId} />
          </TabsContent>

          <TabsContent value="invites">
            <EventInvitesTab eventId={eventId} />
          </TabsContent>

          <TabsContent value="feedback">
            <EventFeedbackTab eventId={eventId} />
          </TabsContent>

          <TabsContent value="timeline">
            <EventTimelineTab eventId={eventId} />
          </TabsContent>

          <TabsContent value="vendors">
            <EventVendorsTab eventId={eventId} organizationId={event.organization_id} />
          </TabsContent>

          <TabsContent value="budget">
            <EventBudgetTab eventId={eventId} organizationId={event.organization_id} />
          </TabsContent>

          <TabsContent value="contracts">
            <EventContractsTab eventId={eventId} />
          </TabsContent>

          <TabsContent value="gallery">
            <EventGalleryTab eventId={eventId} />
          </TabsContent>

          <TabsContent value="staff">
            <EventStaffTab eventId={eventId} organizationId={event.organization_id} />
          </TabsContent>

          <TabsContent value="layout">
            <CanvasPage event={event} />
          </TabsContent>

          <TabsContent value="chat">
            <ChatSystem eventId={eventId} currentUser={user} />
          </TabsContent>

          <TabsContent value="portal">
            <GuestPortalSettingsTab eventId={eventId} />
          </TabsContent>

          <TabsContent value="settings">
            <SettingsTab eventId={eventId} />
          </TabsContent>
        </Tabs>
      </PageBody>
    </>
  );
}

// ─── Overview tab ──────────────────────────────────────────
function OverviewTab({
  eventId,
  counts,
}: {
  eventId: string;
  counts?: { pending: number; attending: number; declined: number; maybe: number };
}) {
  const total = counts ? counts.pending + counts.attending + counts.declined + counts.maybe : 0;
  const responseRate = total > 0
    ? Math.round(((counts!.attending + counts!.declined + counts!.maybe) / total) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* KPI band: real-data widgets where we can */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Guests invited"
          value={total > 0 ? total : '—'}
          description={counts ? `${counts.attending} attending · ${counts.declined} declined` : 'Add your first guest'}
        />
        <StatCard
          label="RSVP response rate"
          value={total > 0 ? `${responseRate}%` : '—'}
          benchmark={{ label: 'Industry avg at this stage', value: '52%' }}
        />
        <StatCard
          label="Pending RSVPs"
          value={counts?.pending ?? '—'}
        />
        <StatCard
          label="Confirmed attending"
          value={counts?.attending ?? '—'}
        />
      </div>

      {/* Admin-configurable intelligence widget slot */}
      <div>
        <h3 className="mb-3 text-sm font-medium uppercase tracking-wider text-fg-subtle">
          Intelligence
        </h3>
        <WidgetSlot id="event.detail.intelligence" eventId={eventId} />
      </div>
    </div>
  );
}

// ─── Settings tab (status + simple inline editing) ────────
function SettingsTab({ eventId }: { eventId: string }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const eventQuery = useQuery({
    queryKey: ['event', eventId],
    queryFn: () => sdk.events.get(eventId),
  });
  const event = eventQuery.data?.event;

  const updateStatus = useMutation({
    mutationFn: (status: typeof statusOrder[number]) => sdk.events.update(eventId, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['event', eventId] });
      qc.invalidateQueries({ queryKey: ['events'] });
      toast({ title: 'Status updated', variant: 'success' });
    },
    onError: (e) => toast({
      title: 'Could not update', description: (e as ApiError).message, variant: 'destructive',
    }),
  });

  if (!event) return <Skeleton className="h-48" />;

  return (
    <div className="grid gap-4 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Event status</CardTitle>
          <CardDescription>
            Track this event through your sales + planning pipeline.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Select
            value={event.status}
            onValueChange={(v) => updateStatus.mutate(v as typeof statusOrder[number])}
            disabled={updateStatus.isPending}
          >
            <SelectTrigger className="max-w-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {statusOrder.map((s) => (
                <SelectItem key={s} value={s}>
                  {STATUS_META[s].label} — <span className="text-fg-subtle">{STATUS_META[s].description}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Coming soon</CardTitle>
          <CardDescription>
            Inline-edit title, dates, budget, primary contact, sub-events, and metadata
            — landing in the rest of Week 1.
          </CardDescription>
        </CardHeader>
      </Card>

      <Card className="border-danger/20">
        <CardHeader>
          <CardTitle className="text-base text-danger">Danger zone</CardTitle>
          <CardDescription>
            Deleting an event soft-deletes it and all related guests / layouts.
            Currently disabled in the UI; use the API directly if needed.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" disabled>Delete event</Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Stub used by tabs that aren't built yet ──────────────
function ComingSoon({ title, description, cta }: { title: string; description: string; cta?: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="py-10 text-center space-y-3">
        <Badge variant="info" className="mx-auto">
          <Calendar className="h-3 w-3" /> Roadmap
        </Badge>
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="text-sm text-fg-muted max-w-md mx-auto">{description}</p>
        {cta}
      </CardContent>
    </Card>
  );
}
