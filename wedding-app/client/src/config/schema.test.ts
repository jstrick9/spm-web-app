import { describe, expect, it } from 'vitest';
import { platformConfigSchema, partialPlatformConfigSchema } from './schema.js';
import { SYSTEM_DEFAULTS } from './defaults.js';
import { THEME_PRESETS } from './presets.js';

describe('PlatformConfig schema', () => {
  it('accepts SYSTEM_DEFAULTS as a full config', () => {
    expect(() => platformConfigSchema.parse(SYSTEM_DEFAULTS)).not.toThrow();
  });

  it.each(THEME_PRESETS)('preset "$name" passes the partial schema', (preset) => {
    expect(() => partialPlatformConfigSchema.parse(preset.config)).not.toThrow();
  });

  it('rejects an invalid rgb triplet', () => {
    const bad = { ...SYSTEM_DEFAULTS, theme: { ...SYSTEM_DEFAULTS.theme, brand: '#FF0000' } };
    expect(() => platformConfigSchema.parse(bad)).toThrow(/rgb triplet/);
  });

  it('rejects an unknown density value', () => {
    const bad = { ...SYSTEM_DEFAULTS, theme: { ...SYSTEM_DEFAULTS.theme, density: 'cozy' as never } };
    expect(() => platformConfigSchema.parse(bad)).toThrow();
  });

  it('rejects unknown radius', () => {
    const bad = { ...SYSTEM_DEFAULTS, theme: { ...SYSTEM_DEFAULTS.theme, radius: 'cube' as never } };
    expect(() => platformConfigSchema.parse(bad)).toThrow();
  });

  it('accepts an empty partial (admin has overridden nothing)', () => {
    expect(() => partialPlatformConfigSchema.parse({})).not.toThrow();
  });

  it('partial accepts just a theme override', () => {
    expect(() => partialPlatformConfigSchema.parse({
      theme: { brand: '10 20 30' },
    })).not.toThrow();
  });
});
