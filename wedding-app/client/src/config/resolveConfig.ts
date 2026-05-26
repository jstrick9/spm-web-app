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
 * Deliberately small and pure — no React, no fetching. Tested in isolation.
 */
import { SYSTEM_DEFAULTS } from './defaults.js';
import type { PartialPlatformConfig, PlatformConfig } from './schema.js';

export interface ConfigLayers {
  org?:   PartialPlatformConfig;
  event?: PartialPlatformConfig;
  user?:  PartialPlatformConfig;
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

  return out;
}
