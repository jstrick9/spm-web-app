/**
 * App root — Phase 33 update.
 *
 * Changes vs previous version:
 *   1. Lucide imports consolidated to a single statement (N7 fix, perf)
 *   2. EmailAutomationStudio route wired: #/system/email-automations
 *   3. Intelligence nav item added to commandItems (with reports.view guard)
 *   4. sdk.intelligence.* namespace used where applicable (cleaner imports)
 *   5. Routes component: /system/email-automations added before /system catch
 *   6. CommandPalette: Intelligence item only shown if user has reports.view
 *   7. usePermission(s) imported from correct path (usePermission, not usePermissions)
 *   8. All else identical to the working Phase 31 App.tsx — surgical additions only
 */
import React, { Suspense, useEffect, useState } from 'react';
import { WelcomeModal }                           from './components/onboarding/WelcomeModal';
import { VenueOwnerSetupWizard }                  from './components/onboarding/VenueOwnerSetupWizard';
import { useQuery, useQueryClient as useQC }       from '@tanstack/react-query';
import { ErrorBoundary }                           from './ui/ErrorBoundary';
import { AccessDenied }                            from './ui/AccessDenied';
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

// ── Critical-path imports ───────────────────────────────────────────────────
import { matchPath, useRouter }    from './lib/router';
import type { PartialPlatformConfig } from './config/schema';
import { useRealtimeInvalidation } from './lib/useRealtimeInvalidation';
import { useSessionGuard }         from './lib/useSessionGuard';
import { setPermissionContext, usePermission, usePermissionGate, usePermissions } from './lib/usePermission';
import { ApiError, getToken, sdk, setToken } from './sdk';
import type { SdkUser, SdkMembership } from './sdk/types';
import { KeyboardShortcutsDialog } from './ui/KeyboardShortcutsDialog';
import { AuthScreen }              from './screens/auth/AuthScreen';
import { NotFoundPage }            from './screens/NotFoundPage';

// ── Route-level lazy screens ────────────────────────────────────────────────
// Keep the unauthenticated/login shell lean; load domain workspaces only when
// their route is reached. This is especially important because EventDetail
// fans out to many feature-rich tabs.
const DashboardScreen     = React.lazy(() => import('./screens/dashboard/DashboardScreen').then((m) => ({ default: m.DashboardScreen })));
const EventsList          = React.lazy(() => import('./screens/events/EventsList').then((m) => ({ default: m.EventsList })));
const EventDetail         = React.lazy(() => import('./screens/events/EventDetail').then((m) => ({ default: m.EventDetail })));
const CreateEventDialog   = React.lazy(() => import('./screens/events/CreateEventDialog').then((m) => ({ default: m.CreateEventDialog })));
const RunSheet            = React.lazy(() => import('./screens/events/runsheet/RunSheet').then((m) => ({ default: m.RunSheet })));
const GlobalCalendar      = React.lazy(() => import('./screens/calendar/GlobalCalendar').then((m) => ({ default: m.GlobalCalendar })));
const CrossEventGuestBrowser = React.lazy(() => import('./screens/guests/CrossEventGuestBrowser').then((m) => ({ default: m.CrossEventGuestBrowser })));
const VendorDirectory     = React.lazy(() => import('./screens/vendors/VendorDirectory').then((m) => ({ default: m.VendorDirectory })));
const UserProfile         = React.lazy(() => import('./screens/system/UserProfile').then((m) => ({ default: m.UserProfile })));
const AuditLog            = React.lazy(() => import('./screens/system/AuditLog').then((m) => ({ default: m.AuditLog })));

// Public/portal surfaces are also lazy so the authenticated shell does not pay
// for guest/vendor portal code on initial load.
const VendorPortal        = React.lazy(() => import('./screens/VendorPortal').then((m) => ({ default: m.VendorPortal })));
const PublicGuestPortal   = React.lazy(() => import('./screens/portal/PublicGuestPortal').then((m) => ({ default: m.PublicGuestPortal })));
const PublicNpsSurvey     = React.lazy(() => import('./screens/portal/PublicNpsSurvey').then((m) => ({ default: m.PublicNpsSurvey })));
const CoupleEventHub      = React.lazy(() => import('./screens/couple/CoupleEventHub').then((m) => ({ default: m.CoupleEventHub })));

// System/admin modules
const AdminPanel          = React.lazy(() => import('./screens/system/admin/AdminPanel').then((m) => ({ default: m.AdminPanel })));
const PlatformStudio      = React.lazy(() => import('./screens/PlatformStudio').then((m) => ({ default: m.PlatformStudio })));
const CatalogScreen       = React.lazy(() => import('./screens/catalog/CatalogScreen').then((m) => ({ default: m.CatalogScreen })));
const IntegrationHub      = React.lazy(() => import('./screens/system/IntegrationHub').then((m) => ({ default: m.IntegrationHub })));
const EventQuestionsStudio = React.lazy(() => import('./screens/system/questions/EventQuestionsStudio').then((m) => ({ default: m.EventQuestionsStudio })));
const InventoryManager    = React.lazy(() => import('./screens/system/inventory/InventoryManager').then((m) => ({ default: m.InventoryManager })));
const VenueBuilder        = React.lazy(() => import('./screens/catalog/venue/VenueBuilder').then((m) => ({ default: m.VenueBuilder })));
const AnalyticsDashboard  = React.lazy(() => import('./screens/system/AnalyticsDashboard').then((m) => ({ default: m.AnalyticsDashboard })));
const VendorCheckInApp    = React.lazy(() => import('./screens/checkin/VendorCheckInApp').then((m) => ({ default: m.VendorCheckInApp })));
const IntelligenceDashboard = React.lazy(() => import('./screens/system/IntelligenceDashboard').then((m) => ({ default: m.IntelligenceDashboard })));
const EmailAutomationStudio = React.lazy(() => import('./screens/system/EmailAutomationStudio').then((m) => ({ default: m.EmailAutomationStudio })));

// ── App root ─────────────────────────────────────────────────────────────────

export default function App() {
  const { path, query } = useRouter();

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
  if (portal) {
    return (
      <Suspense fallback={<PublicRouteFallback label="Loading guest portal…" />}>
        <PublicGuestPortal eventId={portal.eventId} />
      </Suspense>
    );
  }

  const npsPortal = matchPath('/survey/:eventId', path);
  if (npsPortal) {
    return (
      <Suspense fallback={<PublicRouteFallback label="Loading survey…" />}>
        <PublicNpsSurvey eventId={npsPortal.eventId} />
      </Suspense>
    );
  }

  const vendorPortal = matchPath('/vendor/:vendorId', path);
  if (vendorPortal) {
    return (
      <Suspense fallback={<PublicRouteFallback label="Loading vendor portal…" />}>
        <VendorPortal vendorId={vendorPortal.vendorId} token={query.get('token') ?? ''} />
      </Suspense>
    );
  }

  // Authenticated app
  return (
    <ErrorBoundary>
      <PlatformApp />
    </ErrorBoundary>
  );
}

function PublicRouteFallback({ label }: { label: string }) {
  return (
    <div className="min-h-screen bg-bg text-fg flex items-center justify-center p-6">
      <div className="text-center space-y-2">
        <div className="font-display text-xl text-brand-strong">Wedding Venue Intelligence</div>
        <div className="text-sm text-fg-muted">{label}</div>
      </div>
    </div>
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
  const [ownerSetupOpen, setOwnerSetupOpen] = useState(false);

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
      const membershipOrgId = memberships.find((m) => m.organizationId)?.organizationId || memberships.find((m) => m.eventOrganizationId)?.eventOrganizationId;
      const id = r.organizations[0]?.id || membershipOrgId;
      if (id) {
        setOrgId(id);
        sdk.platformConfig.getOrg(id).then((r2) => setOrgConfig(r2.config)).catch(() => setOrgConfig({}));
      }
    });
    sdk.platformConfig.getUserPreferences().then((r) => setUserConfig(r.config));
  }, [memberships]);

  useEffect(() => {
    if (!orgId || !orgConfig) return;
    const isOwner = memberships.some(m => ['owner', 'admin'].includes(m.roleKey));
    const shouldShow = localStorage.getItem('wvi_show_owner_setup') === 'true';
    if (isOwner && shouldShow) setOwnerSetupOpen(true);
  }, [orgId, orgConfig, memberships]);

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
    const setupOpener = () => setOwnerSetupOpen(true);
    window.addEventListener('keydown', handler);
    window.addEventListener('wvi:open-shortcuts', shortcutOpener);
    window.addEventListener('wvi:open-owner-setup', setupOpener);
    return () => {
      window.removeEventListener('keydown', handler);
      window.removeEventListener('wvi:open-shortcuts', shortcutOpener);
      window.removeEventListener('wvi:open-owner-setup', setupOpener);
    };
  }, []);

  useEffect(() => {
    const pendingRedirect = localStorage.getItem('wvi_post_auth_redirect');
    if (pendingRedirect) {
      localStorage.removeItem('wvi_post_auth_redirect');
      navigate(pendingRedirect);
      return;
    }
    const coupleEventId = memberships.find((m) => m.roleKey === 'couple' && m.eventId)?.eventId;
    if (!coupleEventId) return;
    const coupleSafe = hash.startsWith('#/couple/events/') || hash.startsWith('#/settings/profile');
    if (!coupleSafe) navigate(`/couple/events/${coupleEventId}`);
  }, [hash, memberships, navigate]);

  // Permission check for intelligence/reporting surfaces.
  const canViewReports = usePermission('reports.view');
  const commandPermissions = usePermissions([
    'events.view',
    'events.create',
    'guests.view',
    'vendors.view',
    'calendar.view',
    'platform.manage',
    'reports.view',
  ] as const);

  // Static command palette items
  const commandItems: CommandItem[] = [
    { id: 'nav.dashboard',    label: 'Dashboard',          hint: 'Navigation', icon: <LayoutDashboard className="h-4 w-4" />, onSelect: () => navigate('/') },
    ...(commandPermissions['events.view'] ? [{ id: 'nav.events', label: 'Events', hint: 'Navigation', icon: <List className="h-4 w-4" />, onSelect: () => navigate('/events') }] : []),
    ...(commandPermissions['calendar.view'] ? [{ id: 'nav.calendar', label: 'Calendar', hint: 'Navigation', icon: <Calendar className="h-4 w-4" />, onSelect: () => navigate('/calendar') }] : []),
    ...(commandPermissions['guests.view'] ? [{ id: 'nav.guests', label: 'Guests', hint: 'Navigation', icon: <Users className="h-4 w-4" />, onSelect: () => navigate('/guests') }] : []),
    ...(commandPermissions['vendors.view'] ? [{ id: 'nav.vendors', label: 'Vendors', hint: 'Navigation', icon: <Truck className="h-4 w-4" />, onSelect: () => navigate('/vendors') }] : []),
    ...(commandPermissions['platform.manage'] ? [
      { id: 'nav.system',       label: 'System',             hint: 'Navigation', icon: <Cog className="h-4 w-4" />,             onSelect: () => navigate('/system') },
      { id: 'nav.integrations', label: 'Integration Hub',    hint: 'Settings',   icon: <Link2 className="h-4 w-4" />,           onSelect: () => navigate('/system/integrations') },
      { id: 'nav.questions',    label: 'Couple Intake Forms', hint: 'Settings',  icon: <HelpCircle className="h-4 w-4" />,      onSelect: () => navigate('/system/questions') },
      { id: 'nav.inventory',    label: 'Venue Inventory',    hint: 'Operations', icon: <Package className="h-4 w-4" />,         onSelect: () => navigate('/system/inventory') },
      { id: 'nav.catalog',      label: 'Venue Studio: Assets & Templates', hint: 'Settings', icon: <Layers className="h-4 w-4" />, onSelect: () => navigate('/system/catalog') },
      { id: 'nav.venue',        label: 'Venue Studio: Spaces', hint: 'Settings', icon: <Home className="h-4 w-4" />,            onSelect: () => navigate('/system/venue') },
      { id: 'nav.studio',       label: 'Brand & Experience', hint: 'Settings',  icon: <Palette className="h-4 w-4" />,         onSelect: () => navigate('/system/platform') },
      { id: 'nav.audit',        label: 'Audit Log',          hint: 'System',     icon: <Cog className="h-4 w-4" />,             onSelect: () => navigate('/system/audit') },
      { id: 'nav.email-auto',   label: 'Email Automation',   hint: 'Settings',   icon: <Mail className="h-4 w-4" />,            onSelect: () => navigate('/system/email-automations') },
    ] : []),
    { id: 'nav.profile',      label: 'Account Settings',   hint: 'Account',    icon: <Users className="h-4 w-4" />,           onSelect: () => navigate('/settings/profile') },
    ...(commandPermissions['events.create'] ? [{ id: 'act.create-event', label: 'Create New Event', hint: 'Action', keywords: ['new', 'create', 'add', 'event', 'wedding'], icon: <Plus className="h-4 w-4" />, onSelect: () => setCreateEventOpen(true) }] : []),
    { id: 'act.logout',       label: 'Sign out',           hint: 'Account',    onSelect: onLogout },
    ...(import.meta.env.DEV ? [{ id: 'nav.preview', label: 'Open Design Preview', hint: 'Developer', keywords: ['styleguide'], onSelect: () => navigate('/preview') }] : []),
    ...(canViewReports ? [{ id: 'nav.intelligence', label: 'Intelligence', hint: 'Analytics', icon: <Brain className="h-4 w-4" />, onSelect: () => navigate('/intelligence') }] : []),
    ...(canViewReports ? [{ id: 'nav.reports', label: 'Analytics Reports', hint: 'Analytics', icon: <BarChart className="h-4 w-4" />, onSelect: () => navigate('/reports') }] : []),
  ];

  // Dynamic: events search
  const eventsQuery = useQuery({
    queryKey: ['events', orgId],
    queryFn: () => orgId ? sdk.events.list(orgId) : Promise.resolve({ events: [] as any[], counts: {} }),
    enabled: !!orgId && commandPermissions['events.view'],
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
    enabled: !!orgId && commandPermissions['vendors.view'],
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
        <Suspense fallback={<Loading />}>
          <Routes
            user={user}
            memberships={memberships}
            orgId={orgId}
            userConfig={userConfig}
            onOrgConfigChanged={setOrgConfig}
            onCreateEvent={() => setCreateEventOpen(true)}
          />
        </Suspense>
      </AppShell>

      <ReloadPrompt />

      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        items={allCommandItems}
      />

      <WelcomeModal memberships={memberships} orgId={orgId} userConfig={userConfig} onUserConfigChanged={setUserConfig} onComplete={() => {}} />

      {orgId && (
        <VenueOwnerSetupWizard
          orgId={orgId}
          open={ownerSetupOpen}
          initialConfig={orgConfig}
          onOpenChange={setOwnerSetupOpen}
          onSaved={setOrgConfig}
        />
      )}

      <KeyboardShortcutsDialog
        open={shortcutsOpen}
        onOpenChange={setShortcutsOpen}
      />

      {orgId && createEventOpen && (
        <Suspense fallback={null}>
          <CreateEventDialog
            orgId={orgId}
            open={createEventOpen}
            onOpenChange={setCreateEventOpen}
            onCreated={(event: { id: string }) => navigate(`/events/${event.id}`)}
          />
        </Suspense>
      )}
    </ConfigProvider>
  );
}

// ── Route table ───────────────────────────────────────────────────────────────

type RoutePermission =
  | 'events.view'
  | 'timeline.view'
  | 'vendors.checkin.view'
  | 'calendar.view'
  | 'invites.view'
  | 'venues.manage'
  | 'catalog.view'
  | 'questions.view'
  | 'inventory.view'
  | 'integrations.view'
  | 'platform.manage'
  | 'audit.view'
  | 'reports.view'
  | 'vendors.view'
  | 'guests.view';

function RequirePermission({
  permission,
  feature,
  children,
}: {
  permission: RoutePermission;
  feature: string;
  children: React.ReactNode;
}) {
  const { allowed, isLoading } = usePermissionGate(permission);
  if (isLoading) return <Loading />;
  if (!allowed) {
    return (
      <PageBody>
        <AccessDenied feature={feature} />
      </PageBody>
    );
  }
  return <>{children}</>;
}

function Routes({
  user,
  memberships,
  orgId,
  userConfig,
  onOrgConfigChanged,
  onCreateEvent,
}: {
  user: SdkUser;
  memberships: SdkMembership[];
  orgId: string | null;
  userConfig?: PartialPlatformConfig;
  onOrgConfigChanged: (c: PartialPlatformConfig) => void;
  onCreateEvent: () => void;
}) {
  const { path } = useRouter();

  // ── Couple private hub ──
  const coupleHub = matchPath('/couple/events/:eventId', path);
  if (coupleHub) {
    return <CoupleEventHub eventId={coupleHub.eventId} />;
  }
  const coupleEventId = memberships.find((m) => m.roleKey === 'couple' && m.eventId)?.eventId;
  if (coupleEventId && path !== '/settings/profile') {
    return <CoupleEventHub eventId={coupleEventId} />;
  }

  // ── Public / print surfaces ──
  const runsheet = matchPath('/events/:eventId/run-sheet', path);
  if (runsheet) {
    return (
      <RequirePermission permission="timeline.view" feature="Run Sheet">
        <RunSheet eventId={runsheet.eventId} />
      </RequirePermission>
    );
  }

  const checkin = matchPath('/events/:eventId/check-in', path);
  if (checkin) {
    if (!orgId) return <Loading />;
    return (
      <RequirePermission permission="vendors.checkin.view" feature="Vendor Check-In">
        <Suspense fallback={<div className="p-12 text-center">Loading check-in…</div>}>
          <VendorCheckInApp eventId={checkin.eventId} organizationId={orgId} />
        </Suspense>
      </RequirePermission>
    );
  }

  // ── Events ──
  const detail = matchPath('/events/:eventId', path);
  if (detail) {
    return (
      <RequirePermission permission="events.view" feature="Event Details">
        <EventDetail eventId={detail.eventId} user={user} />
      </RequirePermission>
    );
  }
  if (path === '/events') {
    if (!orgId) return <Loading />;
    return (
      <RequirePermission permission="events.view" feature="Events">
        <EventsList orgId={orgId} />
      </RequirePermission>
    );
  }

  // ── Calendar ──
  if (path === '/calendar') {
    if (!orgId) return <Loading />;
    return (
      <RequirePermission permission="calendar.view" feature="Calendar">
        <GlobalCalendar orgId={orgId} />
      </RequirePermission>
    );
  }

  // ── System: ordered most-specific first ──
  if (path === '/system/email-automations') {
    if (!orgId) return <Loading />;
    return (
      <RequirePermission permission="invites.view" feature="Email Automation">
        <Suspense fallback={<div className="p-12 text-center text-fg-muted">Loading email automation…</div>}>
          <EmailAutomationStudio orgId={orgId} />
        </Suspense>
      </RequirePermission>
    );
  }

  if (path === '/system/venue') {
    if (!orgId) return <Loading />;
    return (
      <RequirePermission permission="venues.manage" feature="Venue Studio">
        <PageHeader title="Venue Studio: Spaces" description="Create approved venue spaces, reference plans, and reusable operational scaffolds." />
        <PageBody>
          <Suspense fallback={<div className="p-12 text-center text-fg-muted">Loading venue builder…</div>}>
            <VenueBuilder orgId={orgId} />
          </Suspense>
        </PageBody>
      </RequirePermission>
    );
  }

  if (path === '/system/catalog') {
    if (!orgId) return <Loading />;
    return (
      <RequirePermission permission="catalog.view" feature="Catalog Studio">
        <CatalogScreen orgId={orgId} />
      </RequirePermission>
    );
  }

  if (path === '/system/questions') {
    if (!orgId) return <Loading />;
    return (
      <RequirePermission permission="questions.view" feature="Questions Studio">
        <EventQuestionsStudio orgId={orgId} />
      </RequirePermission>
    );
  }

  if (path === '/system/inventory') {
    if (!orgId) return <Loading />;
    return (
      <RequirePermission permission="inventory.view" feature="Inventory Manager">
        <InventoryManager orgId={orgId} />
      </RequirePermission>
    );
  }

  if (path === '/system/integrations') {
    if (!orgId) return <Loading />;
    return (
      <RequirePermission permission="integrations.view" feature="Integration Hub">
        <IntegrationHub orgId={orgId} />
      </RequirePermission>
    );
  }

  if (path === '/system/platform') {
    if (!orgId) return <Loading />;
    return (
      <RequirePermission permission="platform.manage" feature="Platform Studio">
        <PlatformStudio orgId={orgId} onSaved={onOrgConfigChanged} />
      </RequirePermission>
    );
  }

  if (path === '/system/audit') {
    if (!orgId) return <Loading />;
    return (
      <RequirePermission permission="audit.view" feature="Audit Log">
        <AuditLog orgId={orgId} />
      </RequirePermission>
    );
  }

  if (path === '/system') {
    if (!orgId) return <Loading />;
    return (
      <RequirePermission permission="platform.manage" feature="System Administration">
        <AdminPanel orgId={orgId} />
      </RequirePermission>
    );
  }

  // ── Analytics / Intelligence ──
  if (path === '/reports') {
    if (!orgId) return <Loading />;
    return (
      <RequirePermission permission="reports.view" feature="Analytics Reports">
        <Suspense fallback={<div className="p-12 text-center text-fg-muted">Loading analytics…</div>}>
          <AnalyticsDashboard orgId={orgId} />
        </Suspense>
      </RequirePermission>
    );
  }

  if (path === '/intelligence') {
    if (!orgId) return <Loading />;
    return (
      <RequirePermission permission="reports.view" feature="Intelligence">
        <Suspense fallback={<div className="p-12 text-center">Loading intelligence…</div>}>
          <IntelligenceDashboard orgId={orgId} />
        </Suspense>
      </RequirePermission>
    );
  }

  // ── Settings ──
  if (path === '/settings/profile') return <UserProfile user={user} />;

  // ── People ──
  if (path === '/vendors') {
    if (!orgId) return <Loading />;
    return (
      <RequirePermission permission="vendors.view" feature="Vendor Directory">
        <VendorDirectory orgId={orgId} />
      </RequirePermission>
    );
  }

  if (path === '/guests') {
    if (!orgId) return <Loading />;
    return (
      <RequirePermission permission="guests.view" feature="Guest Browser">
        <CrossEventGuestBrowser orgId={orgId} />
      </RequirePermission>
    );
  }

  // ── Dashboard (root) ──
  if (path === '/' || path === '') {
    return (
      <RequirePermission permission="events.view" feature="Dashboard">
        <DashboardScreen user={user} orgId={orgId} userConfig={userConfig} onCreateEvent={onCreateEvent} />
      </RequirePermission>
    );
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
