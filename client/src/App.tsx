/**
 * App root — Phase 33 update.
 *
 * Changes vs previous version:
 *   1. Lucide imports consolidated to a single statement (N7 fix, perf)
 *   2. EmailAutomationStudio route wired: #/system/email-automations
 *   3. Intelligence nav item added to commandItems (with analytics.view guard)
 *   4. sdk.intelligence.* namespace used where applicable (cleaner imports)
 *   5. Routes component: /system/email-automations added before /system catch
 *   6. CommandPalette: Intelligence item only shown if user has analytics.view
 *   7. usePermission(s) imported from correct path (usePermission, not usePermissions)
 *   8. All else identical to the working Phase 31 App.tsx — surgical additions only
 */
import React, { Suspense, useEffect, useState } from 'react';
import { WelcomeModal }                           from './components/onboarding/WelcomeModal';
import { useQuery, useQueryClient as useQC }       from '@tanstack/react-query';
import { ErrorBoundary }                           from './ui/ErrorBoundary';
import { AppShell, PageBody, PageHeader }          from './ui/AppShell';
import { Button }                                  from './ui/Button';
import { Badge }                                   from './ui/Badge';
import { Skeleton }                                from './ui/Skeleton';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { CommandPalette, type CommandItem }        from './ui/CommandPalette';
import { EmptyState }                              from './ui/EmptyState';
import { Input }                                   from './ui/Input';
import { Label }                                   from './ui/Label';
import { useToast }                                from './ui/Toast';
import { ConfigProvider }                          from './config/ConfigProvider';
import { ReloadPrompt }                            from './ReloadPrompt';

// ── Single consolidated Lucide import (N7 fix) ─────────────────────────────
import {
  Truck, Plus, BarChart, Brain, Calendar, Cog, Home,
  LayoutDashboard, Palette, Users, HelpCircle, Package,
  Link2, Layers, List, Mail,
} from 'lucide-react';

// Dev-only component gallery — tree-shaken out of prod builds
const UiPreview = import.meta.env.DEV
  ? React.lazy(() => import('./ui/preview/UiPreview').then((m) => ({ default: m.UiPreview })))
  : null;

// ── Screen imports (static — critical path) ─────────────────────────────────
import { AdminPanel }              from './screens/system/admin/AdminPanel';
import { WidgetSlot }              from './config/widgets/WidgetSlot';
import { PlatformStudio }          from './screens/PlatformStudio';
import { CatalogScreen }           from './screens/catalog/CatalogScreen';
import { IntegrationHub }          from './screens/system/IntegrationHub';
import { EventQuestionsStudio }    from './screens/system/questions/EventQuestionsStudio';
import { InventoryManager }        from './screens/system/inventory/InventoryManager';
import { GlobalCalendar }          from './screens/calendar/GlobalCalendar';
import { EventsList }              from './screens/events/EventsList';
import { EventDetail }             from './screens/events/EventDetail';
import { CreateEventDialog }       from './screens/events/CreateEventDialog';
import { RunSheet }                from './screens/events/runsheet/RunSheet';
import { VendorPortal }            from './screens/VendorPortal';
import { PublicGuestPortal }       from './screens/portal/PublicGuestPortal';
import { PublicNpsSurvey }         from './screens/portal/PublicNpsSurvey';
import { matchPath, useRouter }    from './lib/router';
import type { PartialPlatformConfig } from './config/schema';
import { CrossEventGuestBrowser }  from './screens/guests/CrossEventGuestBrowser';
import { useRealtimeInvalidation } from './lib/useRealtimeInvalidation';
import { VendorDirectory }         from './screens/vendors/VendorDirectory';
import { UserProfile }             from './screens/system/UserProfile';
import { AuditLog }                from './screens/system/AuditLog';
import { useSessionGuard }         from './lib/useSessionGuard';
import { setPermissionContext, usePermission } from './lib/usePermission';
import { ApiError, getToken, sdk, setToken } from './sdk';
import type { SdkUser, SdkMembership } from './sdk/types';
import { KeyboardShortcutsDialog } from './ui/KeyboardShortcutsDialog';
import { DashboardScreen }         from './screens/dashboard/DashboardScreen';
import { AuthScreen }              from './screens/auth/AuthScreen';
import { NotFoundPage }            from './screens/NotFoundPage';

// ── Lazy-loaded heavy screens ────────────────────────────────────────────────
const VenueBuilder        = React.lazy(() => import('./screens/catalog/venue/VenueBuilder').then((m) => ({ default: m.VenueBuilder })));
const AnalyticsDashboard  = React.lazy(() => import('./screens/system/AnalyticsDashboard').then((m) => ({ default: m.AnalyticsDashboard })));
const VendorCheckInApp    = React.lazy(() => import('./screens/checkin/VendorCheckInApp').then((m) => ({ default: m.VendorCheckInApp })));
const IntelligenceDashboard = React.lazy(() => import('./screens/system/IntelligenceDashboard').then((m) => ({ default: m.IntelligenceDashboard })));
// Phase 33: EmailAutomationStudio lazy-loaded (lives in the system section)
const EmailAutomationStudio = React.lazy(() => import('./screens/system/EmailAutomationStudio').then((m) => ({ default: m.EmailAutomationStudio })));

// ── App root ─────────────────────────────────────────────────────────────────

export default function App() {
  const { path } = useRouter();

  // Dev-only preview
  if (import.meta.env.DEV && UiPreview && path === '/preview') {
    return (
      <Suspense fallback={<div className="p-12 text-center">Loading preview…</div>}>
        <UiPreview />
      </Suspense>
    );
  }

  // Public surfaces (no auth)
  const portal = matchPath('/portal/:eventId', path);
  if (portal) return <PublicGuestPortal eventId={portal.eventId} />;

  const npsPortal = matchPath('/survey/:eventId', path);
  if (npsPortal) return <PublicNpsSurvey eventId={npsPortal.eventId} />;

  const vendorPortal = matchPath('/vendor/:vendorId', path);
  if (vendorPortal) return <VendorPortal vendorId={vendorPortal.vendorId} />;

  // Authenticated app
  return (
    <ErrorBoundary>
      <PlatformApp />
    </ErrorBoundary>
  );
}

// ── PlatformApp (auth gate) ───────────────────────────────────────────────────

function PlatformApp() {
  const [user, setUser] = useState<SdkUser | null>(null);
  const [memberships, setMemberships] = useState<SdkMembership[]>([]);
  const [bootstrapped, setBootstrapped] = useState(false);
  const queryClient = useQC();

  useEffect(() => {
    (async () => {
      if (!getToken()) { setBootstrapped(true); return; }
      try {
        const me = await sdk.auth.me();
        setUser(me.user);
        setMemberships(me.memberships);
      } catch {
        setToken(null);
      } finally {
        setBootstrapped(true);
      }
    })();
  }, []);

  if (!bootstrapped) return <BootSplash />;
  if (!user) {
    return (
      <AuthScreen
        onAuth={(u, m) => { setUser(u); setMemberships(m || []); }}
      />
    );
  }

  return (
    <AuthenticatedApp
      user={user}
      memberships={memberships}
      onLogout={() => {
        void sdk.auth.logout();
        queryClient.clear();
        setUser(null);
      }}
    />
  );
}

function BootSplash() {
  return (
    <div className="min-h-screen bg-bg flex items-center justify-center">
      <div className="text-center space-y-3">
        <div className="font-display text-2xl text-brand-strong">
          Wedding Venue Intelligence
        </div>
        <div className="text-sm text-fg-muted">Loading…</div>
      </div>
    </div>
  );
}

// ── AuthenticatedApp ──────────────────────────────────────────────────────────

function AuthenticatedApp({
  user,
  memberships,
  onLogout,
}: {
  user: SdkUser;
  memberships: SdkMembership[];
  onLogout: () => void;
}) {
  const { hash, navigate } = useRouter();
  const [orgConfig, setOrgConfig] = useState<PartialPlatformConfig | undefined>();
  const [userConfig, setUserConfig] = useState<PartialPlatformConfig | undefined>();
  const [orgId, setOrgId] = useState<string | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [createEventOpen, setCreateEventOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  useRealtimeInvalidation(orgId);

  const { toast: sessionToast } = useToast();
  useSessionGuard(sessionToast as any, onLogout);

  // Set RBAC context for usePermission hooks
  useEffect(() => {
    setPermissionContext(orgId, memberships as any);
  }, [orgId, memberships]);

  // Load org config
  useEffect(() => {
    sdk.orgs.list().then((r) => {
      if (r.organizations[0]) {
        const id = r.organizations[0].id;
        setOrgId(id);
        sdk.platformConfig.getOrg(id).then((r2) => setOrgConfig(r2.config));
      }
    });
    sdk.platformConfig.getUserPreferences().then((r) => setUserConfig(r.config));
  }, []);

  // Keyboard shortcuts (⌘K / ⌘N / ⌘/)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
        e.preventDefault();
        setCreateEventOpen(true);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === '/') {
        e.preventDefault();
        setShortcutsOpen(true);
      }
    };
    const shortcutOpener = () => setShortcutsOpen(true);
    window.addEventListener('keydown', handler);
    window.addEventListener('wvi:open-shortcuts', shortcutOpener);
    return () => {
      window.removeEventListener('keydown', handler);
      window.removeEventListener('wvi:open-shortcuts', shortcutOpener);
    };
  }, []);

  // Permission check for intelligence (analytics.view)
  const canViewAnalytics = usePermission('analytics.view');

  // Static command palette items
  const commandItems: CommandItem[] = [
    { id: 'nav.dashboard',    label: 'Dashboard',          hint: 'Navigation', icon: <LayoutDashboard className="h-4 w-4" />, onSelect: () => navigate('/') },
    { id: 'nav.events',       label: 'Events',             hint: 'Navigation', icon: <List className="h-4 w-4" />,            onSelect: () => navigate('/events') },
    { id: 'nav.calendar',     label: 'Calendar',           hint: 'Navigation', icon: <Calendar className="h-4 w-4" />,        onSelect: () => navigate('/calendar') },
    { id: 'nav.guests',       label: 'Guests',             hint: 'Navigation', icon: <Users className="h-4 w-4" />,           onSelect: () => navigate('/guests') },
    { id: 'nav.vendors',      label: 'Vendors',            hint: 'Navigation', icon: <Truck className="h-4 w-4" />,           onSelect: () => navigate('/vendors') },
    { id: 'nav.system',       label: 'System',             hint: 'Navigation', icon: <Cog className="h-4 w-4" />,             onSelect: () => navigate('/system') },
    { id: 'nav.integrations', label: 'Integration Hub',    hint: 'Settings',   icon: <Link2 className="h-4 w-4" />,           onSelect: () => navigate('/system/integrations') },
    { id: 'nav.questions',    label: 'Event Questions',    hint: 'Settings',   icon: <HelpCircle className="h-4 w-4" />,      onSelect: () => navigate('/system/questions') },
    { id: 'nav.inventory',    label: 'Inventory Manager',  hint: 'Operations', icon: <Package className="h-4 w-4" />,         onSelect: () => navigate('/system/inventory') },
    { id: 'nav.catalog',      label: 'Catalog Studio',     hint: 'Settings',   icon: <Layers className="h-4 w-4" />,          onSelect: () => navigate('/system/catalog') },
    { id: 'nav.venue',        label: 'Venue Builder',      hint: 'Settings',   icon: <Home className="h-4 w-4" />,            onSelect: () => navigate('/system/venue') },
    { id: 'nav.studio',       label: 'Platform Studio',    hint: 'Settings',   icon: <Palette className="h-4 w-4" />,         onSelect: () => navigate('/system/platform') },
    { id: 'nav.audit',        label: 'Audit Log',          hint: 'System',     icon: <Cog className="h-4 w-4" />,             onSelect: () => navigate('/system/audit') },
    { id: 'nav.profile',      label: 'Account Settings',   hint: 'Account',    icon: <Users className="h-4 w-4" />,           onSelect: () => navigate('/settings/profile') },
    { id: 'nav.email-auto',   label: 'Email Automation',   hint: 'Settings',   icon: <Mail className="h-4 w-4" />,            onSelect: () => navigate('/system/email-automations') },
    { id: 'act.create-event', label: 'Create New Event',   hint: 'Action',     keywords: ['new', 'create', 'add', 'event', 'wedding'], icon: <Plus className="h-4 w-4" />, onSelect: () => setCreateEventOpen(true) },
    { id: 'act.logout',       label: 'Sign out',           hint: 'Account',    onSelect: onLogout },
    ...(import.meta.env.DEV ? [{ id: 'nav.preview', label: 'Open Design Preview', hint: 'Developer', keywords: ['styleguide'], onSelect: () => navigate('/preview') }] : []),
    // Intelligence only shown to users with analytics.view permission
    ...(canViewAnalytics ? [{ id: 'nav.intelligence', label: 'Intelligence', hint: 'Analytics', icon: <Brain className="h-4 w-4" />, onSelect: () => navigate('/intelligence') }] : []),
    ...(canViewAnalytics ? [{ id: 'nav.reports', label: 'Analytics Reports', hint: 'Analytics', icon: <BarChart className="h-4 w-4" />, onSelect: () => navigate('/reports') }] : []),
  ];

  // Dynamic: events search
  const eventsQuery = useQuery({
    queryKey: ['events', orgId],
    queryFn: () => orgId ? sdk.events.list(orgId) : Promise.resolve({ events: [] as any[], counts: {} }),
    enabled: !!orgId,
    staleTime: 30_000,
  });
  const dynamicItems: CommandItem[] = (eventsQuery.data?.events ?? []).map((e: any) => ({
    id: `event.${e.id}`,
    label: e.title,
    hint: `${e.status} · ${e.start_date ?? 'No date'}`,
    keywords: [e.status, e.slug, 'event', 'wedding'],
    icon: <Calendar className="h-4 w-4" />,
    onSelect: () => navigate(`/events/${e.id}`),
  }));

  // Dynamic: vendors search
  const vendorsQuery = useQuery({
    queryKey: ['vendors-palette', orgId],
    queryFn: () => orgId ? sdk.vendors.list(orgId) : Promise.resolve({ vendors: [] }),
    enabled: !!orgId,
    staleTime: 60_000,
  });
  const vendorItems: CommandItem[] = (vendorsQuery.data?.vendors ?? []).map((v: any) => ({
    id: `vendor.${v.id}`,
    label: v.name,
    hint: `${v.category} · Vendor`,
    keywords: [v.category, 'vendor', v.contact_name ?? ''].filter(Boolean),
    icon: <Truck className="h-4 w-4" />,
    onSelect: () => navigate('/vendors'),
  }));

  const allCommandItems = [...commandItems, ...dynamicItems, ...vendorItems];

  return (
    <ConfigProvider org={orgConfig} user={userConfig}>
      <AppShell
        user={user}
        currentPath={hash}
        onLogout={onLogout}
        onOpenCommandPalette={() => setPaletteOpen(true)}
      >
        <Routes
          user={user}
          memberships={memberships}
          orgId={orgId}
          onOrgConfigChanged={setOrgConfig}
        />
      </AppShell>

      <ReloadPrompt />

      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        items={allCommandItems}
      />

      <WelcomeModal memberships={memberships} onComplete={() => {}} />

      <KeyboardShortcutsDialog
        open={shortcutsOpen}
        onOpenChange={setShortcutsOpen}
      />

      {orgId && (
        <CreateEventDialog
          orgId={orgId}
          open={createEventOpen}
          onOpenChange={setCreateEventOpen}
          onCreated={(event) => navigate(`/events/${event.id}`)}
        />
      )}
    </ConfigProvider>
  );
}

// ── Route table ───────────────────────────────────────────────────────────────

function Routes({
  user,
  memberships,
  orgId,
  onOrgConfigChanged,
}: {
  user: SdkUser;
  memberships: SdkMembership[];
  orgId: string | null;
  onOrgConfigChanged: (c: PartialPlatformConfig) => void;
}) {
  const { path } = useRouter();

  // ── Public / print surfaces ──
  const runsheet = matchPath('/events/:eventId/run-sheet', path);
  if (runsheet) return <RunSheet eventId={runsheet.eventId} />;

  const checkin = matchPath('/events/:eventId/check-in', path);
  if (checkin) {
    if (!orgId) return <Loading />;
    return (
      <Suspense fallback={<div className="p-12 text-center">Loading check-in…</div>}>
        <VendorCheckInApp eventId={checkin.eventId} organizationId={orgId} />
      </Suspense>
    );
  }

  // ── Events ──
  const detail = matchPath('/events/:eventId', path);
  if (detail) return <EventDetail eventId={detail.eventId} user={user} />;
  if (path === '/events') {
    if (!orgId) return <Loading />;
    return <EventsList orgId={orgId} />;
  }

  // ── Calendar ──
  if (path === '/calendar') {
    if (!orgId) return <Loading />;
    return <GlobalCalendar orgId={orgId} />;
  }

  // ── System: ordered most-specific first ──
  if (path === '/system/email-automations') {
    if (!orgId) return <Loading />;
    return (
      <Suspense fallback={<div className="p-12 text-center text-fg-muted">Loading email automation…</div>}>
        <EmailAutomationStudio orgId={orgId} />
      </Suspense>
    );
  }

  if (path === '/system/venue') {
    if (!orgId) return <Loading />;
    return (
      <>
        <PageHeader title="Venue Builder" description="Draw your venue's structural floorplan boundaries." />
        <PageBody>
          <Suspense fallback={<div className="p-12 text-center text-fg-muted">Loading venue builder…</div>}>
            <VenueBuilder orgId={orgId} />
          </Suspense>
        </PageBody>
      </>
    );
  }

  if (path === '/system/catalog') {
    if (!orgId) return <Loading />;
    return <CatalogScreen orgId={orgId} />;
  }

  if (path === '/system/questions') {
    if (!orgId) return <Loading />;
    return <EventQuestionsStudio orgId={orgId} />;
  }

  if (path === '/system/inventory') {
    if (!orgId) return <Loading />;
    return <InventoryManager orgId={orgId} />;
  }

  if (path === '/system/integrations') {
    if (!orgId) return <Loading />;
    return <IntegrationHub orgId={orgId} />;
  }

  if (path === '/system/platform') {
    if (!orgId) return <Loading />;
    return <PlatformStudio orgId={orgId} onSaved={onOrgConfigChanged} />;
  }

  if (path === '/system/audit') {
    if (!orgId) return <Loading />;
    return <AuditLog orgId={orgId} />;
  }

  if (path === '/system') {
    if (!orgId) return <Loading />;
    return <AdminPanel orgId={orgId} />;
  }

  // ── Analytics / Intelligence ──
  if (path === '/reports') {
    if (!orgId) return <Loading />;
    return (
      <Suspense fallback={<div className="p-12 text-center text-fg-muted">Loading analytics…</div>}>
        <AnalyticsDashboard orgId={orgId} />
      </Suspense>
    );
  }

  if (path === '/intelligence') {
    if (!orgId) return <Loading />;
    return (
      <Suspense fallback={<div className="p-12 text-center">Loading intelligence…</div>}>
        <IntelligenceDashboard orgId={orgId} />
      </Suspense>
    );
  }

  // ── Settings ──
  if (path === '/settings/profile') return <UserProfile user={user} />;

  // ── People ──
  if (path === '/vendors') {
    if (!orgId) return <Loading />;
    return <VendorDirectory orgId={orgId} />;
  }

  if (path === '/guests') {
    if (!orgId) return <Loading />;
    return <CrossEventGuestBrowser orgId={orgId} />;
  }

  // ── Dashboard (root) ──
  if (path === '/' || path === '') {
    return <DashboardScreen user={user} orgId={orgId} />;
  }

  // ── 404 ──
  return <NotFoundPage />;
}

function Loading() {
  return (
    <PageBody>
      <div className="text-fg-muted text-sm py-10 text-center">Loading…</div>
    </PageBody>
  );
}
