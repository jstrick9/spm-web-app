import { describe, it, expect, vi, afterEach } from 'vitest';
import { formatDateOnly, parseDateOnly, daysUntilDateOnly } from './formatDate';

describe('formatDateOnly', () => {
  it('formats YYYY-MM-DD without timezone drift', () => {
    // Parsed as a calendar date (UTC) so the same date shows the same day
    // regardless of the viewer's timezone.
    expect(formatDateOnly('2026-09-12')).toBe('September 12, 2026');
    expect(formatDateOnly('2026-01-01')).toBe('January 1, 2026');
  });

  it('formats ISO timestamps using their date portion', () => {
    expect(formatDateOnly('2026-09-12T16:30:00.000Z')).toBe('September 12, 2026');
    expect(formatDateOnly('2026-12-31T23:59:59Z')).toBe('December 31, 2026');
  });

  it('returns TBD for null/undefined/empty', () => {
    expect(formatDateOnly(null)).toBe('TBD');
    expect(formatDateOnly(undefined)).toBe('TBD');
    expect(formatDateOnly('')).toBe('TBD');
  });

  it('never mangles unknown strings', () => {
    expect(formatDateOnly('not-a-date')).toBe('not-a-date');
  });
});

describe('parseDateOnly — timezone-safe calendar-date parsing', () => {
  // The regression this guards: `new Date('2026-09-12')` parses as UTC
  // midnight, which in UTC-negative timezones (all of the US) lands on the
  // PREVIOUS day — the Global Calendar showed events on the wrong day, the
  // analytics month chart bucketed month-boundary events into the wrong
  // month, and contract prints showed the wrong date.
  it('parses YYYY-MM-DD as a LOCAL calendar date (US timezone)', () => {
    const prevTz = process.env.TZ;
    process.env.TZ = 'America/New_York';
    try {
      const parsed = parseDateOnly('2026-09-12');
      expect(parsed).not.toBeNull();
      expect(parsed!.getFullYear()).toBe(2026);
      expect(parsed!.getMonth()).toBe(8);   // September — NOT rolled back to August
      expect(parsed!.getDate()).toBe(12);   // NOT rolled back to the 11th
    } finally {
      if (prevTz === undefined) delete process.env.TZ; else process.env.TZ = prevTz;
    }
  });

  it('parses the same calendar date in a UTC-positive timezone', () => {
    const prevTz = process.env.TZ;
    process.env.TZ = 'Europe/Berlin';
    try {
      const parsed = parseDateOnly('2026-09-12');
      expect(parsed!.getMonth()).toBe(8);
      expect(parsed!.getDate()).toBe(12);
    } finally {
      if (prevTz === undefined) delete process.env.TZ; else process.env.TZ = prevTz;
    }
  });

  it('returns null for null/undefined/garbage', () => {
    expect(parseDateOnly(null)).toBeNull();
    expect(parseDateOnly(undefined)).toBeNull();
    expect(parseDateOnly('nope')).toBeNull();
  });

  it('parses ISO-with-time values too (falls back to Date)', () => {
    const parsed = parseDateOnly('2026-09-12T16:30:00.000Z');
    expect(parsed).not.toBeNull();
  });
});

describe('daysUntilDateOnly — DST-safe whole-day countdown', () => {
  afterEach(() => vi.useRealTimers());

  it('is 0 on the day itself and positive before, regardless of clock time', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 12, 23, 59)); // late evening of the wedding
    expect(daysUntilDateOnly('2026-09-12')).toBe(0);

    vi.setSystemTime(new Date(2026, 8, 11, 23, 59)); // evening before
    expect(daysUntilDateOnly('2026-09-12')).toBe(1);
  });

  it('is negative after the date has passed', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 14));
    expect(daysUntilDateOnly('2026-09-12')).toBe(-2);
  });

  it('returns null for missing dates', () => {
    expect(daysUntilDateOnly(null)).toBeNull();
    expect(daysUntilDateOnly('')).toBeNull();
  });
});
