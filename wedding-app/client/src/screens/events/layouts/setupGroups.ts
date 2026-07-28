export type SetupGroupInput = {
  label: string;
  quantity: number;
  table?: { inventoryItemId: string; label: string; width: number; depth: number; shape: 'round' | 'rect' };
  chair?: { inventoryItemId: string; label: string; count: number };
  centerpiece?: { inventoryItemId: string; label: string };
  arrangement?: 'grid' | 'row' | 'arc';
};

export type SetupGroupResult = { items: any[]; reservations: Array<{ inventoryItemId: string; quantity: number }> };

/**
 * Copies an exemplar into independent, editable table setups. Inventory is counted
 * from the whole group, while each rendered copy can subsequently be changed alone.
 */
export function createIndependentSetupGroup(input: SetupGroupInput, startX = 180, startY = 180): SetupGroupResult {
  const quantity = Math.max(1, Math.floor(input.quantity)); const chairs = Math.max(0, Math.floor(input.chair?.count || 0));
  const stamp = Date.now(); const items: any[] = []; const reservations = new Map<string, number>();
  const reserve = (inventoryItemId: string | undefined, count: number) => { if (inventoryItemId) reservations.set(inventoryItemId, (reservations.get(inventoryItemId) || 0) + count); };
  for (let index = 0; index < quantity; index++) {
    const arrangement = input.arrangement || 'grid'; const angle = quantity > 1 ? (-Math.PI * .8) + (Math.PI * 1.6 * index) / (quantity - 1) : 0;
    const x = arrangement === 'row' ? startX + index * 140 : arrangement === 'arc' ? startX + 270 + Math.cos(angle) * 250 : startX + (index % 4) * 140;
    const y = arrangement === 'row' ? startY : arrangement === 'arc' ? startY + 180 + Math.sin(angle) * 150 : startY + Math.floor(index / 4) * 140;
    const table = input.table ? { id: `group-${stamp}-table-${index}`, type: input.table.shape === 'round' ? 'round_table' : 'rect_table', x, y, radius: input.table.shape === 'round' ? Math.max(24, input.table.width * 8 / 2) : undefined, width: input.table.shape === 'rect' ? input.table.width * 8 : undefined, height: input.table.shape === 'rect' ? input.table.depth * 8 : undefined, label: `${input.label} ${index + 1}`, inventoryItemId: input.table.inventoryItemId, rotation: 0 } : null;
    if (table) items.push(table);
    for (let chairIndex = 0; chairIndex < chairs; chairIndex++) { const angle = (Math.PI * 2 * chairIndex) / chairs - Math.PI / 2; const radius = (table?.radius || Math.max(table?.width || 60, table?.height || 40) / 2) + 22; items.push({ id: `group-${stamp}-chair-${index}-${chairIndex}`, type: 'chair', x: x + Math.cos(angle) * radius, y: y + Math.sin(angle) * radius, radius: 10, label: input.chair?.label || 'Chair', inventoryItemId: input.chair?.inventoryItemId }); }
    if (input.centerpiece) items.push({ id: `group-${stamp}-decor-${index}`, type: 'decor', x, y, label: input.centerpiece.label, width: 20, height: 20, shape: 'circle', color: '#fbcfe8', inventoryItemId: input.centerpiece.inventoryItemId });
  }
  reserve(input.table?.inventoryItemId, quantity); reserve(input.chair?.inventoryItemId, quantity * chairs); reserve(input.centerpiece?.inventoryItemId, quantity);
  return { items, reservations: [...reservations].map(([inventoryItemId, quantity]) => ({ inventoryItemId, quantity })) };
}
