import { describe, expect, it } from 'vitest';
import { eventReadinessScore, eventSetupItems, safeMetadata } from './eventDetailUtils';
describe('event detail utilities', () => {
  it('safely parses metadata and derives a deduplicated setup checklist', () => {
    expect(safeMetadata('bad-json')).toEqual({});
    const items = eventSetupItems({ title: 'Wedding', status: 'booked', start_date: '2026-09-12', guest_count: 10, metadata: JSON.stringify({ setupChecklist: [{ id: 'guests', label: 'Override', done: true }] }) });
    expect(items.filter((item) => item.id === 'guests')).toHaveLength(1);
    expect(eventReadinessScore({ title: 'Wedding', status: 'booked', start_date: '2026-09-12', guest_count: 10, metadata: '{}' }, { pending: 1, attending: 0, declined: 0, maybe: 0 })).toBeGreaterThan(0);
  });
});
