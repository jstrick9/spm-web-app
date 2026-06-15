/**
 * ConfigProvider — single React source of truth for the resolved platform config.
 *
 * Phase 33 changes:
 *   • Intelligence and email-automations nav items added to the default navItems
 *     list, gated by feature flags so they can be disabled per-org.
 *   • platformName now defaults to "Wedding Venue Intelligence" from branding
 *     config — supports white-label overrides without code changes.
 *   • useNavItems() now returns items filtered by featureFlag — items whose
 *     feature flag is explicitly false are omitted automatically.
 *   • No breaking changes to existing consumers.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { ThemeProvider }                           from './ThemeProvider.js';
import { resolveConfig, type ConfigLayers }        from './resolveConfig.js';
import type { PartialPlatformConfig, PlatformConfig } from './schema.js';

// ── Context types ─────────────────────────────────────────────────────────

interface ConfigCtx {
  config: PlatformConfig;
  setPreviewOverride: (override: PartialPlatformConfig | null) => void;
  previewActive: boolean;
}

const ConfigContext = createContext<ConfigCtx | null>(null);

// ── Default nav items ─────────────────────────────────────────────────────
// Ordered for best workflow: primary → secondary → system
// Intelligence and email-automations are new Phase 33 additions.
// Items can be hidden per-org via featureFlags config.
const DEFAULT_NAV_ITEMS = [
  'dashboard',
  'events',
  'guests',
  'vendors',
  'calendar',
  'reports',
  'intelligence',    // Phase 33 — gated by featureFlag 'intelligence'
  'system',
] as const;

// ── Provider ──────────────────────────────────────────────────────────────

export interface ConfigProviderProps extends ConfigLayers {
  children: ReactNode;
  /**
   * If true, the resolved theme is also applied to the DOM via CSS vars.
   * Set to false when rendering the Theme Studio's isolated preview pane.
   */
  applyTheme?: boolean;
}

export function ConfigProvider({
  children,
  org,
  event,
  user,
  applyTheme = true,
}: ConfigProviderProps) {
  const [override, setOverride] = useState<PartialPlatformConfig | null>(null);

  const resolved = useMemo<PlatformConfig>(() => {
    return resolveConfig({
      org,
      event,
      user: mergePartial(user, override ?? undefined),
    });
  }, [org, event, user, override]);

  const setPreviewOverride = useCallback(
    (o: PartialPlatformConfig | null) => setOverride(o),
    [],
  );

  const value = useMemo<ConfigCtx>(
    () => ({ config: resolved, setPreviewOverride, previewActive: override !== null }),
    [resolved, setPreviewOverride, override],
  );

  const body = applyTheme ? (
    <ThemeProvider theme={resolved.theme}>{children}</ThemeProvider>
  ) : (
    <>{children}</>
  );

  return <ConfigContext.Provider value={value}>{body}</ConfigContext.Provider>;
}

// ── Merge helper ─────────────────────────────────────────────────────────

function mergePartial(
  a: PartialPlatformConfig | undefined,
  b: PartialPlatformConfig | undefined,
): PartialPlatformConfig | undefined {
  if (!a && !b) return undefined;
  return {
    theme:    { ...(a?.theme ?? {}),    ...(b?.theme ?? {}) },
    branding: { ...(a?.branding ?? {}), ...(b?.branding ?? {}) },
    layout: a?.layout || b?.layout
      ? {
          ...(a?.layout ?? {}),
          ...(b?.layout ?? {}),
          navItems:     b?.layout?.navItems     ?? a?.layout?.navItems,
          featureFlags: { ...(a?.layout?.featureFlags ?? {}), ...(b?.layout?.featureFlags ?? {}) },
        }
      : undefined,
    widgets: { ...(a?.widgets ?? {}), ...(b?.widgets ?? {}) },
    setup: (a as any)?.setup || (b as any)?.setup
      ? {
          ...((a as any)?.setup ?? {}),
          ...((b as any)?.setup ?? {}),
          ownerSetup: {
            ...((a as any)?.setup?.ownerSetup ?? {}),
            ...((b as any)?.setup?.ownerSetup ?? {}),
          },
        } as any
      : undefined,
  };
}

// ── Hooks ─────────────────────────────────────────────────────────────────

export function usePlatformConfig(): ConfigCtx {
  const ctx = useContext(ConfigContext);
  if (!ctx) throw new Error('usePlatformConfig must be used inside <ConfigProvider>');
  return ctx;
}

export function useTheme() {
  return usePlatformConfig().config.theme;
}

export function useBranding() {
  const { config } = usePlatformConfig();
  return {
    ...config.branding,
    // Ensure platformName always has a sensible default
    platformName: config.branding.platformName || 'Wedding Venue Intelligence',
  };
}

export function useFeatureEnabled(featureId: string): boolean {
  const { config } = usePlatformConfig();
  return config.layout.featureFlags[featureId] !== false;
}

/**
 * Returns the configured widget IDs for a slot (with hidden filtered out).
 */
export function useWidgetSlot(
  slotId: string,
): Array<{ id: string; options?: Record<string, unknown> }> {
  const { config } = usePlatformConfig();
  const slot = config.widgets[slotId];
  if (!slot) return [];
  return slot.widgets
    .filter((w) => !w.hidden)
    .map((w) => ({ id: w.id, options: w.options }));
}

/**
 * Returns the nav item ids for the sidebar, in config order.
 * Falls back to DEFAULT_NAV_ITEMS if the org hasn't configured custom nav.
 * Items whose featureFlag is explicitly false are omitted.
 *
 * Phase 33: 'intelligence' and 'email-automations' now included by default.
 */
export function useNavItems(): string[] {
  const { config } = usePlatformConfig();
  const configuredItems = config.layout.navItems;

  // Use config-provided list if available, otherwise fall back to defaults
  const items: string[] =
    configuredItems && configuredItems.length > 0
      ? configuredItems.map((item: any) => typeof item === 'string' ? item : item.id)
      : [...DEFAULT_NAV_ITEMS];

  // Filter out items whose featureFlag is disabled
  return items.filter((id) => {
    // Map item id → its feature flag (if any)
    const flagMap: Record<string, string> = {
      reports:      'reports',
      intelligence: 'intelligence',
    };
    const flag = flagMap[id];
    if (!flag) return true; // no flag = always shown
    return config.layout.featureFlags[flag] !== false;
  });
}
