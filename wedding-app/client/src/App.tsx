import React, { Suspense } from "react";
import { WelcomeModal } from './components/onboarding/WelcomeModal';
import { useQuery, useQueryClient as useQC } from "@tanstack/react-query";
import { Truck, Plus } from "lucide-react";
import { BarChart } from "lucide-react";
import { ErrorBoundary } from './ui/ErrorBoundary';
/**
 * App root.
 *
 * Three top-level surfaces:
 *   1. Login / Register (no auth)
 *   2. Authenticated app — AppShell + hash routes
 *        /                 → Dashboard
 *        /events           → Events list (Day 1)
 *        /events/:id       → Event detail (Day 1)
 *        /guests           → Cross-event guest browser (Phase 18)
 *        /system           → System (sync control panel)
 *        /system/platform  → Platform Studio (theme presets)
 *        /preview          → Design system styleguide (dev)
 *   3. Public Guest Portal (no auth) — /portal/:eventId
 */
import {
  Calendar, Cog, Home, LayoutDashboard, Palette, Users,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { ApiError, getToken, sdk, setToken } from './sdk';
import type { SdkUser, SdkMembership } from './sdk/types';
import { AppShell, PageBody, PageHeader } from './ui/AppShell';
import { Button } from './ui/Button';
import { Badge } from "./ui/Badge";
import { Skeleton } from "./ui/Skeleton";
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { CommandPalette, type CommandItem } from './ui/CommandPalette';
import { EmptyState } from './ui/EmptyState';
import { Input } from './ui/Input';
import { Label } from './ui/Label';
import { useToast } from './ui/Toast';
import { ConfigProvider } from './config/ConfigProvider';
import { ReloadPrompt } from './ReloadPrompt';
// Dev-only component gallery. Wrapped so the dynamic import (and its ~385 KB
// chunk) is only referenced in development and tree-shaken from prod builds.
const UiPreview = import.meta.env.DEV
  ? React.lazy(() => import('./ui/preview/UiPreview').then(m => ({ default: m.UiPreview })))
  : null;
import { AdminPanel } from './screens/system/admin/AdminPanel';
import { WidgetSlot } from './config/widgets/WidgetSlot';
import { PlatformStudio } from './screens/PlatformStudio';
import { CatalogScreen } from './screens/catalog/CatalogScreen';
const VenueBuilder = React.lazy(() => import('./screens/catalog/venue/VenueBuilder').then(m => ({ default: m.VenueBuilder })));
import { IntegrationHub } from './screens/system/IntegrationHub';
import { EventQuestionsStudio } from './screens/system/questions/EventQuestionsStudio';
import { HelpCircle, Package } from 'lucide-react';
import { InventoryManager } from './screens/system/inventory/InventoryManager';
const AnalyticsDashboard = React.lazy(() => import('./screens/system/AnalyticsDashboard').then(m => ({ default: m.AnalyticsDashboard })));
import { Link2 } from 'lucide-react';
import { GlobalCalendar } from './screens/calendar/GlobalCalendar';
const VendorCheckInApp = React.lazy(() => import('./screens/checkin/VendorCheckInApp').then(m => ({ default: m.VendorCheckInApp })));
import { Layers } from 'lucide-react';
import { EventsList } from './screens/events/EventsList';
import { List } from 'lucide-react';
import { EventDetail } from './screens/events/EventDetail';
import { CreateEventDialog } from "./screens/events/CreateEventDialog";
import { RunSheet } from './screens/events/runsheet/RunSheet';
import { VendorPortal } from './screens/VendorPortal';
import { PublicGuestPortal } from './screens/portal/PublicGuestPortal';
import { matchPath, useRouter } from './lib/router';
import type { PartialPlatformConfig } from './config/schema';
// ── Phase 18 imports ─────────────────────────────────────────
import { CrossEventGuestBrowser } from './screens/guests/CrossEventGuestBrowser';
import { useRealtimeInvalidation } from './lib/useRealtimeInvalidation';
// ── Phase 19 imports ─────────────────────────────────────────
import { VendorDirectory } from "./screens/vendors/VendorDirectory";
import { UserProfile } from "./screens/system/UserProfile";
import { AuditLog } from "./screens/system/AuditLog";
const IntelligenceDashboard = React.lazy(() => import("./screens/system/IntelligenceDashboard").then(m => ({ default: m.IntelligenceDashboard })));
import { TodayView } from "./screens/dashboard/TodayView";
import { KeyboardShortcutsDialog } from "./ui/KeyboardShortcutsDialog";
import { DashboardScreen } from "./screens/dashboard/DashboardScreen";
import { AuthScreen } from "./screens/auth/AuthScreen";
import { NotFoundPage } from "./screens/NotFoundPage";
import { useSessionGuard } from "./lib/useSessionGuard";
import { setPermissionContext } from "./lib/usePermission";

export default function App() {
  const { path } = useRouter();

  // Public surfaces (no auth)
  // The component gallery is a development-only aid. import.meta.env.DEV is a
  // compile-time constant, so the lazy import + chunk are tree-shaken out of
  // production builds (and the route is unreachable in prod).
  if (import.meta.env.DEV && UiPreview && path === '/preview') {
    return <Suspense fallback={<div className="p-12 text-center">Loading preview...</div>}><UiPreview /></Suspense>;
  }
  const portal = matchPath('/portal/:eventId', path);
  if (portal) return <PublicGuestPortal eventId={portal.eventId} />;
  const vendorPortal = matchPath('/vendor/:vendorId', path);
  if (vendorPortal) return <VendorPortal vendorId={vendorPortal.vendorId} />;

  // Authenticated app
  return <ErrorBoundary><PlatformApp /></ErrorBoundary>;
}

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
  if (!user) return <AuthScreen onAuth={(u, m) => { setUser(u); setMemberships(m || []); }} />;

  return <AuthenticatedApp user={user} memberships={memberships} onLogout={() => {
    void sdk.auth.logout();
    queryClient.clear(); // Phase 37: clear all cached data on logout
    setUser(null);
  }} />;
}

function BootSplash() {
  return (
    <div className="min-h-screen bg-bg flex items-center justify-center">
      <div className="text-center space-y-3">
        <div className="font-display text-2xl text-brand-strong">Wedding Venue Intelligence</div>
        <div className="text-sm text-fg-muted">Loading…</div>
      </div>
    </div>
  );
}

function AuthenticatedApp({ user, memberships, onLogout }: { user: SdkUser; memberships: SdkMembership[]; onLogout: () => void }) {
  const { hash, navigate } = useRouter();
  const [orgConfig, setOrgConfig] = useState<PartialPlatformConfig | undefined>();
  const [userConfig, setUserConfig] = useState<PartialPlatformConfig | undefined>();
  const [orgId, setOrgId] = useState<string | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [createEventOpen, setCreateEventOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  // ── Phase 18: Real-time SSE → auto-invalidate React Query caches ──
  useRealtimeInvalidation(orgId);

  // ── Phase 30: Session expiry detection ──
  const { toast: sessionToast } = useToast();
  useSessionGuard(sessionToast as any, onLogout);

  // ── Phase 19: Set RBAC context for usePermission hooks ──
  useEffect(() => {
    setPermissionContext(orgId, memberships as any);
  }, [orgId, memberships]);

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

  // ⌘K / Ctrl-K / ⌘N / ⌘/
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

  const commandItems: CommandItem[] = [
    { id: 'nav.dashboard', label: 'Dashboard',           hint: 'Navigation', icon: <LayoutDashboard className="h-4 w-4" />, onSelect: () => navigate('/') },
    { id: 'nav.events',    label: 'Events',              hint: 'Navigation', icon: <List className="h-4 w-4" />,        onSelect: () => navigate('/events') },
    { id: 'nav.calendar',  label: 'Calendar',            hint: 'Navigation', icon: <Calendar className="h-4 w-4" />,        onSelect: () => navigate('/calendar') },
    { id: 'nav.guests',    label: 'Guests',              hint: 'Navigation', icon: <Users className="h-4 w-4" />,           onSelect: () => navigate('/guests') },
    { id: 'nav.system',    label: 'System',              hint: 'Navigation', icon: <Cog className="h-4 w-4" />,             onSelect: () => navigate('/system') },
    { id: 'nav.integrations',label: 'Integration Hub',   hint: 'Settings',   icon: <Link2 className="h-4 w-4" />,           onSelect: () => navigate('/system/integrations') },
    { id: 'nav.questions',   label: 'Event Questions',   hint: 'Settings',   icon: <HelpCircle className="h-4 w-4" />,      onSelect: () => navigate('/system/questions') },
    { id: 'nav.inventory',   label: 'Inventory Manager', hint: 'Operations', icon: <Package className="h-4 w-4" />,         onSelect: () => navigate('/system/inventory') },
    { id: 'nav.catalog',   label: 'Catalog Studio',      hint: 'Settings',   icon: <Layers className="h-4 w-4" />,          onSelect: () => navigate('/system/catalog') },
    { id: 'nav.venue',     label: 'Venue Builder',       hint: 'Settings',   icon: <Home className="h-4 w-4" />,          onSelect: () => navigate('/system/venue') },
    { id: 'nav.studio',    label: 'Platform Studio',     hint: 'Settings',   icon: <Palette className="h-4 w-4" />,         onSelect: () => navigate('/system/platform') },
    { id: 'nav.intelligence', label: 'Intelligence', hint: 'Analytics', icon: <BarChart className="h-4 w-4" />, onSelect: () => navigate('/intelligence') },
    { id: 'nav.audit',     label: 'Audit Log',           hint: 'System',    icon: <Cog className="h-4 w-4" />,             onSelect: () => navigate('/system/audit') },
    { id: 'nav.profile',   label: 'Account Settings',    hint: 'Account',   icon: <Users className="h-4 w-4" />,           onSelect: () => navigate('/settings/profile') },
    { id: 'act.create-event', label: 'Create New Event', hint: 'Action', keywords: ['new', 'create', 'add', 'event', 'wedding'], icon: <Plus className="h-4 w-4" />, onSelect: () => setCreateEventOpen(true) },
    { id: 'act.logout',    label: 'Sign out',            hint: 'Account',                                                   onSelect: onLogout },
    { id: 'nav.preview',   label: 'Open Design Preview', hint: 'Developer',  keywords: ['styleguide'],                       onSelect: () => navigate('/preview') },
  ];

  // ── Phase 31: Dynamic event search in command palette ──
  const eventsQuery = useQuery({
    queryKey: ["events", orgId],
    queryFn: () => orgId ? sdk.events.list(orgId) : Promise.resolve({ events: [] as any[], counts: { lead: 0, hold: 0, booked: 0, planning: 0, completed: 0, cancelled: 0, lost: 0 } }),
    enabled: !!orgId,
    staleTime: 30_000,
  });

  const dynamicItems: CommandItem[] = (eventsQuery.data?.events ?? []).map((e: { id: string; title: string; status: string; start_date: string | null; slug: string }) => ({
    id: `event.${e.id}`,
    label: e.title,
    hint: `${e.status} · ${e.start_date ?? "No date"}`,
    keywords: [e.status, e.slug, "event", "wedding"],
    icon: <Calendar className="h-4 w-4" />,
    onSelect: () => navigate(`/events/${e.id}`),
  }));

  // Phase 35: Also search vendors
  const vendorsQuery = useQuery({
    queryKey: ['vendors-palette', orgId],
    queryFn: () => orgId ? sdk.vendors.list(orgId) : Promise.resolve({ vendors: [] }),
    enabled: !!orgId,
    staleTime: 60_000,
  });

  const vendorItems: CommandItem[] = (vendorsQuery.data?.vendors ?? []).map((v: { id: string; name: string; category: string; contact_name: string | null }) => ({
    id: `vendor.${v.id}`,
    label: v.name,
    hint: `${v.category} · Vendor`,
    keywords: [v.category, 'vendor', v.contact_name ?? ''].filter(Boolean),
    icon: <Truck className="h-4 w-4" />,
    onSelect: () => navigate(`/vendors`),
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
        <Routes user={user} memberships={memberships} orgId={orgId} onOrgConfigChanged={setOrgConfig} />
      </AppShell>

      <ReloadPrompt />
      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        items={allCommandItems}
      />
      <WelcomeModal memberships={memberships} onComplete={() => {}} />
      <KeyboardShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
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

// ─── Route table ────────────────────────────────────────────
function Routes({
  user, memberships, orgId, onOrgConfigChanged,
}: {
  user: SdkUser;
  memberships: SdkMembership[];
  orgId: string | null;
  onOrgConfigChanged: (c: PartialPlatformConfig) => void;
}) {
  const { path } = useRouter();

  // Events: list + detail
  const runsheet = matchPath('/events/:eventId/run-sheet', path);
  if (runsheet) return <RunSheet eventId={runsheet.eventId} />;

  const checkin = matchPath('/events/:eventId/check-in', path);
  if (checkin) {
    if (!orgId) return <Loading />;
    return <Suspense fallback={<div className="p-12 text-center">Loading check-in...</div>}><VendorCheckInApp eventId={checkin.eventId} organizationId={orgId} /></Suspense>;
  }

  const detail = matchPath('/events/:eventId', path);
  if (detail) return <EventDetail eventId={detail.eventId} user={user} />;
  if (path === '/events') {
    if (!orgId) return <Loading />;
    return <EventsList orgId={orgId} />;
  }
  if (path === '/calendar') {
    if (!orgId) return <Loading />;
    return <GlobalCalendar orgId={orgId} />;
  }

  // System
  if (path === '/system/venue') {
    if (!orgId) return <Loading />;
    return (
      <>
        <PageHeader title="Venue Builder" description="Draw your venue's structural floorplan boundaries." />
        <PageBody><Suspense fallback={<div className="p-12 text-center text-fg-muted">Loading venue builder...</div>}><VenueBuilder orgId={orgId} /></Suspense></PageBody>
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
  if (path === '/reports') {
    if (!orgId) return <Loading />;
    return <Suspense fallback={<div className="p-12 text-center text-fg-muted">Loading analytics...</div>}><AnalyticsDashboard orgId={orgId} /></Suspense>;
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
  if (path === '/system') {
    if (!orgId) return <Loading />;
    return <AdminPanel orgId={orgId} />;
  }

  // ── Phase 19: Vendor directory ──
  // ── Phase 27: User profile/settings ──
  if (path === "/intelligence") {
    if (!orgId) return <Loading />;
    return <Suspense fallback={<div className="p-12 text-center">Loading intelligence...</div>}><IntelligenceDashboard orgId={orgId} /></Suspense>;
  }

  if (path === "/system/audit") {
    if (!orgId) return <Loading />;
    return <AuditLog orgId={orgId} />;
  }

  if (path === "/settings/profile") {
    return <UserProfile user={user} />;
  }

  if (path === "/vendors") {
    if (!orgId) return <Loading />;
    return <VendorDirectory orgId={orgId} />;
  }

  // ── Phase 18: Cross-event guest browser (replaces placeholder) ──
  if (path === '/guests') {
    if (!orgId) return <Loading />;
    return <CrossEventGuestBrowser orgId={orgId} />;
  }

  // Default = dashboard for root path, 404 for unknown paths
  if (path === '/' || path === '') {
    return <DashboardScreen user={user} orgId={orgId} />;
  }

  // Unknown route → 404
  return <NotFoundPage />;
}

function Loading() {
  return (
    <PageBody>
      <div className="text-fg-muted text-sm py-10 text-center">Loading…</div>
    </PageBody>
  );
}

// ─── Dashboard ──────────────────────────────────────────────

