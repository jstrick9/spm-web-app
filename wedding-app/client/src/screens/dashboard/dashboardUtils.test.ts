import { describe, expect, it } from 'vitest';
import { getGreeting, safeJson, STATUS_COLORS } from './dashboardUtils';
describe('dashboard utilities', () => {
  it('returns deterministic greetings for a supplied time', () => {
    expect(getGreeting(new Date('2026-01-01T08:00:00'))).toBe('morning');
    expect(getGreeting(new Date('2026-01-01T14:00:00'))).toBe('afternoon');
    expect(getGreeting(new Date('2026-01-01T20:00:00'))).toBe('evening');
  });
  it('normalizes JSON safely and exposes all event statuses', () => {
    expect(safeJson('{"x":1}')).toEqual({ x: 1 });
    expect(safeJson('not-json')).toEqual({});
    expect(Object.keys(STATUS_COLORS)).toEqual(expect.arrayContaining(['lead', 'booked', 'completed']));
  });
});
