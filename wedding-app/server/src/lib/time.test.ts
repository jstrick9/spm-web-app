import { describe, it, expect } from 'vitest';
import { nowIso, toSqliteUtc, isoToSqliteUtc, localDateString, formatDateLong } from './time.js';

describe('time helpers', () => {
  it('nowIso returns ISO-8601 UTC', () => {
    expect(nowIso()).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it('toSqliteUtc / isoToSqliteUtc normalize to space format', () => {
    expect(isoToSqliteUtc('2026-09-12T16:30:00.000Z')).toBe('2026-09-12 16:30:00');
    expect(toSqliteUtc(new Date('2026-01-02T03:04:05.000Z'))).toBe('2026-01-02 03:04:05');
  });

  it('localDateString returns the LOCAL calendar date', () => {
    expect(localDateString(new Date(2026, 0, 15, 23, 59))).toBe('2026-01-15');
  });

  it('formatDateLong renders human dates for YYYY-MM-DD and ISO', () => {
    expect(formatDateLong('2026-09-12')).toBe('September 12, 2026');
    expect(formatDateLong('2026-09-12T16:30:00.000Z')).toBe('September 12, 2026');
    expect(formatDateLong(null)).toBe('TBD');
    expect(formatDateLong('')).toBe('TBD');
    expect(formatDateLong('not-a-date')).toBe('not-a-date');
  });
});
