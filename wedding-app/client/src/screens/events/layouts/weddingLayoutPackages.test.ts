import { describe, expect, it } from 'vitest';
import { generateWeddingPackage, WEDDING_LAYOUT_PACKAGES } from './weddingLayoutPackages';

describe('wedding layout packages', () => {
  it('offers all wedding moments and creates an editable reception proposal with seating', () => {
    expect(WEDDING_LAYOUT_PACKAGES).toHaveLength(8);
    const proposal = generateWeddingPackage('reception', 100);
    expect(proposal.filter((item) => item.type === 'round_table')).toHaveLength(13);
    expect(proposal.filter((item) => item.type === 'chair')).toHaveLength(104);
    expect(proposal.some((item) => item.type === 'dance_floor')).toBe(true);
    expect(proposal.some((item) => item.vendorName === 'Bar service')).toBe(true);
  });
});
