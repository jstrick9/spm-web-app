import { describe, expect, it } from 'vitest';
import { createIndependentSetupGroup } from './setupGroups';

describe('independent event setup groups', () => {
  it('duplicates an exemplar while totaling table, chair, and centerpiece inventory', () => {
    const result = createIndependentSetupGroup({ label: 'Ceremony round', quantity: 10, table: { inventoryItemId: 'table-6-round', label: '6-foot round', width: 6, depth: 6, shape: 'round' }, chair: { inventoryItemId: 'chair-gold', label: 'Gold chair', count: 8 }, centerpiece: { inventoryItemId: 'floral-white', label: 'White floral centerpiece' } });
    expect(result.items.filter((item) => item.type === 'round_table')).toHaveLength(10);
    expect(result.items.filter((item) => item.type === 'chair')).toHaveLength(80);
    expect(result.items.filter((item) => item.type === 'decor')).toHaveLength(10);
    expect(result.reservations).toEqual(expect.arrayContaining([{ inventoryItemId: 'table-6-round', quantity: 10 }, { inventoryItemId: 'chair-gold', quantity: 80 }, { inventoryItemId: 'floral-white', quantity: 10 }]));
    expect(new Set(result.items.filter((item) => item.type === 'round_table').map((item) => item.id)).size).toBe(10);
  });
});
