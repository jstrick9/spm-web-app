/**
 * PlatformConfig — the typed schema for everything an admin can configure.
 *
 * Hierarchy (highest priority wins):
 *   1. SYSTEM_DEFAULTS (this file)
 *   2. Organization (Settings → Platform tab) — applies to all org users
 *   3. Event       (Event Settings → Theme tab) — applies inside that event
 *   4. User        (Profile → Preferences)      — applies just to that user
 *
 * Every level stores a PARTIAL of this shape; the resolver in
 * src/config/resolveConfig.ts merges them.
 *
 * Why zod-validated?
 *   - Catches bad admin input at write time (clear error message)
 *   - Generates the TypeScript type via z.infer
 *   - Lets the server validate the same shape on PUT /api/orgs/:id/config
 */
import { z } from 'zod';

// ─── Theme ────────────────────────────────────────────────
const colorRgbTriplet = z.string().regex(/^\d{1,3}\s+\d{1,3}\s+\d{1,3}$/, 'rgb triplet "R G B"');

export const themeSchema = z.object({
  // Identity colors
  brand:         colorRgbTriplet,
  brandStrong:   colorRgbTriplet,
  brandSoft:     colorRgbTriplet,
  accent:        colorRgbTriplet,
  accentSoft:    colorRgbTriplet,

  // Surface
  bg:            colorRgbTriplet,
  surface:       colorRgbTriplet,
  surface2:      colorRgbTriplet,
  border:        colorRgbTriplet,
  fg:            colorRgbTriplet,
  fgMuted:       colorRgbTriplet,

  // Typography
  fontDisplay:   z.enum(['Fraunces', 'Playfair Display', 'Cormorant Garamond', 'Lora', 'system-serif']),
  fontBody:      z.enum(['Inter', 'IBM Plex Sans', 'Source Sans 3', 'system-sans']),
  fontMono:      z.enum(['JetBrains Mono', 'Fira Code', 'IBM Plex Mono', 'system-mono']),

  // Density (affects spacing scale + control heights)
  density:       z.enum(['compact', 'comfortable', 'spacious']),

  // Border radius style
  radius:        z.enum(['sharp', 'soft', 'pill']),  // 4/8/16

  // Motion
  motion:        z.enum(['minimal', 'standard', 'expressive']),

  // Dark mode preference: 'system' (follow OS) | 'light' | 'dark'
  colorScheme:   z.enum(['system', 'light', 'dark']),
});

export type ThemeConfig = z.infer<typeof themeSchema>;

// ─── Widget config ────────────────────────────────────────
/**
 * A "widget slot" is a named location in a dashboard (e.g.
 * 'venue.dashboard.kpis', 'event.detail.intelligence', 'couple.portal.hero').
 * The slot's content is determined by the resolved config: an ordered list
 * of widget IDs to render, plus per-widget threshold/visibility config.
 *
 * Widgets themselves live in src/config/widgets/registry.ts.
 */
export const widgetSlotSchema = z.object({
  widgets: z.array(z.object({
    id: z.string(),                         // widget id like 'kpi.booking-conversion'
    hidden: z.boolean().optional(),
    options: z.record(z.unknown()).optional(), // per-widget config (thresholds, labels, etc.)
  })),
});
export type WidgetSlotConfig = z.infer<typeof widgetSlotSchema>;

export const widgetsConfigSchema = z.record(widgetSlotSchema);  // slotId -> WidgetSlotConfig
export type WidgetsConfig = z.infer<typeof widgetsConfigSchema>;

// ─── Layout / nav ─────────────────────────────────────────
export const layoutConfigSchema = z.object({
  /** Order + visibility of the primary nav items. */
  navItems: z.array(z.object({
    id: z.string(),                  // 'events' | 'guests' | 'vendors' | 'reports' | ...
    hidden: z.boolean().optional(),
    label: z.string().optional(),    // override default label
  })),
  /** Default sidebar collapsed state (user can still toggle). */
  sidebarCollapsedByDefault: z.boolean(),
  /** Show / hide entire top-level features. */
  featureFlags: z.record(z.boolean()),
});
export type LayoutConfig = z.infer<typeof layoutConfigSchema>;

// ─── Branding ─────────────────────────────────────────────
export const brandingConfigSchema = z.object({
  platformName: z.string().min(1).max(80),
  logoUrl:      z.string().url().optional().or(z.literal('')),
  favicon:      z.string().url().optional().or(z.literal('')),
  supportEmail: z.string().email().optional().or(z.literal('')),
  /** Used in the editorial portal: a tagline under the platform name. */
  tagline:      z.string().max(140).optional(),
});
export type BrandingConfig = z.infer<typeof brandingConfigSchema>;

// ─── The whole shape ──────────────────────────────────────
export const platformConfigSchema = z.object({
  theme:    themeSchema,
  widgets:  widgetsConfigSchema,
  layout:   layoutConfigSchema,
  branding: brandingConfigSchema,
});

export type PlatformConfig = z.infer<typeof platformConfigSchema>;

// Partial versions — used at every storage layer
export const partialPlatformConfigSchema = platformConfigSchema.deepPartial();
export type PartialPlatformConfig = z.infer<typeof partialPlatformConfigSchema>;
