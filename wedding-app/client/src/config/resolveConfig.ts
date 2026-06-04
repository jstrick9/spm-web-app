/**
 * Cascade resolver: merge system + org + event + user → effective config.
 *
 *   resolved = merge(SYSTEM, org, event, user)
 *
 * Merge semantics:
 *   - Theme:    later layer overrides individual fields
 *   - Widgets:  later layer REPLACES the whole slot if it sets one (admins
 *               opt-in to customization per-slot; partial slot edits would
 *               be confusing). Slots not mentioned fall through.
 *   - Layout:   navItems use later-wins; featureFlags merge field-wise
 *   - Branding: later-wins per field
 *
 * Additionally maps organization branding options (like custom brand color
 * and typography fonts) into active CSS theme variables in real-time.
 */
import { SYSTEM_DEFAULTS } from './defaults.js';
import type { PartialPlatformConfig, PlatformConfig } from './schema.js';

export interface ConfigLayers {
  org?:   PartialPlatformConfig;
  event?: PartialPlatformConfig;
  user?:  PartialPlatformConfig;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

function getSoftBrand(r: number, g: number, b: number): string {
  // Blend with white (85% white, 15% color)
  const sr = Math.round(r * 0.15 + 255 * 0.85);
  const sg = Math.round(g * 0.15 + 255 * 0.85);
  const sb = Math.round(b * 0.15 + 255 * 0.85);
  return `${sr} ${sg} ${sb}`;
}

function getStrongBrand(r: number, g: number, b: number): string {
  // Blend with black (30% black, 70% color)
  const dr = Math.round(r * 0.7);
  const dg = Math.round(g * 0.7);
  const db = Math.round(b * 0.7);
  return `${dr} ${dg} ${db}`;
}

export function resolveConfig(layers: ConfigLayers = {}): PlatformConfig {
  const out: PlatformConfig = structuredClone(SYSTEM_DEFAULTS);

  for (const layer of [layers.org, layers.event, layers.user]) {
    if (!layer) continue;
    if (layer.theme)    Object.assign(out.theme, layer.theme);
    if (layer.branding) Object.assign(out.branding, layer.branding);
    if (layer.layout) {
      if (layer.layout.navItems) out.layout.navItems = layer.layout.navItems as PlatformConfig['layout']['navItems'];
      if (typeof layer.layout.sidebarCollapsedByDefault === 'boolean') {
        out.layout.sidebarCollapsedByDefault = layer.layout.sidebarCollapsedByDefault;
      }
      if (layer.layout.featureFlags) {
        out.layout.featureFlags = { ...out.layout.featureFlags, ...layer.layout.featureFlags };
      }
    }
    if (layer.widgets) {
      // Slot-level replace
      for (const [slotId, slot] of Object.entries(layer.widgets)) {
        if (slot) out.widgets[slotId] = slot;
      }
    }
  }

  // ─── Real-Time Dynamic Branding to Theme mapping ───
  if (out.branding) {
    if ((out.branding as any).brandColor) {
      const rgb = hexToRgb((out.branding as any).brandColor);
      if (rgb) {
        out.theme.brand = `${rgb.r} ${rgb.g} ${rgb.b}`;
        out.theme.brandStrong = getStrongBrand(rgb.r, rgb.g, rgb.b);
        out.theme.brandSoft = getSoftBrand(rgb.r, rgb.g, rgb.b);
      }
    }
    if ((out.branding as any).headingFont) {
      out.theme.fontDisplay = (out.branding as any).headingFont;
    }
    if ((out.branding as any).bodyFont) {
      out.theme.fontBody = (out.branding as any).bodyFont;
    }
  }

  return out;
}
