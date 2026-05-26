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
import type { SdkUser } from './sdk/types';
import { AppShell, PageBody, PageHeader } from './ui/AppShell';
import { Button } from './ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { CommandPalette, type CommandItem } from './ui/CommandPalette';
import { EmptyState } from './ui/EmptyState';
import { Input } from './ui/Input';
import { Label } from './ui/Label';
import { useToast } from './ui/Toast';
import { ConfigProvider } from './config/ConfigProvider';
import { UiPreview } from './ui/preview/UiPreview';
import { ControlPanel } from './components/ControlPanel';
import { WidgetSlot } from './config/widgets/WidgetSlot';
import { PlatformStudio } from './screens/PlatformStudio';
import { EventsList } from './screens/events/EventsList';
import { EventDetail } from './screens/events/EventDetail';
import { matchPath, useRouter } from './lib/router';
import type { PartialPlatformConfig } from './config/schema';

export default function App() {
  const { path } = useRouter();

  // Public surfaces (no auth)
  if (path === '/preview') return <UiPreview />;
  const portal = matchPath('/portal/:eventId', path);
  if (portal) return <GuestPortal eventId={portal.eventId} />;

  // Authenticated app
  return <PlatformApp />;
}

function PlatformApp() {
  const [user, setUser] = useState<SdkUser | null>(null);
  const [bootstrapped, setBootstrapped] = useState(false);

  useEffect(() => {
    (async () => {
      if (!getToken()) { setBootstrapped(true); return; }
      try {
        const me = await sdk.auth.me();
        setUser(me.user);
      } catch {
        setToken(null);
      } finally {
        setBootstrapped(true);
      }
    })();
  }, []);

  if (!bootstrapped) return <BootSplash />;
  if (!user) return <AuthScreen onAuth={setUser} />;

  return <AuthenticatedApp user={user} onLogout={() => {
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

function AuthenticatedApp({ user, onLogout }: { user: SdkUser; onLogout: () => void }) {
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
    { id: 'nav.events',    label: 'Events',              hint: 'Navigation', icon: <Calendar className="h-4 w-4" />,        onSelect: () => navigate('/events') },
    { id: 'nav.guests',    label: 'Guests',              hint: 'Navigation', icon: <Users className="h-4 w-4" />,           onSelect: () => navigate('/guests') },
    { id: 'nav.system',    label: 'System',              hint: 'Navigation', icon: <Cog className="h-4 w-4" />,             onSelect: () => navigate('/system') },
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
        <Routes user={user} orgId={orgId} onOrgConfigChanged={setOrgConfig} />
      </AppShell>

      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        items={commandItems}
      />
    </ConfigProvider>
  );
}

// ─── Route table ────────────────────────────────────────────
function Routes({
  user, orgId, onOrgConfigChanged,
}: {
  user: SdkUser;
  orgId: string | null;
  onOrgConfigChanged: (c: PartialPlatformConfig) => void;
}) {
  const { path } = useRouter();

  // Events: list + detail
  const detail = matchPath('/events/:eventId', path);
  if (detail) return <EventDetail eventId={detail.eventId} />;
  if (path === '/events') {
    if (!orgId) return <Loading />;
    return <EventsList orgId={orgId} />;
  }

  // System
  if (path === '/system/platform') {
    if (!orgId) return <Loading />;
    return <PlatformStudio orgId={orgId} onSaved={onOrgConfigChanged} />;
  }
  if (path === '/system') {
    return (
      <>
        <PageHeader title="System" description="Diagnostics, sync, and feature flags for the dual-write layer." />
        <PageBody>
          <Card><CardContent className="pt-6"><ControlPanel /></CardContent></Card>
        </PageBody>
      </>
    );
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
                Open <a className="text-brand underline" href="#/system/platform">Platform Studio</a> to re-skin the entire app from a curated preset.
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
function AuthScreen({ onAuth }: { onAuth: (u: SdkUser) => void }) {
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
      onAuth(res.user);
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

// ─── Public Guest Portal (unchanged from Phase 2 — Day 4 rebuilds) ────
function GuestPortal({ eventId }: { eventId: string }) {
  const [info, setInfo] = useState<{ title: string; startDate: string | null } | null>(null);
  const [guests, setGuests] = useState<Array<{ id: string; fullName: string }>>([]);
  const [selectedGuestId, setSelectedGuestId] = useState('');
  const [attending, setAttending] = useState(true);
  const [mealChoice, setMealChoice] = useState('standard');
  const [notes, setNotes] = useState('');
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    sdk.portal.info(eventId)
      .then((r) => { setInfo({ title: r.event.title, startDate: r.event.startDate }); setGuests(r.guests); })
      .catch(() => setError('Event not found.'));
  }, [eventId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!selectedGuestId) { setError('Please pick your name.'); return; }
    try {
      await sdk.portal.submitRsvp(eventId, { guestId: selectedGuestId, attending, mealChoice, notes: notes || undefined });
      setDone(true);
    } catch (err) {
      setError((err as ApiError).message);
    }
  }

  if (error && !info) return <Card className="max-w-md mx-auto mt-20"><CardContent className="pt-6 text-danger">{error}</CardContent></Card>;
  if (!info) return <BootSplash />;
  if (done) return (
    <div className="min-h-screen bg-hero-editorial flex items-center justify-center p-4">
      <Card className="max-w-md text-center">
        <CardContent className="pt-10 pb-8">
          <div className="text-6xl mb-4">💌</div>
          <h2 className="font-display text-2xl">Thank you</h2>
          <p className="mt-2 text-fg-muted">Your RSVP for {info.title} has been received.</p>
        </CardContent>
      </Card>
    </div>
  );

  const inputStyle: CSSProperties = { width: '100%' };
  return (
    <div className="min-h-screen bg-hero-editorial p-4">
      <Card className="max-w-md mx-auto mt-12">
        <CardHeader>
          <CardTitle className="font-display text-3xl">{info.title}</CardTitle>
          <p className="text-sm text-fg-muted">{info.startDate ? `On ${info.startDate}.` : ''} Please RSVP below.</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <Label htmlFor="gn">Your name</Label>
              <select id="gn" required value={selectedGuestId} onChange={(e) => setSelectedGuestId(e.target.value)} className="mt-1.5 w-full h-10 px-3 rounded-md border border-border bg-surface">
                <option value="">— pick your name —</option>
                {guests.map((g) => <option key={g.id} value={g.id}>{g.fullName}</option>)}
              </select>
            </div>
            <div>
              <Label>Will you attend?</Label>
              <div className="flex gap-2 mt-1.5">
                <Button type="button" variant={attending ? 'default' : 'secondary'} onClick={() => setAttending(true)}>Yes</Button>
                <Button type="button" variant={!attending ? 'default' : 'secondary'} onClick={() => setAttending(false)}>No</Button>
              </div>
            </div>
            {attending && (
              <div>
                <Label htmlFor="meal">Meal preference</Label>
                <select id="meal" value={mealChoice} onChange={(e) => setMealChoice(e.target.value)} className="mt-1.5 w-full h-10 px-3 rounded-md border border-border bg-surface">
                  <option value="standard">Standard</option>
                  <option value="vegetarian">Vegetarian</option>
                  <option value="vegan">Vegan</option>
                  <option value="gluten-free">Gluten-free</option>
                </select>
              </div>
            )}
            <div>
              <Label htmlFor="notes">Notes</Label>
              <textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1.5 w-full min-h-[80px] p-3 rounded-md border border-border bg-surface text-sm" style={inputStyle} />
            </div>
            {error && <p className="text-sm text-danger">{error}</p>}
            <Button type="submit" className="w-full">Submit RSVP</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
