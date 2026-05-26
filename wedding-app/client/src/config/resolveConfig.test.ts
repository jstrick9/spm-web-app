import { describe, expect, it } from 'vitest';
import { resolveConfig } from './resolveConfig.js';
import { SYSTEM_DEFAULTS } from './defaults.js';

describe('resolveConfig', () => {
  it('returns SYSTEM_DEFAULTS when no overrides given', () => {
    expect(resolveConfig({})).toEqual(SYSTEM_DEFAULTS);
  });

  it('org theme overrides system theme field-by-field', () => {
    const out = resolveConfig({ org: { theme: { brand: '10 20 30' } } });
    expect(out.theme.brand).toBe('10 20 30');
    // Other fields untouched
    expect(out.theme.accent).toBe(SYSTEM_DEFAULTS.theme.accent);
    expect(out.theme.density).toBe(SYSTEM_DEFAULTS.theme.density);
  });

  it('event theme overrides org theme', () => {
    const out = resolveConfig({
      org:   { theme: { brand: '10 20 30' } },
      event: { theme: { brand: '99 99 99' } },
    });
    expect(out.theme.brand).toBe('99 99 99');
  });

  it('user theme has highest priority', () => {
    const out = resolveConfig({
      org:   { theme: { brand: '10 20 30' } },
      event: { theme: { brand: '20 20 20' } },
      user:  { theme: { brand: '40 40 40' } },
    });
    expect(out.theme.brand).toBe('40 40 40');
  });

  it('widgets — slot replacement (not merge)', () => {
    const out = resolveConfig({
      org: {
        widgets: {
          'venue.dashboard.kpis': {
            widgets: [{ id: 'kpi.revenue-per-event' }],
          },
        },
      },
    });
    expect(out.widgets['venue.dashboard.kpis'].widgets).toEqual([
      { id: 'kpi.revenue-per-event' },
    ]);
    // Other slots untouched
    expect(out.widgets['event.detail.intelligence']).toEqual(
      SYSTEM_DEFAULTS.widgets['event.detail.intelligence']
    );
  });

  it('layout.navItems is later-wins (whole array)', () => {
    const out = resolveConfig({
      org: { layout: { navItems: [{ id: 'events' }, { id: 'guests' }] } },
    });
    expect(out.layout.navItems).toEqual([{ id: 'events' }, { id: 'guests' }]);
  });

  it('layout.featureFlags merges field-by-field', () => {
    const out = resolveConfig({
      org:  { layout: { featureFlags: { reports: false } } },
      user: { layout: { featureFlags: { vendor_portal: false } } },
    });
    expect(out.layout.featureFlags.reports).toBe(false);
    expect(out.layout.featureFlags.vendor_portal).toBe(false);
    expect(out.layout.featureFlags.messaging).toBe(true);  // default preserved
  });

  it('branding merges field-by-field', () => {
    const out = resolveConfig({
      org: { branding: { platformName: 'Acme Venues' } },
    });
    expect(out.branding.platformName).toBe('Acme Venues');
    expect(out.branding.tagline).toBe(SYSTEM_DEFAULTS.branding.tagline);  // unchanged
  });

  it('does not mutate SYSTEM_DEFAULTS', () => {
    const before = JSON.stringify(SYSTEM_DEFAULTS);
    resolveConfig({ org: { theme: { brand: '1 2 3' } } });
    expect(JSON.stringify(SYSTEM_DEFAULTS)).toBe(before);
  });
});
