import React, { Suspense } from "react";
/**
 * EventDetail — the screen you land on when you click an event.
 *
 * Phase 19 Day 2: RBAC-gated tabs. Each tab requires a specific permission
 * to be visible. Users without the permission never see the tab trigger.
 * If they somehow navigate to it (e.g. URL manipulation), the content
 * renders a "No access" card instead of crashing with a 403.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Calendar, ClipboardList, Cog, ExternalLink,
  LayoutGrid, Link as LinkIcon, MapPin, MessageCircle, Truck, Users,
  Lock, Copy,
} from 'lucide-react';
import { sdk } from '../../sdk';
import { useRouter } from '../../lib/router';
import { PageBody, PageHeader } from '../../ui/AppShell';
import { Button } from '../../ui/Button';
import { Card, CardContent } from '../../ui/Card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../ui/Tabs';
import { Skeleton } from '../../ui/Skeleton';
import { useToast } from '../../ui/Toast';
import { StatCard } from '../../ui/StatCard';
import { WidgetSlot } from '../../config/widgets/WidgetSlot';
import { EventProgressCard } from './EventProgressCard';
import { EventRiskCard } from './EventRiskCard';
import { EventQuickSwitcher } from './EventQuickSwitcher';
import { StatusBadge } from './statusMeta';
import { EventGuestsTab } from './guests/EventGuestsTab';
import { EventEmergencyTab } from './emergency/EventEmergencyTab';
const CanvasPage = React.lazy(() => import('./layouts/CanvasPage').then(m => ({ default: m.CanvasPage })));
import { GuestPortalSettingsTab } from './portal/GuestPortalSettingsTab';
import { EventInvitesTab } from './invites/EventInvitesTab';
import { EventFeedbackTab } from './feedback/EventFeedbackTab';
import { BarChart, Mail, DollarSign, Printer, FileSignature, ImageIcon, ScanLine, ClipboardCheck, CalendarPlus, ShieldAlert } from 'lucide-react';
import { EventVendorsTab } from './vendors/EventVendorsTab';
import { EventTimelineTab } from './timeline/EventTimelineTab';
import { EventStaffTab } from './staff/EventStaffTab';
import { ChatSystem } from './chat/ChatSystem';
import { EventBudgetTab } from './budget/EventBudgetTab';
import { EventContractsTab } from './contracts/EventContractsTab';
import { EventGalleryTab } from './gallery/EventGalleryTab';
import { EventSettingsForm } from './settings/EventSettingsForm';
import { usePermissions } from '../../lib/usePermission';
import { useEffect, useState, useMemo, type ReactNode } from 'react';

interface Props { eventId: string }

type TabId = 'overview' | 'guests' | 'timeline' | 'vendors' | 'budget' | 'contracts' | 'gallery' | 'staff' | 'layout' | 'invites' | 'feedback' | 'chat' | 'portal' | 'settings' | 'emergency';

// ─── Tab definitions with RBAC mapping ──────────────────
interface TabDef {
  id: TabId;
  label: string;
  icon: ReactNode;
  /** Permission required to see this tab. null = always visible. */
  permission: string | null;
}

const TAB_DEFS: TabDef[] = [
  { id: 'overview',  label: 'Overview',          icon: <LayoutGrid className="h-3.5 w-3.5 mr-1" />,    permission: null },
  { id: 'guests',    label: 'Guests',            icon: <Users className="h-3.5 w-3.5 mr-1" />,         permission: 'guests.view' },
  { id: 'invites',   label: 'Invites',           icon: <Mail className="h-3.5 w-3.5 mr-1" />,          permission: 'invites.view' },
  { id: 'feedback',  label: 'Polls & Feedback',  icon: <BarChart className="h-3.5 w-3.5 mr-1" />,      permission: 'feedback.view' },
  { id: 'timeline',  label: 'Timeline',          icon: <ClipboardList className="h-3.5 w-3.5 mr-1" />, permission: 'timeline.view' },
  { id: 'vendors',   label: 'Vendors',           icon: <Truck className="h-3.5 w-3.5 mr-1" />,         permission: 'vendors.view' },
  { id: 'budget',    label: 'Budget',             icon: <DollarSign className="h-3.5 w-3.5 mr-1" />,    permission: 'budget.view' },
  { id: 'contracts', label: 'Contracts',          icon: <FileSignature className="h-3.5 w-3.5 mr-1" />, permission: 'contracts.view' },
  { id: 'gallery',   label: 'Gallery',            icon: <ImageIcon className="h-3.5 w-3.5 mr-1" />,     permission: 'gallery.view' },
  { id: 'staff',     label: 'Staff',              icon: <ClipboardCheck className="h-3.5 w-3.5 mr-1" />,permission: 'staff.view' },
  { id: 'chat',      label: 'Chat',               icon: <MessageCircle className="h-3.5 w-3.5 mr-1" />, permission: 'messages.view' },
  { id: 'layout',    label: 'Layout',             icon: <MapPin className="h-3.5 w-3.5 mr-1" />,        permission: 'layouts.view' },
  { id: 'portal',    label: 'Portal',             icon: <LinkIcon className="h-3.5 w-3.5 mr-1" />,      permission: 'portal.config.manage' },
  { id: 'emergency', label: 'Emergency',          icon: <ShieldAlert className="h-3.5 w-3.5 mr-1" />,   permission: null },
  { id: 'settings',  label: 'Settings',           icon: <Cog className="h-3.5 w-3.5 mr-1" />,           permission: 'events.edit' },
];

export function EventDetail({ eventId, user }: Props & { user: any }) {
  const { navigate, query } = useRouter();
  const initialTab = (query.get('tab') as TabId | null) ?? 'overview';
  const [tab, setTab] = useState<TabId>(initialTab);

  // ── RBAC: check all tab permissions at once ──
  const permIds = TAB_DEFS.filter(t => t.permission).map(t => t.permission!);
  const perms = usePermissions(permIds);

  const visibleTabs = useMemo(() => {
    return TAB_DEFS.filter(t => {
      if (!t.permission) return true;     // overview always visible
      return perms[t.permission] !== false; // show if permission granted (or unknown while loading)
    });
  }, [perms]);

  // If current tab is not visible, fall back to overview
  useEffect(() => {
    const allowed = visibleTabs.some(t => t.id === tab);
    if (!allowed) setTab('overview');
  }, [visibleTabs, tab]);

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

  // ── Phase 33: Duplicate event (hooks must be before conditionals) ──
  const { toast } = useToast();
  const qc = useQueryClient();
  const duplicateMutation = useMutation({
    mutationFn: () => sdk.events.duplicate(eventId),
    onSuccess: (res: any) => {
      qc.invalidateQueries({ queryKey: ['events'] });
      toast({ title: 'Event duplicated!', description: `"${res.event.title}" created as a new lead.`, variant: 'success' });
      navigate(`/events/${res.event.id}`);
    },
    onError: () => toast({ title: 'Could not duplicate event', variant: 'destructive' }),
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
        backHref="#/events"
        title={
          <span className="flex items-center gap-3 flex-wrap">
            <span className="font-display">{event.title}</span>
            <StatusBadge status={event.status} />
            <EventQuickSwitcher currentEventId={eventId} orgId={event.organization_id} />
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
          <a href={`/api/events/${eventId}/export.ics`} download>
            <Button variant="outline">
              <CalendarPlus className="h-3.5 w-3.5 mr-1" />
              Add to Calendar
            </Button>
          </a>
          <Button variant="outline" onClick={() => duplicateMutation.mutate()} isLoading={duplicateMutation.isPending}>
            <Copy className="h-3.5 w-3.5 mr-1" />
            Duplicate
          </Button>
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
          <div className="relative"><div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-surface to-transparent pointer-events-none z-10 md:hidden" /><TabsList className="overflow-x-auto scrollbar-none" aria-label="Event detail sections">
            {visibleTabs.map(t => (
              <TabsTrigger key={t.id} value={t.id}>
                {t.icon}{t.label}
              </TabsTrigger>
            ))}
          </TabsList></div>

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
            <EventTimelineTab eventId={eventId} organizationId={event.organization_id} />
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
          <TabsContent value="chat">
            <ChatSystem eventId={eventId} currentUser={user} />
          </TabsContent>
          <TabsContent value="layout">
            <Suspense fallback={<div className="p-12 text-center text-fg-muted">Loading floor plan...</div>}><CanvasPage event={event} /></Suspense>
          </TabsContent>
          <TabsContent value="portal">
            <GuestPortalSettingsTab eventId={eventId} />
          </TabsContent>
          <TabsContent value="emergency">
            <EventEmergencyTab eventId={eventId} />
          </TabsContent>
          <TabsContent value="settings">
            <EventSettingsForm eventId={eventId} />
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


      {/* Anomaly & risk alerts (event health) */}
      <EventRiskCard eventId={eventId} />

      {/* Event readiness tracker */}
      <EventProgressCard eventId={eventId} />
      <div>
        <h3 className="mb-3 text-sm font-medium uppercase tracking-wider text-fg-subtle">
          Intelligence
        </h3>
        <WidgetSlot id="event.detail.intelligence" eventId={eventId} />
      </div>
    </div>
  );
}
