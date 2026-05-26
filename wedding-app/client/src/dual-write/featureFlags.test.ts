import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadFlags, saveFlags, setFlag, resetFlags, ALL_DOMAINS } from './featureFlags.js';

beforeEach(() => {
  resetFlags();
});

afterEach(() => {
  resetFlags();
});

describe('featureFlags', () => {
  it('defaults every domain to local', () => {
    const flags = loadFlags();
    for (const d of ALL_DOMAINS) expect(flags[d]).toBe('local');
  });

  it('saveFlags + loadFlags round-trip', () => {
    const flags = loadFlags();
    flags.guests = 'server';
    flags.events = 'dual';
    saveFlags(flags);
    const reloaded = loadFlags();
    expect(reloaded.guests).toBe('server');
    expect(reloaded.events).toBe('dual');
    expect(reloaded.layouts).toBe('local');
  });

  it('setFlag persists a single domain change', () => {
    setFlag('vendors', 'dual');
    expect(loadFlags().vendors).toBe('dual');
    expect(loadFlags().guests).toBe('local');
  });

  it('ignores invalid persisted values', () => {
    localStorage.setItem('wedding.featureFlags', JSON.stringify({ guests: 'bogus' }));
    expect(loadFlags().guests).toBe('local');
  });

  it('handles malformed JSON in localStorage gracefully', () => {
    localStorage.setItem('wedding.featureFlags', '{not json');
    expect(loadFlags().guests).toBe('local');
  });
});
