import { describe, it, expect } from 'vitest';
import { countdownParts } from './countdown';

/**
 * Countdown must target LOCAL midnight of the wedding date.
 *
 * Regression: `new Date('YYYY-MM-DD')` parses as UTC midnight, so in a
 * UTC-negative timezone (all of the US) the countdown still showed
 * "0 days, N hours" ON the wedding day and flipped to "Celebration Time"
 * only at ~8 PM local; in UTC+ timezones it flipped hours INTO the
 * wedding day. All assertions below are computed against local Date
 * objects, so they hold in any test timezone.
 */
describe('countdownParts — local-midnight wedding countdown', () => {
  const weddingDate = '2026-09-12';

  it('is past once LOCAL midnight of the wedding day arrives (not UTC midnight)', () => {
    // Local noon on the wedding day: local midnight has passed → celebration.
    const localNoonWeddingDay = new Date(2026, 8, 12, 12, 0, 0).getTime();
    const parts = countdownParts(weddingDate, localNoonWeddingDay);
    expect(parts.isPast).toBe(true);
    expect(parts.days).toBe(0);
  });

  it('shows whole days + remainder hours before the wedding day', () => {
    // Local noon, two days before the wedding: 1.5 days remain.
    const localNoonTwoDaysBefore = new Date(2026, 8, 10, 12, 0, 0).getTime();
    const parts = countdownParts(weddingDate, localNoonTwoDaysBefore);
    expect(parts.isPast).toBe(false);
    expect(parts.days).toBe(1);
    expect(parts.hours).toBe(12);
    expect(parts.minutes).toBe(0);
  });

  it('does NOT flip early in UTC+ timezones (the day before the wedding)', () => {
    // 11 PM local the night before: still counting, not past.
    const lateNightBefore = new Date(2026, 8, 11, 23, 0, 0).getTime();
    const parts = countdownParts(weddingDate, lateNightBefore);
    expect(parts.isPast).toBe(false);
    expect(parts.days).toBe(0);
    expect(parts.hours).toBe(1);
  });

  it('handles missing/invalid dates defensively', () => {
    expect(countdownParts(null, Date.now()).isPast).toBe(false);
    expect(countdownParts('not-a-date', Date.now()).isPast).toBe(false);
  });
});
