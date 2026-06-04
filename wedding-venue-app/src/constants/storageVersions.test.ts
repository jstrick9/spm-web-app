import { describe, expect, it } from 'vitest';
import { STORAGE_VERSIONS } from './storageVersions';

describe('STORAGE_VERSIONS', () => {
  it('includes config and saved layout versions', () => {
    expect(STORAGE_VERSIONS.CONFIG).toBe(2);
    expect(STORAGE_VERSIONS.SAVED_LAYOUTS).toBe(3);
  });

  it('includes messaging and submission versions', () => {
    expect(STORAGE_VERSIONS.DIRECT_MESSAGES).toBe(1);
    expect(STORAGE_VERSIONS.EVENT_SUBMISSIONS).toBe(1);
  });

  it('includes guest portal versions', () => {
    expect(STORAGE_VERSIONS.PORTAL_CONFIG).toBe(2);
    expect(STORAGE_VERSIONS.PORTAL_GUESTS).toBe(1);
    expect(STORAGE_VERSIONS.RSVP_SUBMISSIONS).toBe(1);
  });

  it('includes collaboration session version', () => {
    expect(STORAGE_VERSIONS.LAYOUT_EDIT_SESSIONS).toBe(1);
  });

  it('contains only positive integers', () => {
    const values = Object.values(STORAGE_VERSIONS);

    values.forEach((value) => {
      expect(Number.isInteger(value)).toBe(true);
      expect(value).toBeGreaterThan(0);
    });
  });
});