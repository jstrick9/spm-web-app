export type WeddingLayoutPackage = 'ceremony' | 'cocktail' | 'reception' | 'tent' | 'rehearsal' | 'welcome' | 'brunch' | 'after_party';

export const WEDDING_LAYOUT_PACKAGES: Array<{ id: WeddingLayoutPackage; label: string; description: string }> = [
  { id: 'ceremony', label: 'Ceremony seating', description: 'Aisle, focal point, guest chairs, and reserved front rows.' },
  { id: 'cocktail', label: 'Cocktail hour', description: 'Bars, high-top tables, food stations, and circulation.' },
  { id: 'reception', label: 'Reception essentials', description: 'Guest tables, chairs, dance floor, sweetheart table, bar, and DJ.' },
  { id: 'tent', label: 'Outdoor / tent', description: 'Tent footprint, reception essentials, service, and weather staging.' },
  { id: 'rehearsal', label: 'Rehearsal dinner', description: 'Communal dining, welcome table, and presentation area.' },
  { id: 'welcome', label: 'Welcome party', description: 'Cocktail tables, bar, lounge, and guest arrival.' },
  { id: 'brunch', label: 'Farewell brunch', description: 'Brunch tables, buffet, coffee station, and guest flow.' },
  { id: 'after_party', label: 'After-party', description: 'Lounge, bar, DJ, and late-night service area.' },
];

const id = (prefix: string, index: number) => `${prefix}-${Date.now()}-${index}`;
const chairRing = (table: any, seats: number, prefix: string) => Array.from({ length: seats }, (_, index) => {
  const angle = (Math.PI * 2 * index) / seats - Math.PI / 2; const radius = (table.radius || 40) + 20;
  return { id: id(`${prefix}-chair`, index), type: 'chair', x: table.x + Math.cos(angle) * radius, y: table.y + Math.sin(angle) * radius, radius: 10, label: '' };
});

/** Generates editable proposal objects; it never mutates venue-owned structure. */
export function generateWeddingPackage(kind: WeddingLayoutPackage, guestCount: number, startIndex = 0, serviceStyle = 'plated'): any[] {
  const guests = Math.max(1, Math.round(guestCount || 100)); const objects: any[] = [];
  const tableCount = Math.ceil(guests / 8);
  const addTableGrid = (count: number, prefix: string) => {
    for (let index = 0; index < count; index++) {
      const table = { id: id(`${prefix}-table`, startIndex + index), type: 'round_table', x: 170 + (index % 4) * 130, y: 160 + Math.floor(index / 4) * 135, radius: 40, label: `Table ${index + 1}`, seats: 8, rotation: 0 };
      objects.push(table, ...chairRing(table, 8, `${prefix}-${index}`));
    }
  };
  if (kind === 'ceremony') {
    objects.push({ id: id('ceremony-aisle', 0), type: 'decor', x: 400, y: 320, label: 'Accessible ceremony aisle', width: 44, height: 300, shape: 'rect', color: '#f3f4f6' }, { id: id('ceremony-arch', 0), type: 'decor', x: 400, y: 90, label: 'Ceremony focal point', width: 130, height: 34, shape: 'rect', color: '#dcfce7' }, { id: id('ceremony-musicians', 0), type: 'vendor_zone', vendorName: 'Musicians / sound', x: 640, y: 110, width: 110, height: 55, rotation: 0 });
    for (let index = 0; index < guests; index++) objects.push({ id: id('ceremony-chair', index), type: 'chair', x: 270 + (index % 2) * 260 + (Math.floor(index / 2) % 7) * 27, y: 170 + Math.floor(index / 14) * 38, radius: 10, label: index < 8 ? 'Reserved ceremony chair' : 'Ceremony chair', reserved: index < 8 });
  } else if (kind === 'cocktail' || kind === 'welcome' || kind === 'after_party') {
    objects.push({ id: id('bar', 0), type: 'vendor_zone', vendorName: 'Bar service', x: 130, y: 110, width: 150, height: 70, rotation: 0 }, { id: id('lounge', 0), type: 'decor', x: 600, y: 170, label: 'Lounge', width: 140, height: 70, shape: 'rect', color: '#e0e7ff' });
    for (let index = 0; index < Math.ceil(guests / 20); index++) objects.push({ id: id('high-top', index), type: 'round_table', x: 190 + (index % 4) * 140, y: 320 + Math.floor(index / 4) * 110, radius: 25, label: `Cocktail ${index + 1}`, seats: 4, rotation: 0 });
    if (kind === 'after_party') objects.push({ id: id('dj', 0), type: 'vendor_zone', vendorName: 'DJ / late-night service', x: 590, y: 390, width: 150, height: 70, rotation: 0 });
  } else if (kind === 'rehearsal' || kind === 'brunch') {
    objects.push({ id: id('communal', 0), type: 'rect_table', x: 400, y: 260, width: 420, height: 62, label: kind === 'brunch' ? 'Brunch tables' : 'Communal dinner table', rotation: 0, seats: guests }, { id: id('service', 0), type: 'vendor_zone', vendorName: kind === 'brunch' ? 'Buffet / coffee' : 'Welcome service', x: 400, y: 410, width: 180, height: 65, rotation: 0 });
  } else {
    addTableGrid(tableCount, kind === 'tent' ? 'tent' : 'reception');
    objects.push({ id: id('dance', 0), type: 'dance_floor', x: 620, y: 430, width: 160, height: 160, label: 'Dance Floor', rotation: 0 }, { id: id('sweetheart', 0), type: 'rect_table', x: 620, y: 95, width: 88, height: 42, label: 'Sweetheart Table', rotation: 0, seats: 2 }, { id: id('bar', 0), type: 'vendor_zone', vendorName: 'Bar service', x: 120, y: 90, width: 150, height: 70, rotation: 0 }, { id: id('dj', 0), type: 'vendor_zone', vendorName: 'DJ / Stage', x: 650, y: 600, width: 150, height: 70, rotation: 0 }, { id: id('cake', 0), type: 'decor', x: 720, y: 170, label: 'Cake / dessert table', width: 70, height: 35, shape: 'rect', color: '#fef3c7' });
    if (serviceStyle === 'buffet_stations') objects.push({ id: id('buffet', 0), type: 'vendor_zone', vendorName: 'Buffet / stations', x: 180, y: 600, width: 250, height: 65, rotation: 0 });
    if (serviceStyle === 'family_style') objects.push({ id: id('family-service', 0), type: 'vendor_zone', vendorName: 'Family-style service staging', x: 180, y: 600, width: 200, height: 60, rotation: 0 });
    if (kind === 'tent') objects.push({ id: id('tent', 0), type: 'decor', x: 400, y: 350, label: 'Tent boundary', width: 740, height: 540, shape: 'rect', color: '#f8fafc', opacity: .2 }, { id: id('tent-power', 0), type: 'power_outlet', x: 90, y: 570, width: 16, height: 16, color: '#f59e0b', capacity: 120 }, { id: id('tent-loading', 0), type: 'vendor_zone', vendorName: 'Tent loading / generator', x: 90, y: 650, width: 150, height: 55, rotation: 0 });
  }
  return objects;
}
