import { describe, it, expect } from 'vitest';
import { formatDateOnly } from './formatDate';

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
