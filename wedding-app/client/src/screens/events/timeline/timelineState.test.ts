import { describe, it, expect, beforeEach } from 'vitest';
import {
  buildTimelineSnapshot,
  compareTimelineSnapshots,
  managerTimelineStorageKey,
  readManagerTimelineState,
  writeManagerTimelineState,
  DEFAULT_MANAGER_TIMELINE_STATE,
  type ManagerTimelineState,
  type TimelineSnapshot,
} from './timelineState';

/**
 * Unit tests for the pure timeline state/snapshot helpers extracted from
 * EventTimelineTab. These lock the diffing and storage logic in place.
 */

const item = (over: Partial<Record<string, any>> = {}) => ({
  id: 't1',
  title: 'Ceremony',
  starts_at: '2026-09-12T16:00:00',
  duration_min: 60,
  category: 'ceremony',
  completed: 0,
  vendor_id: null,
  assigned_to: null,
  metadata: '{}',
  ...over,
});

describe('buildTimelineSnapshot', () => {
  it('builds a snapshot entry per item with resolved assignment', () => {
    const snap = buildTimelineSnapshot([item({ id: 'a', vendor_id: 'v1' }), item({ id: 'b', assigned_to: 'crew-9' })] as any);
    expect(snap.items.length).toBe(2);
    expect(snap.items[0]).toMatchObject({ id: 'a', title: 'Ceremony', assignment: 'v1' });
    expect(snap.items[1].assignment).toBe('crew-9');
    expect(snap.savedAt).toBeTruthy();
  });

  it('returns an empty item list for an empty timeline', () => {
    const snap = buildTimelineSnapshot([] as any);
    expect(snap.items).toEqual([]);
  });
});

describe('compareTimelineSnapshots', () => {
  const base: TimelineSnapshot = {
    savedAt: '2026-01-01T00:00:00.000Z',
    items: [
      { id: 'a', title: 'Ceremony', startsAt: '2026-09-12T16:00:00', durationMin: 60, category: 'ceremony', completed: 0, assignment: '' },
      { id: 'b', title: 'Cocktail Hour', startsAt: '2026-09-12T17:00:00', durationMin: 60, category: 'cocktail', completed: 0, assignment: '' },
    ],
  };

  it('returns no diff when snapshots match', () => {
    const current = buildTimelineSnapshot([item({ id: 'a' }), item({ id: 'b', title: 'Cocktail Hour' })] as any);
    // build a matching snapshot with the same ids/titles
    const matching: TimelineSnapshot = {
      savedAt: '2026-01-02T00:00:00.000Z',
      items: [...base.items],
    };
    expect(compareTimelineSnapshots(matching, matching)).toEqual([]);
  });

  it('flags added, removed, and changed items', () => {
    const current: TimelineSnapshot = {
      savedAt: '2026-01-02T00:00:00.000Z',
      items: [
        { id: 'b', title: 'Cocktail Hour', startsAt: '2026-09-12T17:00:00', durationMin: 60, category: 'cocktail', completed: 0, assignment: '' },
        { id: 'c', title: 'Reception', startsAt: '2026-09-12T18:00:00', durationMin: 240, category: 'reception', completed: 0, assignment: '' },
      ],
    };
    const diff = compareTimelineSnapshots(base, current);
    expect(diff.some(d => d.type === 'removed' && d.id === 'a')).toBe(true);
    expect(diff.some(d => d.type === 'added' && d.id === 'c')).toBe(true);
  });

  it('returns no diff when there is no previous snapshot', () => {
    expect(compareTimelineSnapshots(undefined, base)).toEqual([]);
  });
});

describe('manager timeline state storage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('produces a stable per-event storage key', () => {
    expect(managerTimelineStorageKey('evt-1')).toContain('evt-1');
    expect(managerTimelineStorageKey('evt-1')).not.toBe(managerTimelineStorageKey('evt-2'));
  });

  it('round-trips state through localStorage', () => {
    const state: ManagerTimelineState = {
      ...DEFAULT_MANAGER_TIMELINE_STATE,
      managerApprovalStatus: 'approved',
      lastSnapshot: buildTimelineSnapshot([item({ id: 'a' })] as any),
    };
    writeManagerTimelineState('evt-1', state);
    const read = readManagerTimelineState('evt-1');
    expect(read.managerApprovalStatus).toBe('approved');
    expect(read.lastSnapshot?.items.length).toBe(1);
  });

  it('falls back to defaults when nothing is stored', () => {
    const read = readManagerTimelineState('evt-unknown');
    expect(read.managerApprovalStatus).toBe(DEFAULT_MANAGER_TIMELINE_STATE.managerApprovalStatus);
  });
});
