import { describe, expect, it } from 'vitest';
import { getGreeting, safeJson, STATUS_COLORS, findSpaceConflicts, conflictedEventIds } from './dashboardUtils';
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

describe('space conflict detection', () => {
  const c = (over: Partial<import('./dashboardUtils').SpaceCommitment>): import('./dashboardUtils').SpaceCommitment => ({
    id: 'evt', title: 'Wedding', status: 'booked', start_date: '2026-09-12', end_date: null,
    guest_count: 100, venue_id: 'v1', venue_name: 'Ballroom', venue_capacity: 200, ...over,
  });

  it('flags overlapping events on the same space', () => {
    const conflicts = findSpaceConflicts([
      c({ id: 'a', start_date: '2026-09-12', end_date: '2026-09-12' }),
      c({ id: 'b', start_date: '2026-09-12', end_date: '2026-09-12' }),
    ]);
    expect(conflicts.length).toBe(1);
    expect(conflictedEventIds([c({ id: 'a', start_date: '2026-09-12' }), c({ id: 'b', start_date: '2026-09-12' })]).size).toBe(2);
  });

  it('ignores non-overlapping dates, different spaces, and cancelled/lost events', () => {
    const list = [
      c({ id: 'a', start_date: '2026-09-12' }),
      c({ id: 'b', start_date: '2026-09-13' }),
      c({ id: 'd', venue_id: 'v2', start_date: '2026-09-12' }),
      c({ id: 'e', status: 'cancelled', start_date: '2026-09-12' }),
      c({ id: 'f', status: 'lost', start_date: '2026-09-12' }),
    ];
    expect(findSpaceConflicts(list)).toEqual([]);
  });

  it('flags multi-day overlaps on either boundary', () => {
    expect(findSpaceConflicts([
      c({ id: 'a', start_date: '2026-09-10', end_date: '2026-09-14' }),
      c({ id: 'b', start_date: '2026-09-14', end_date: '2026-09-15' }),
    ]).length).toBe(1);
    expect(findSpaceConflicts([
      c({ id: 'a', start_date: '2026-09-10', end_date: '2026-09-14' }),
      c({ id: 'b', start_date: '2026-09-15', end_date: '2026-09-16' }),
    ])).toEqual([]);
  });
});
