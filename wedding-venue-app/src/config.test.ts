import { beforeEach, describe, expect, it } from 'vitest';
import { defaultConfig, getConfig, resetConfig, setConfig, updateConfig } from './config';

describe('config storage', () => {
  beforeEach(() => {
    localStorage.removeItem('spm_config');
  });

  it('returns defaults when no config is stored', () => {
    expect(getConfig()).toEqual(defaultConfig);
  });

  it('loads legacy raw config and merges with defaults', () => {
    localStorage.setItem(
      'spm_config',
      JSON.stringify({
        venueName: 'Custom Venue',
        primaryColor: '#123456',
      }),
    );

    const config = getConfig();

    expect(config.venueName).toBe('Custom Venue');
    expect(config.primaryColor).toBe('#123456');
    expect(config.tagline).toBe(defaultConfig.tagline);
    expect(config.websiteUrl).toBe(defaultConfig.websiteUrl);
  });

  it('rewrites legacy raw config into a versioned envelope on read', () => {
    localStorage.setItem(
      'spm_config',
      JSON.stringify({
        venueName: 'Migrated Venue',
      }),
    );

    const config = getConfig();
    expect(config.venueName).toBe('Migrated Venue');

    const stored = JSON.parse(localStorage.getItem('spm_config') || 'null');
    expect(stored.version).toBe(2);
    expect(stored.data.venueName).toBe('Migrated Venue');
    expect(stored.savedAt).toBeTruthy();
  });

  it('updates config partially and preserves existing values', () => {
    updateConfig({
      venueName: 'Updated Venue',
      accentColor: '#abcdef',
    });

    const config = getConfig();
    expect(config.venueName).toBe('Updated Venue');
    expect(config.accentColor).toBe('#abcdef');
    expect(config.primaryColor).toBe(defaultConfig.primaryColor);

    const stored = JSON.parse(localStorage.getItem('spm_config') || 'null');
    expect(stored.version).toBe(2);
    expect(stored.data.venueName).toBe('Updated Venue');
  });

  it('sets a full config as a versioned envelope', () => {
    const fullConfig = {
      ...defaultConfig,
      venueName: 'Full Save Venue',
      location: 'Nashville, TN',
    };

    setConfig(fullConfig);

    const config = getConfig();
    expect(config).toEqual(fullConfig);

    const stored = JSON.parse(localStorage.getItem('spm_config') || 'null');
    expect(stored.version).toBe(2);
    expect(stored.data.location).toBe('Nashville, TN');
  });

  it('resets config by removing the stored key', () => {
    updateConfig({ venueName: 'Temporary Venue' });
    expect(localStorage.getItem('spm_config')).toBeTruthy();

    resetConfig();

    expect(localStorage.getItem('spm_config')).toBeNull();
    expect(getConfig()).toEqual(defaultConfig);
  });
});