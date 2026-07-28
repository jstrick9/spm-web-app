export type LayoutPaletteCategory = 'tables' | 'chairs' | 'decor' | 'service' | 'ceremony';

export type LayoutPaletteItem = {
  category: LayoutPaletteCategory;
  label: string;
  type: 'round_table' | 'rect_table' | 'chair' | 'decor' | 'dance_floor' | 'vendor_zone';
  props: Record<string, unknown>;
};

/** Plain-language, wedding-specific starting objects for couples and planners. */
export const LAYOUT_OBJECT_PALETTE: LayoutPaletteItem[] = [
  { category: 'tables', label: 'Round guest table', type: 'round_table', props: { radius: 40, seats: 8 } },
  { category: 'tables', label: 'Long banquet table', type: 'rect_table', props: { width: 140, height: 54, seats: 10 } },
  { category: 'tables', label: 'Sweetheart table', type: 'rect_table', props: { width: 84, height: 42, seats: 2 } },
  { category: 'chairs', label: 'Guest chair', type: 'chair', props: { radius: 10 } },
  { category: 'chairs', label: 'Ceremony chair', type: 'chair', props: { radius: 10, ceremonySeat: true } },
  { category: 'decor', label: 'Floral centerpiece', type: 'decor', props: { width: 20, height: 20, shape: 'circle', color: '#fbcfe8' } },
  { category: 'decor', label: 'Welcome sign', type: 'decor', props: { width: 48, height: 28, shape: 'rect', color: '#fef3c7' } },
  { category: 'decor', label: 'Ceremony arch', type: 'decor', props: { width: 100, height: 26, shape: 'rect', color: '#dcfce7' } },
  { category: 'service', label: 'Dance floor', type: 'dance_floor', props: { width: 160, height: 160 } },
  { category: 'service', label: 'Bar service area', type: 'vendor_zone', props: { width: 150, height: 70, vendorName: 'Bar service' } },
  { category: 'service', label: 'Stage / DJ area', type: 'vendor_zone', props: { width: 160, height: 80, vendorName: 'Stage / DJ' } },
  { category: 'ceremony', label: 'Aisle runner', type: 'decor', props: { width: 42, height: 220, shape: 'rect', color: '#f3f4f6' } },
  { category: 'ceremony', label: 'Ceremony focal point', type: 'decor', props: { width: 120, height: 50, shape: 'rect', color: '#e0e7ff' } },
];

export const LAYOUT_PALETTE_CATEGORIES: Array<{ id: LayoutPaletteCategory; label: string }> = [
  { id: 'tables', label: 'Tables' }, { id: 'chairs', label: 'Chairs' }, { id: 'decor', label: 'Decor' }, { id: 'service', label: 'Service' }, { id: 'ceremony', label: 'Ceremony' },
];
