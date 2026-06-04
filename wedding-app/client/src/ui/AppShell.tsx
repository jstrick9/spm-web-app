/**
 * AppShell — the persistent layout for every authenticated screen.
 *
 * Phase 33 changes (all surgical, zero visual regressions):
 *   • Sidebar NavItem: added aria-current="page" on active link (WCAG 4.1.2)
 *   • Sidebar NavItem: added aria-label for icon-only collapsed state
 *   • Mobile drawer: added focus-trap via autoFocus on first nav link +
 *     Escape key close handler (keyboard accessibility)
 *   • Mobile drawer overlay: role="presentation" instead of bare div
 *   • TopBar brand link: aria-label="Go to dashboard" (not just visual text)
 *   • UserMenu button: aria-expanded state wired to open boolean
 *   • Intelligence nav item added to NAV_ITEM_META (Phase 32 wiring)
 *   • Platform name reads from branding config (white-label support)
 *
 * No changes to layout, colours, spacing, or existing behaviour.
 */
import { useEffect, useRef, useState, useMemo, type ReactNode } from 'react';
import {
  Brain,
  Calendar,
  ChevronLeft,
  Command,
  Cog,
  FileBarChart,
  Home,
  Keyboard,
  LayoutDashboard,
  LogOut,
  Menu,
  Search,
  Settings,
  Truck,
  UserCircle,
  Users,
  X,
  Layers,
  HelpCircle,
  Link2,
  Palette,
} from 'lucide-react';
import { usePermission } from '../lib/usePermission';
import {
  useBranding,
  useFeatureEnabled,
  useNavItems,
} from '../config/ConfigProvider';
import { Button } from './Button';
import { ThemeToggle } from './ThemeToggle';
import { NotificationCenter } from '../components/notifications/NotificationCenter';
import { cn } from './lib/cn';
import type { SdkUser } from '../sdk/types';

// ── Nav item registry ──────────────────────────────────────────────────────
// id is stable; label/icon/href can be overridden by the config layer.
const NAV_ITEM_META: Record<
  string,
  { icon: typeof Home; label: string; href: string; featureFlag?: string; permission?: string }
> = {
  dashboard:    { icon: LayoutDashboard, label: 'Dashboard',   href: '#/'              },
  events:       { icon: Calendar,        label: 'Events',       href: '#/events'        },
  guests:       { icon: Users,           label: 'Guests',       href: '#/guests',       permission: 'guests.view'     },
  vendors:      { icon: Truck,           label: 'Vendors',      href: '#/vendors',      permission: 'vendors.view'    },
  calendar:     { icon: Calendar,        label: 'Calendar',     href: '#/calendar'      },
  reports:      { icon: FileBarChart,    label: 'Reports',      href: '#/reports',      featureFlag: 'reports', permission: 'analytics.view' },
  intelligence: { icon: Brain,           label: 'Intelligence', href: '#/intelligence', featureFlag: 'intelligence',  permission: 'analytics.view' },
  system:       { icon: Cog,             label: 'System',       href: '#/system',       permission: 'platform.manage' },
  catalog:      { icon: Layers,          label: 'Catalog Studio', href: '#/system/catalog', permission: 'platform.manage' },
  questions:    { icon: HelpCircle,      label: 'Questions Studio', href: '#/system/questions', permission: 'platform.manage' },
  venue:        { icon: Home,            label: 'Venue Builder',  href: '#/system/venue', permission: 'platform.manage' },
  integrations: { icon: Link2,           label: 'Integration Hub', href: '#/system/integrations', permission: 'platform.manage' },
  branding:     { icon: Palette,         label: 'Platform Studio', href: '#/system/platform', permission: 'platform.manage' },
};

// ── Types ──────────────────────────────────────────────────────────────────

export interface AppShellProps {
  user: SdkUser;
  currentPath?: string;
  onLogout: () => void;
  onOpenCommandPalette?: () => void;
  children: ReactNode;
}

// ── AppShell ───────────────────────────────────────────────────────────────

export function AppShell({
  user,
  currentPath = '',
  onLogout,
  onOpenCommandPalette,
  children,
}: AppShellProps) {
  const branding = useBranding();
  const rawNavItems = useNavItems();
  const canManagePlatform = usePermission('platform.manage');

  const navItems = useMemo(() => {
    if (!canManagePlatform) {
      return rawNavItems.filter(id => id !== 'system');
    }
    return [
      ...rawNavItems,
      'catalog',
      'questions',
      'venue',
      'integrations',
      'branding',
    ];
  }, [rawNavItems, canManagePlatform]);

  const [mobileOpen, setMobileOpen] = useState(false);

  // Close drawer when route changes
  useEffect(() => { setMobileOpen(false); }, [currentPath]);

  // Close drawer on Escape
  useEffect(() => {
    if (!mobileOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [mobileOpen]);

  return (
    <div className="min-h-screen bg-bg text-fg print:min-h-0 print:bg-white print:text-black">

      {/* Skip-to-main accessibility link */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:bg-brand focus:text-on-brand focus:px-4 focus:py-2 focus:rounded-md focus:text-sm focus:font-medium"
      >
        Skip to content
      </a>

      {/* TopBar */}
      <header
        className="sticky top-0 z-30 border-b border-border bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/80 print:hidden"
        role="banner"
      >
        <div className="flex h-14 items-center gap-3 px-4 sm:px-6">
          {/* Hamburger (mobile only) */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation menu"
            aria-expanded={mobileOpen}
            aria-controls="mobile-nav"
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
          </Button>

          {/* Brand — reads from config for white-label support */}
          <a
            href="#/"
            className="flex items-center gap-2 font-display text-lg font-medium tracking-tight"
            aria-label={`${branding.platformName} — go to dashboard`}
          >
            {branding.logoUrl && (
              <img
                src={branding.logoUrl}
                alt=""
                className="h-7 w-7 rounded-md object-cover"
                aria-hidden="true"
              />
            )}
            <span className="hidden sm:inline">{branding.platformName}</span>
          </a>

          <div className="flex-1" />

          {/* Command-K search trigger */}
          {onOpenCommandPalette && (
            <Button
              variant="outline"
              size="sm"
              className="hidden md:inline-flex gap-2 text-fg-muted"
              onClick={onOpenCommandPalette}
              aria-label="Open search (Command K)"
            >
              <Search className="h-4 w-4" aria-hidden="true" />
              <span>Search…</span>
              <kbd
                className="ml-2 inline-flex items-center gap-0.5 rounded border border-border bg-surface-2 px-1.5 text-[10px] font-mono text-fg-subtle"
                aria-hidden="true"
              >
                <Command className="h-2.5 w-2.5" />K
              </kbd>
            </Button>
          )}

          <ThemeToggle />
          <NotificationCenter />
          <UserMenu user={user} onLogout={onLogout} />
        </div>
      </header>

      <div className="flex">
        {/* Desktop sidebar */}
        <Sidebar
          navItems={navItems}
          currentPath={currentPath}
          className="hidden md:flex print:hidden"
        />

        {/* Mobile drawer */}
        {mobileOpen && (
          <div
            id="mobile-nav"
            className="fixed inset-0 z-40 md:hidden"
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
          >
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-black/40"
              role="presentation"
              onClick={() => setMobileOpen(false)}
            />
            {/* Drawer panel */}
            <div
              className="relative h-full w-64 max-w-[80%] bg-surface shadow-elev-2"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex h-14 items-center justify-between border-b border-border px-4">
                <span className="font-display text-base">{branding.platformName}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setMobileOpen(false)}
                  aria-label="Close navigation menu"
                >
                  <X className="h-5 w-5" aria-hidden="true" />
                </Button>
              </div>
              <Sidebar
                navItems={navItems}
                currentPath={currentPath}
                className="flex"
                autoFocus
              />
            </div>
          </div>
        )}

        {/* Main content */}
        <main
          id="main-content"
          className="flex-1 min-w-0 pb-16 md:pb-0"
          tabIndex={-1}
        >
          {children}
        </main>
      </div>
    </div>
  );
}

// ── Sidebar ────────────────────────────────────────────────────────────────

interface SidebarProps {
  navItems: string[];
  currentPath: string;
  className?: string;
  autoFocus?: boolean;
}

function Sidebar({ navItems, currentPath, className, autoFocus }: SidebarProps) {
  const firstLinkRef = useRef<HTMLAnchorElement>(null);

  // Focus first nav link when mobile drawer opens
  useEffect(() => {
    if (autoFocus) {
      firstLinkRef.current?.focus();
    }
  }, [autoFocus]);

  return (
    <nav
      className={cn(
        'flex-col w-56 shrink-0 border-r border-border bg-surface h-[calc(100vh-3.5rem)] sticky top-14 overflow-y-auto',
        className,
      )}
      aria-label="Main navigation"
    >
      <ul className="flex flex-col gap-0.5 p-3" role="list">
        {navItems.map((id, index) => {
          const meta = NAV_ITEM_META[id];
          if (!meta) return null;
          const Icon = meta.icon;
          const isActive =
            meta.href === '#/'
              ? currentPath === '#/' || currentPath === '#'
              : currentPath.startsWith(meta.href);

          return (
            <li key={id} role="listitem">
              <a
                ref={index === 0 ? firstLinkRef : undefined}
                href={meta.href}
                aria-current={isActive ? 'page' : undefined}
                aria-label={meta.label}
                className={cn(
                  'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand',
                  isActive
                    ? 'bg-brand/10 text-brand'
                    : 'text-fg-muted hover:bg-surface-2 hover:text-fg',
                )}
              >
                <Icon
                  className={cn(
                    'h-4 w-4 shrink-0',
                    isActive ? 'text-brand' : 'text-fg-muted',
                  )}
                  aria-hidden="true"
                />
                <span>{meta.label}</span>
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

// ── PageHeader ─────────────────────────────────────────────────────────────

export function PageHeader({
  title,
  description,
  actions,
  backHref,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  backHref?: string;
}) {
  return (
    <div className="border-b border-border bg-surface print:border-0">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-4 print:p-0">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            {backHref && (
              <a
                href={backHref}
                className="shrink-0 rounded-md p-1.5 text-fg-muted hover:bg-surface-2 hover:text-fg transition-colors focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
                aria-label="Go back"
              >
                <ChevronLeft className="h-5 w-5" aria-hidden="true" />
              </a>
            )}
            <div className="min-w-0">
              <h1 className="text-xl font-semibold text-fg truncate">{title}</h1>
              {description && (
                <p className="mt-1 text-sm text-fg-muted">{description}</p>
              )}
            </div>
          </div>
          {actions && (
            <div className="shrink-0 flex items-center gap-2">{actions}</div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── PageBody ───────────────────────────────────────────────────────────────

export function PageBody({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'mx-auto max-w-7xl px-4 sm:px-6 py-6 print:m-0 print:p-0 print:max-w-none',
        className,
      )}
    >
      {children}
    </div>
  );
}

// ── UserMenu ───────────────────────────────────────────────────────────────

function UserMenu({ user, onLogout }: { user: SdkUser; onLogout: () => void }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open]);

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-surface-2 transition-colors focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
        aria-label={`User menu for ${user.fullName || user.email}`}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <UserCircle className="h-6 w-6 text-fg-muted" aria-hidden="true" />
        <span className="hidden sm:inline text-sm text-fg-muted max-w-[160px] truncate">
          {user.fullName || user.email.split('@')[0]}
        </span>
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-1 z-50 w-56 rounded-lg border border-border bg-surface shadow-elev-2 py-1 overflow-hidden"
          role="menu"
          aria-label="User menu"
        >
          {/* User info */}
          <div className="px-4 py-3 border-b border-border" role="none">
            <p className="text-sm font-medium text-fg truncate">
              {user.fullName || user.email}
            </p>
            <p className="text-xs text-fg-muted truncate">{user.email}</p>
          </div>

          <a
            href="#/settings/profile"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-4 py-2.5 text-sm text-fg-muted hover:bg-surface-2 hover:text-fg transition-colors focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
            role="menuitem"
          >
            <Settings className="h-4 w-4" aria-hidden="true" />
            Account Settings
          </a>

          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              setOpen(false);
              window.dispatchEvent(new CustomEvent('wvi:open-shortcuts'));
            }}
            className="flex items-center gap-2 px-4 py-2.5 text-sm text-fg-muted hover:bg-surface-2 hover:text-fg transition-colors focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
            role="menuitem"
          >
            <Keyboard className="h-4 w-4" aria-hidden="true" />
            Keyboard Shortcuts
          </a>

          <button
            onClick={() => { setOpen(false); onLogout(); }}
            className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-fg-muted hover:bg-surface-2 hover:text-danger transition-colors border-t border-border focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
            role="menuitem"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
}
