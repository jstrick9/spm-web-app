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

it('adds service and operational guidance to reception, ceremony, and tent packages', () => {
  expect(generateWeddingPackage('reception', 80, 0, 'buffet_stations').some((item) => item.vendorName === 'Buffet / stations')).toBe(true);
  expect(generateWeddingPackage('ceremony', 40).filter((item) => item.reserved).length).toBe(8);
  const tent = generateWeddingPackage('tent', 80);
  expect(tent.some((item) => item.type === 'power_outlet')).toBe(true);
  expect(tent.some((item) => item.vendorName === 'Tent loading / generator')).toBe(true);
});
