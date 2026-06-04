import { describe, expect, it } from 'vitest';
import { getTableSpecs, setTableSpecs } from './useLayoutState';

describe('Seating template persistence (localStorage)', () => {
  it('persists and reloads seating templates with row settings', () => {
    const seatingTemplate = {
      id: 'seat-template-1',
      name: 'Ceremony Seating Pack',
      shape: 'rectangle' as const,
      width: 10,
      height: 4,
      capacity: 12,
      color: '#e5e7eb',
      inventoryCount: 20,
      isSeatingType: true,
      seatingStyle: 'straight-row' as const,
      seatingRowCount: 4,
      seatingRowSpacing: 3,
      defaultChairType: 'white-plastic' as any,
      defaultChairLayout: 'all-sides' as const,
      venueCategories: ['ceremony' as const],
    };

    setTableSpecs([seatingTemplate]);

    const loaded = getTableSpecs();
    expect(loaded).toHaveLength(1);
    expect(loaded[0]).toMatchObject({
      id: 'seat-template-1',
      isSeatingType: true,
      seatingRowCount: 4,
      seatingRowSpacing: 3,
      venueCategories: ['ceremony'],
    });
  });
});
