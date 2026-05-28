import { WelcomeModal } from './components/onboarding/WelcomeModal';
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
 *        /guests           → Cross-event guest browser (placeholder; Day 2 builds)
 *        /system           → System (sync control panel)
 *        /system/platform  → Platform Studio (theme presets)
 *        /preview          → Design system styleguide (dev)
 *   3. Public Guest Portal (no auth) — /portal/:eventId
 */
import {
  Calendar, Cog, Home, LayoutDashboard, Palette, Users,
} from 'lucide-react';
import { useEffect, useState, type CSSProperties } from 'react';
import { ApiError, getToken, sdk, setToken } from './sdk';
import type { SdkUser, SdkMembership } from './sdk/types';
import { AppShell, PageBody, PageHeader } from './ui/AppShell';
import { Button } from './ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { CommandPalette, type CommandItem } from './ui/CommandPalette';
import { EmptyState } from './ui/EmptyState';
import { Input } from './ui/Input';
import { Label } from './ui/Label';
import { useToast } from './ui/Toast';
import { ConfigProvider } from './config/ConfigProvider';
import { ReloadPrompt } from './ReloadPrompt';
import { UiPreview } from './ui/preview/UiPreview';
import { ControlPanel } from './components/ControlPanel';
import { AdminPanel } from './screens/system/admin/AdminPanel';
import { WidgetSlot } from './config/widgets/WidgetSlot';
import { PlatformStudio } from './screens/PlatformStudio';
import { CatalogScreen } from './screens/catalog/CatalogScreen';
import { VenueBuilder } from './screens/catalog/venue/VenueBuilder';
import { IntegrationHub } from './screens/system/IntegrationHub';
import { EventQuestionsStudio } from './screens/system/questions/EventQuestionsStudio';
import { HelpCircle, Package } from 'lucide-react';
import { InventoryManager } from './screens/system/inventory/InventoryManager';
import { AnalyticsDashboard } from './screens/system/AnalyticsDashboard';
import { Link2 } from 'lucide-react';
import { GlobalCalendar } from './screens/calendar/GlobalCalendar';
import { VendorCheckInApp } from './screens/checkin/VendorCheckInApp';
import { MapPin } from 'lucide-react';
import { Layers } from 'lucide-react';
import { EventsList } from './screens/events/EventsList';
import { List } from 'lucide-react';
import { EventDetail } from './screens/events/EventDetail';
import { RunSheet } from './screens/events/runsheet/RunSheet';
import { VendorPortal } from './screens/VendorPortal';
import { PublicGuestPortal } from './screens/portal/PublicGuestPortal';
import { matchPath, useRouter } from './lib/router';
import type { PartialPlatformConfig } from './config/schema';

export default function App() {
  const { path } = useRouter();

  // Public surfaces (no auth)
  if (path === '/preview') return <UiPreview />;
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

  // ⌘K / Ctrl-K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
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
    { id: 'act.logout',    label: 'Sign out',            hint: 'Account',                                                   onSelect: onLogout },
    { id: 'nav.preview',   label: 'Open Design Preview', hint: 'Developer',  keywords: ['styleguide'],                       onSelect: () => navigate('/preview') },
  ];

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
        items={commandItems}
      />
      <WelcomeModal memberships={memberships} onComplete={() => {}} />
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
    return <VendorCheckInApp eventId={checkin.eventId} organizationId={orgId} />;
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
        <PageBody><VenueBuilder orgId={orgId} /></PageBody>
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
    return <AnalyticsDashboard orgId={orgId} />;
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

  if (path === '/guests') {
    return (
      <>
        <PageHeader title="Guests" description="Browse guests across every event in your organization." />
        <PageBody>
          <Card>
            <CardContent className="py-10 text-center text-sm text-fg-muted">
              <p>The cross-event guest browser arrives in Week 1 Day 2.</p>
              <p className="mt-2">
                For now, drill into a specific event from the
                {' '}<a className="text-brand underline" href="#/events">Events list</a>{' '}
                to manage its guests.
              </p>
            </CardContent>
          </Card>
        </PageBody>
      </>
    );
  }

  // Default = dashboard
  return <DashboardScreen user={user} orgId={orgId} />;
}

function Loading() {
  return (
    <PageBody>
      <div className="text-fg-muted text-sm py-10 text-center">Loading…</div>
    </PageBody>
  );
}

// ─── Dashboard ──────────────────────────────────────────────
function DashboardScreen({ user, orgId }: { user: SdkUser; orgId: string | null }) {
  return (
    <>
      <PageHeader
        title={<>Welcome back, <span className="font-display">{user.fullName ?? user.email.split('@')[0]}</span></>}
        description="A snapshot of your venue's performance."
      />
      <PageBody>
        {orgId ? (
          <WidgetSlot id="venue.dashboard.kpis" orgId={orgId} />
        ) : (
          <EmptyState
            icon={<Home className="h-5 w-5" />}
            title="No organization yet"
            description="Sign in as a venue owner to see your dashboard."
          />
        )}

        <div className="mt-8">
          <Card>
            <CardHeader>
              <CardTitle>Getting started</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="text-fg-muted">
                Browse the <a className="text-brand underline" href="#/events">Events</a> tab — kanban + table views, search, filters, and a proper create flow.
              </p>
              <p className="text-fg-muted">
                Open <a className="text-brand underline" href="#/system/platform">Platform Studio</a> to re-skin the entire app from a curated preset, or set up your layout inventory in the <a className="text-brand underline" href="#/system/catalog">Catalog Studio</a>.
              </p>
              <p className="text-fg-subtle">
                Press <kbd className="rounded border border-border bg-surface-2 px-1 text-[10px]">⌘K</kbd> for quick navigation.
              </p>
            </CardContent>
          </Card>
        </div>
      </PageBody>
    </>
  );
}

// ─── Login / Register ───────────────────────────────────────
function AuthScreen({ onAuth }: { onAuth: (u: SdkUser, m?: SdkMembership[]) => void }) {
  const { toast } = useToast();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('owner@demo.local');
  const [password, setPassword] = useState('wedding123');
  const [fullName, setFullName] = useState('');
  const [orgName, setOrgName] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = mode === 'login'
        ? await sdk.auth.login(email, password)
        : await sdk.auth.register({ email, password, fullName, orgName });
      // In auth screen, we need to fetch memberships after login
      const me = await sdk.auth.me();
      onAuth(me.user, me.memberships);
    } catch (err) {
      const e = err as ApiError;
      toast({
        title: 'Sign-in failed',
        description:
          e.code === 'invalid-credentials' ? 'Email or password is incorrect.' :
          e.code === 'email-already-registered' ? 'That email is already registered.' :
          e.kind === 'offline' ? 'Server unreachable. Check your connection.' :
          e.message,
        variant: 'destructive',
      });
    } finally { setBusy(false); }
  }

  return (
    <div className="min-h-screen bg-hero-editorial flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="font-display text-3xl">Wedding Venue Intelligence</CardTitle>
          <p className="text-sm text-fg-muted">
            Self-hosted backend. Configurable everything.
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-4">
            <Button variant={mode === 'login' ? 'default' : 'secondary'} onClick={() => setMode('login')}>Log in</Button>
            <Button variant={mode === 'register' ? 'default' : 'secondary'} onClick={() => setMode('register')}>Create account</Button>
          </div>
          <form onSubmit={submit} className="space-y-3">
            {mode === 'register' && (
              <>
                <div>
                  <Label htmlFor="fn">Your name</Label>
                  <Input id="fn" value={fullName} onChange={(e) => setFullName(e.target.value)} required className="mt-1.5" />
                </div>
                <div>
                  <Label htmlFor="on">Venue / organization name</Label>
                  <Input id="on" value={orgName} onChange={(e) => setOrgName(e.target.value)} required className="mt-1.5" />
                </div>
              </>
            )}
            <div>
              <Label htmlFor="em">Email</Label>
              <Input id="em" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor="pw">Password</Label>
              <Input id="pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} className="mt-1.5" />
            </div>
            <Button type="submit" className="w-full" isLoading={busy}>
              {mode === 'login' ? 'Sign in' : 'Create account'}
            </Button>
          </form>
          <p className="text-xs text-fg-subtle mt-4">
            Demo seed: <code>owner@demo.local</code> / <code>wedding123</code>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}


