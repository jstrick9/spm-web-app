import { describe, it, expect } from 'vitest';
import { calendarDaysUntil } from './calendarDays';

function localDateString(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

describe('calendarDaysUntil', () => {
  it('returns 0 for today, 1 for tomorrow, -1 for yesterday (local calendar days)', () => {
    expect(calendarDaysUntil(localDateString(0))).toBe(0);
    expect(calendarDaysUntil(localDateString(1))).toBe(1);
    expect(calendarDaysUntil(localDateString(-1))).toBe(-1);
  });

  it('is timezone-safe: today is never 1 (regression: UTC-midnight parsing)', () => {
    // With `new Date('YYYY-MM-DD')` the day count drifted by one in
    // non-UTC timezones; local calendar arithmetic must always give 0.
    expect(calendarDaysUntil(localDateString(0))).toBe(0);
  });

  it('handles full ISO timestamps by comparing to now', () => {
    const future = new Date(Date.now() + 3 * 86_400_000).toISOString();
    expect(calendarDaysUntil(future)).toBe(3);
  });

  it('returns null for null/undefined/garbage', () => {
    expect(calendarDaysUntil(null)).toBeNull();
    expect(calendarDaysUntil(undefined)).toBeNull();
    expect(calendarDaysUntil('not-a-date')).toBeNull();
    expect(calendarDaysUntil('2026-13-99')).toBeNull();
  });
});
