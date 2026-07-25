import { describe, expect, it } from 'vitest';
import { centerDistance, itemLabel, managerLayoutOpsFromBackend } from './layoutOpsModel';
describe('layout operations model', () => {
  it('normalizes backend operations and geometry helpers', () => {
    expect(itemLabel({ vendorName: 'DJ zone' })).toBe('DJ zone');
    expect(centerDistance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
    const state = managerLayoutOpsFromBackend({ floorWalkChecks: [{ check_id: 'exits', status: 'verified' }], rainPlan: { active: 1 }, varianceEvidence: [{ id: 'v1', created_at: '2026-01-01', note: 'Moved', status: 'open', photo_url: null }] });
    expect(state.floorWalkChecks.exits).toBe(true);
    expect(state.rainPlanActive).toBe(true);
    expect(state.varianceEvidence).toHaveLength(1);
  });
});
