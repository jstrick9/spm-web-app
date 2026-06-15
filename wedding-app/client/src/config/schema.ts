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

  // Typography - loosened to general strings for complete Google Font dynamic loading support
  fontDisplay:   z.string(),
  fontBody:      z.string(),
  fontMono:      z.string(),

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
  tagline:      z.string().max(140).optional(),
  
  // Custom Dynamic Google Branding parameters
  brandColor:   z.string().optional(),
  headingFont:  z.string().optional(),
  bodyFont:     z.string().optional(),
});
export type BrandingConfig = z.infer<typeof brandingConfigSchema>;

// ─── First-run setup / onboarding ─────────────────────────
export const ownerSetupConfigSchema = z.object({
  status: z.enum(['not_started', 'skipped', 'in_progress', 'completed']),
  completedSteps: z.array(z.string()),
  skippedAt: z.string().optional(),
  completedAt: z.string().optional(),
  identity: z.record(z.unknown()).optional(),
  spaces: z.record(z.unknown()).optional(),
  rules: z.record(z.unknown()).optional(),
  catalog: z.record(z.unknown()).optional(),
  firstEvent: z.record(z.unknown()).optional(),
});
export type OwnerSetupConfig = z.infer<typeof ownerSetupConfigSchema>;

export const setupConfigSchema = z.object({
  ownerSetup: ownerSetupConfigSchema,
});
export type SetupConfig = z.infer<typeof setupConfigSchema>;

export const onboardingTourStateSchema = z.object({
  status: z.enum(['not_started', 'in_progress', 'completed', 'dismissed']).default('not_started'),
  currentSlide: z.number().int().min(0).optional(),
  completedSlides: z.array(z.string()).default([]),
  startedAt: z.string().optional(),
  completedAt: z.string().optional(),
  resumedAt: z.string().optional(),
  dismissedAt: z.string().optional(),
});

export const onboardingConfigSchema = z.object({
  welcomeTourByOrg: z.record(onboardingTourStateSchema).default({}),
});
export type OnboardingConfig = z.infer<typeof onboardingConfigSchema>;


// ─── Admin / Platform Studio configuration ────────────────
export const adminSetupChecklistItemSchema = z.object({
  id: z.string(),
  label: z.string(),
  required: z.boolean().default(true),
  ownerHelp: z.string().optional(),
});

export const venuePolicySchema = z.object({
  key: z.string(),
  label: z.string(),
  value: z.string(),
  ownerVisible: z.boolean().default(true),
});

export const defaultTemplateSchema = z.object({
  key: z.string(),
  label: z.string(),
  category: z.enum(['event', 'timeline', 'contract', 'message', 'checklist']),
  enabled: z.boolean().default(true),
});

export const notificationPreferenceSchema = z.object({
  channel: z.enum(['email', 'in_app', 'sms', 'push']),
  enabled: z.boolean().default(true),
  criticalOnly: z.boolean().default(false),
});

export const dataRetentionConfigSchema = z.object({
  eventArchiveMonths: z.number().int().min(1).max(120),
  guestPortalDataMonths: z.number().int().min(1).max(120),
  auditLogMonths: z.number().int().min(1).max(120),
  autoDeleteInactiveLeads: z.boolean().default(false),
});

export const adminConfigSchema = z.object({
  setupChecklist: z.array(adminSetupChecklistItemSchema),
  venuePolicies: z.array(venuePolicySchema),
  defaultTemplates: z.array(defaultTemplateSchema),
  notificationPreferences: z.array(notificationPreferenceSchema),
  dataRetention: dataRetentionConfigSchema,
});
export type AdminConfig = z.infer<typeof adminConfigSchema>;

// ─── The whole shape ──────────────────────────────────────
export const platformConfigSchema = z.object({
  theme:    themeSchema,
  widgets:  widgetsConfigSchema,
  layout:   layoutConfigSchema,
  branding: brandingConfigSchema,
  setup:    setupConfigSchema,
  onboarding: onboardingConfigSchema,
  admin: adminConfigSchema,
});

export type PlatformConfig = z.infer<typeof platformConfigSchema>;

// Partial versions — used at every storage layer
export const partialPlatformConfigSchema = platformConfigSchema.deepPartial();
export type PartialPlatformConfig = z.infer<typeof partialPlatformConfigSchema>;
