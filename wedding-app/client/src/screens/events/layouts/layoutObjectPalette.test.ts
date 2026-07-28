import { describe, expect, it } from 'vitest';
import { LAYOUT_OBJECT_PALETTE, LAYOUT_PALETTE_CATEGORIES } from './layoutObjectPalette';

describe('wedding layout object palette', () => {
  it('offers plain-language objects across every core wedding-design category', () => {
    expect(LAYOUT_PALETTE_CATEGORIES.map((category) => category.id)).toEqual(['tables', 'chairs', 'decor', 'service', 'ceremony']);
    expect(LAYOUT_OBJECT_PALETTE.filter((item) => item.category === 'tables').map((item) => item.label)).toContain('Round guest table');
    expect(LAYOUT_OBJECT_PALETTE.some((item) => item.label === 'Bar service area')).toBe(true);
    expect(LAYOUT_OBJECT_PALETTE.some((item) => item.label === 'Ceremony arch')).toBe(true);
  });
});
