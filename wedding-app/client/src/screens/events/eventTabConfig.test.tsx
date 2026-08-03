import { describe, it, expect } from 'vitest';
import { TAB_DEFS, filterTabsForStage } from './eventTabConfig';

describe('filterTabsForStage', () => {
  it('hides staff, emergency, and portal for sales-stage events (lead/hold)', () => {
    for (const status of ['lead', 'hold']) {
      const visible = filterTabsForStage(TAB_DEFS, status);
      const ids = visible.map((t) => t.id);
      expect(ids).not.toContain('staff');
      expect(ids).not.toContain('emergency');
      expect(ids).not.toContain('portal');
      // Core planning surfaces stay available during sales.
      expect(ids).toContain('overview');
      expect(ids).toContain('timeline');
      expect(ids).toContain('guests');
      expect(ids).toContain('settings');
    }
  });

  it('keeps staff and portal hidden for booked events, shows them from planning', () => {
    const booked = filterTabsForStage(TAB_DEFS, 'booked').map((t) => t.id);
    expect(booked).not.toContain('staff');
    expect(booked).not.toContain('portal');

    const planning = filterTabsForStage(TAB_DEFS, 'planning').map((t) => t.id);
    expect(planning).toContain('staff');
    expect(planning).toContain('portal');
    expect(planning).not.toContain('emergency');
  });

  it('shows every tab for final_review, completed, and unknown statuses', () => {
    for (const status of ['final_review', 'completed', 'cancelled', 'lost', undefined, null, 'weird-status']) {
      const visible = filterTabsForStage(TAB_DEFS, status as string | null | undefined);
      expect(visible.map((t) => t.id).sort()).toEqual(TAB_DEFS.map((t) => t.id).sort());
    }
  });

  it('never removes the overview tab', () => {
    for (const status of ['lead', 'hold', 'booked', 'planning', 'final_review', 'completed']) {
      const visible = filterTabsForStage(TAB_DEFS, status);
      expect(visible.some((t) => t.id === 'overview')).toBe(true);
    }
  });
});
