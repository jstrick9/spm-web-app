/**
 * AppShell — the persistent layout for every authenticated screen.
 *
 *   <AppShell user={currentUser} onLogout={…}>
 *     <Outlet />   // page content
 *   </AppShell>
 *
 * Composition:
 *   ┌──────────────────────────────────────────────────────────┐
 *   │ TopBar (logo, breadcrumb, search-trigger, user menu)     │
 *   ├──────────┬───────────────────────────────────────────────┤
 *   │ Sidebar  │  Main content                                  │
 *   │ (nav)    │                                                │
 *   │          │                                                │
 *   └──────────┴───────────────────────────────────────────────┘
 *
 * Responsive:
 *   - desktop (md and up): sidebar is a fixed rail on the left
 *   - mobile (under md): sidebar collapses to a slide-over drawer triggered by hamburger
 *
 * Config-aware:
 *   - reads useNavItems() for sidebar contents
 *   - reads useBranding() for platform name + logo in TopBar
 *   - reads useFeatureEnabled(id) to hide whole sections
 */
import { useEffect, useState, type ReactNode } from 'react';
import {
  Calendar, ChevronLeft, Command, Cog, FileBarChart,
  Home, Keyboard, LayoutDashboard, LogOut, Menu, Search, Settings, Truck, UserCircle, Users, X,
} from 'lucide-react';
import {
  useBranding, useFeatureEnabled, useNavItems,
} from '../config/ConfigProvider';
import { Button } from './Button';
import { ThemeToggle } from './ThemeToggle';
import { NotificationCenter } from '../components/notifications/NotificationCenter';
import { cn } from './lib/cn';
import type { SdkUser } from '../sdk/types';

// Map of nav item id → icon + default label. Admins can override the label
// in the nav config; the id is stable.
const NAV_ITEM_META: Record<string, { icon: typeof Home; label: string; href: string; featureFlag?: string }> = {
  dashboard: { icon: LayoutDashboard, label: 'Dashboard',  href: '#/' },
  events:    { icon: Calendar,        label: 'Events',     href: '#/events' },
  guests:    { icon: Users,           label: 'Guests',     href: '#/guests' },
  vendors:   { icon: Truck,           label: 'Vendors',    href: '#/vendors' },
  calendar:  { icon: Calendar,        label: 'Calendar',   href: '#/calendar' },
  reports:   { icon: FileBarChart,    label: 'Reports',    href: '#/reports', featureFlag: 'reports' },
  system:    { icon: Cog,             label: 'System',     href: '#/system' },
};

export interface AppShellProps {
  user: SdkUser;
  currentPath?: string;             // hash like '#/' or '#/events'
  onLogout: () => void;
  onOpenCommandPalette?: () => void;
  children: ReactNode;
}

export function AppShell({ user, currentPath = '', onLogout, onOpenCommandPalette, children }: AppShellProps) {
  const branding = useBranding();
  const navItems = useNavItems();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close drawer when nav changes
  useEffect(() => { setMobileOpen(false); }, [currentPath]);

  return (
    <div className="min-h-screen bg-bg text-fg print:min-h-0 print:bg-white print:text-black">
      {/* TopBar */}
      {/* Accessibility: skip to main content */}
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:bg-brand focus:text-on-brand focus:px-4 focus:py-2 focus:rounded-md focus:text-sm focus:font-medium">
        Skip to content
      </a>
      <header className="sticky top-0 z-30 border-b border-border bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/80 print:hidden">
        <div className="flex h-14 items-center gap-3 px-4 sm:px-6">
          {/* Hamburger (mobile only) */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation"
          >
            <Menu className="h-5 w-5" />
          </Button>

          {/* Brand */}
          <a href="#/" className="flex items-center gap-2 font-display text-lg font-medium tracking-tight">
            {branding.logoUrl && (
              <img src={branding.logoUrl} alt="" className="h-7 w-7 rounded-md object-cover" />
            )}
            <span className="hidden sm:inline">{branding.platformName}</span>
          </a>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Command-K search trigger */}
          {onOpenCommandPalette && (
            <Button
              variant="outline"
              size="sm"
              className="hidden md:inline-flex gap-2 text-fg-muted"
              onClick={onOpenCommandPalette}
            >
              <Search className="h-4 w-4" />
              <span>Search…</span>
              <kbd className="ml-2 inline-flex items-center gap-0.5 rounded border border-border bg-surface-2 px-1.5 text-[10px] font-mono text-fg-subtle">
                <Command className="h-2.5 w-2.5" />K
              </kbd>
            </Button>
          )}

          <ThemeToggle />
          <NotificationCenter />

          {/* User menu with profile dropdown */}
          <UserMenu user={user} onLogout={onLogout} />
        </div>
      </header>

      <div className="flex">
        {/* Sidebar (desktop) */}
        <Sidebar
          navItems={navItems}
          currentPath={currentPath}
          className="hidden md:flex print:hidden"
        />

        {/* Sidebar (mobile drawer) */}
        {mobileOpen && (
          <div
            className="fixed inset-0 z-40 md:hidden"
            onClick={() => setMobileOpen(false)}
            role="dialog"
            aria-modal="true"
          >
            <div className="absolute inset-0 bg-black/40" />
            <div
              className="relative h-full w-64 max-w-[80%] bg-surface shadow-elev-2"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex h-14 items-center justify-between border-b border-border px-4">
                <span className="font-display text-base">{branding.platformName}</span>
                <Button variant="ghost" size="icon" onClick={() => setMobileOpen(false)} aria-label="Close">
                  <X className="h-5 w-5" />
                </Button>
              </div>
              <Sidebar
                navItems={navItems}
                currentPath={currentPath}
                className="flex w-full border-r-0"
              />
            </div>
          </div>
        )}

        {/* Main content */}
        <main id="main-content" className="flex-1 min-w-0 print:m-0 print:p-0">
          {children}
        </main>
      </div>
    </div>
  );
}

// ─── Sidebar ─────────────────────────────────────────────
function Sidebar({
  navItems,
  currentPath,
  className,
}: {
  navItems: Array<{ id: string; hidden?: boolean; label?: string }>;
  currentPath: string;
  className?: string;
}) {
  return (
    <nav
      aria-label="Primary"
      className={cn(
        'sticky top-14 h-[calc(100vh-3.5rem)] w-56 shrink-0 flex-col gap-1 border-r border-border bg-surface px-2 py-4',
        className,
      )}
    >
      {navItems
        .filter((n) => !n.hidden && NAV_ITEM_META[n.id])
        .map((n) => (
          <NavLinkItem
            key={n.id}
            id={n.id}
            label={n.label}
            currentPath={currentPath}
          />
        ))}

      <div className="mt-auto pt-4">
        <a
          href="#/system/platform"
          className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-fg-muted hover:bg-surface-2 hover:text-fg"
        >
          <Cog className="h-4 w-4" />
          Platform Studio
        </a>
      </div>
    </nav>
  );
}

function NavLinkItem({ id, label, currentPath }: { id: string; label?: string; currentPath: string }) {
  const meta = NAV_ITEM_META[id]!;
  const Icon = meta.icon;
  const isActive = currentPath === meta.href
                || (meta.href !== '#/' && currentPath.startsWith(meta.href));
  const enabled = useFeatureEnabled(meta.featureFlag ?? id);
  if (!enabled) return null;

  return (
    <a
      href={meta.href}
      aria-current={isActive ? 'page' : undefined}
      className={cn(
        'group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
        isActive
          ? 'bg-brand-soft text-brand-strong'
          : 'text-fg-muted hover:bg-surface-2 hover:text-fg',
      )}
    >
      <Icon className={cn('h-4 w-4', isActive ? 'text-brand' : 'text-fg-subtle group-hover:text-fg-muted')} />
      {label ?? meta.label}
    </a>
  );
}

/** PageHeader — used inside the AppShell's main column at the top of every page. */
export function PageHeader({
  title,
  description,
  actions,
  back,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  back?: { label: string; href: string };
}) {
  return (
    <div className="border-b border-border bg-surface print:hidden">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-5">
        {back && (
          <a
            href={back.href}
            className="mb-2 inline-flex items-center gap-1 text-xs text-fg-muted hover:text-fg"
          >
            <ChevronLeft className="h-3 w-3" />
            {back.label}
          </a>
        )}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            {description && (
              <p className="mt-1 text-sm text-fg-muted">{description}</p>
            )}
          </div>
          {actions && <div className="shrink-0 flex items-center gap-2">{actions}</div>}
        </div>
      </div>
    </div>
  );
}

/** PageBody — standard padded container for page content. */
export function PageBody({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('mx-auto max-w-7xl px-4 sm:px-6 py-6 print:m-0 print:p-0 print:max-w-none', className)}>
      {children}
    </div>
  );
}

/** UserMenu — dropdown with profile link, role info, and sign-out. */
function UserMenu({ user, onLogout }: { user: SdkUser; onLogout: () => void }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-surface-2 transition-colors"
        aria-label="User menu"
      >
        <UserCircle className="h-6 w-6 text-fg-muted" />
        <span className="hidden sm:inline text-sm text-fg-muted max-w-[160px] truncate">
          {user.fullName || user.email.split('@')[0]}
        </span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-50 w-56 rounded-lg border border-border bg-surface shadow-elev-2 py-1 overflow-hidden">
            {/* User info header */}
            <div className="px-4 py-3 border-b border-border">
              <p className="text-sm font-medium text-fg truncate">{user.fullName || user.email}</p>
              <p className="text-xs text-fg-muted truncate">{user.email}</p>
            </div>

            {/* Menu items */}
            <a
              href="#/settings/profile"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 px-4 py-2.5 text-sm text-fg-muted hover:bg-surface-2 hover:text-fg transition-colors"
            >
              <Settings className="h-4 w-4" /> Account Settings
            </a>
            <a
              href="#"
              onClick={(e) => { e.preventDefault(); setOpen(false); window.dispatchEvent(new CustomEvent("wvi:open-shortcuts")); }}
              className="flex items-center gap-2 px-4 py-2.5 text-sm text-fg-muted hover:bg-surface-2 hover:text-fg transition-colors"
            >
              <Keyboard className="h-4 w-4" /> Keyboard Shortcuts
            </a>

            <button
              onClick={() => { setOpen(false); onLogout(); }}
              className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-fg-muted hover:bg-surface-2 hover:text-danger transition-colors border-t border-border"
            >
              <LogOut className="h-4 w-4" /> Sign Out
            </button>
          </div>
        </>
      )}
    </div>
  );
}
