/**
 * ConfigProvider — single React source of truth for the resolved platform
 * config. Components consume it via hooks (`useTheme`, `useBranding`,
 * `useWidgetSlot`, `useFeatureEnabled`).
 *
 * Persistence happens in the layers (org/event/user) — this provider
 * just holds the resolved view in memory and exposes a `setOverride()`
 * for the Theme Studio live preview.
 *
 *   <ConfigProvider
 *     org={orgConfig}        // from /api/orgs/:id (Phase 3.5)
 *     event={eventConfig}    // from /api/events/:id (Phase 3.5)
 *     user={userConfig}      // from /api/auth/me
 *   >
 *     <ThemeProvider theme={cfg.theme}>
 *       <App />
 *     </ThemeProvider>
 *   </ConfigProvider>
 */
import {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
  type ReactNode,
} from 'react';
import { ThemeProvider } from './ThemeProvider.js';
import { resolveConfig, type ConfigLayers } from './resolveConfig.js';
import type { PartialPlatformConfig, PlatformConfig } from './schema.js';

interface ConfigCtx {
  config: PlatformConfig;
  /**
   * Apply a transient preview override (e.g. while the Theme Studio is
   * open). Pass null to clear. Doesn't persist anywhere; the Theme
   * Studio's "Save" button writes to the appropriate scope separately.
   */
  setPreviewOverride: (override: PartialPlatformConfig | null) => void;
  previewActive: boolean;
}

const ConfigContext = createContext<ConfigCtx | null>(null);

export interface ConfigProviderProps extends ConfigLayers {
  children: ReactNode;
  /**
   * If true, the resolved theme is also applied to the DOM via CSS vars
   * (default true). Disable when rendering the Theme Studio's isolated
   * preview pane.
   */
  applyTheme?: boolean;
}

export function ConfigProvider({
  children, org, event, user, applyTheme = true,
}: ConfigProviderProps) {
  const [override, setOverride] = useState<PartialPlatformConfig | null>(null);

  const resolved = useMemo<PlatformConfig>(() => {
    // The preview override is layered ON TOP of everything else as a
    // pseudo-user-layer. It's NEVER persisted; it just changes what's
    // visible while the Studio is open.
    return resolveConfig({
      org,
      event,
      user: mergePartial(user, override ?? undefined),
    });
  }, [org, event, user, override]);

  const setPreviewOverride = useCallback((o: PartialPlatformConfig | null) => {
    setOverride(o);
  }, []);

  const value = useMemo<ConfigCtx>(() => ({
    config: resolved,
    setPreviewOverride,
    previewActive: override !== null,
  }), [resolved, setPreviewOverride, override]);

  const body = applyTheme ? (
    <ThemeProvider theme={resolved.theme}>{children}</ThemeProvider>
  ) : (
    <>{children}</>
  );

  return <ConfigContext.Provider value={value}>{body}</ConfigContext.Provider>;
}

function mergePartial(
  a: PartialPlatformConfig | undefined,
  b: PartialPlatformConfig | undefined,
): PartialPlatformConfig | undefined {
  if (!a && !b) return undefined;
  return {
    theme:    { ...(a?.theme ?? {}),    ...(b?.theme ?? {})    },
    branding: { ...(a?.branding ?? {}), ...(b?.branding ?? {}) },
    layout:   a?.layout || b?.layout
      ? {
          ...(a?.layout ?? {}),
          ...(b?.layout ?? {}),
          featureFlags: { ...(a?.layout?.featureFlags ?? {}), ...(b?.layout?.featureFlags ?? {}) },
        }
      : undefined,
    widgets:  { ...(a?.widgets ?? {}), ...(b?.widgets ?? {}) },
  };
}

// ─── Hooks ────────────────────────────────────────────────
export function usePlatformConfig(): ConfigCtx {
  const ctx = useContext(ConfigContext);
  if (!ctx) throw new Error('usePlatformConfig must be inside <ConfigProvider>');
  return ctx;
}

export function useTheme() {
  return usePlatformConfig().config.theme;
}

export function useBranding() {
  return usePlatformConfig().config.branding;
}

export function useFeatureEnabled(featureId: string): boolean {
  const { config } = usePlatformConfig();
  return config.layout.featureFlags[featureId] !== false;
}

/**
 * Returns the configured widget IDs for a slot (with hidden filtered out).
 * Use with the widget registry to render the actual components.
 */
export function useWidgetSlot(slotId: string): Array<{ id: string; options?: Record<string, unknown> }> {
  const { config } = usePlatformConfig();
  const slot = config.widgets[slotId];
  if (!slot) return [];
  return slot.widgets
    .filter((w) => !w.hidden)
    .map((w) => ({ id: w.id, options: w.options }));
}

export function useNavItems() {
  return usePlatformConfig().config.layout.navItems;
}
