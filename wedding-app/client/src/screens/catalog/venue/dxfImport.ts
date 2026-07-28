export type ImportedDxfPath = {
  id: string;
  points: number[];
  source: 'dxf';
  layer?: string;
  color?: number;
};

export type DxfImportResult = {
  paths: ImportedDxfPath[];
  units?: string;
  layers: string[];
};

const UNIT_METERS: Record<string, number> = { in: 0.0254, ft: 0.3048, mi: 1609.344, mm: 0.001, cm: 0.01, m: 1, km: 1000 };

const INSUNITS: Record<number, string> = {
  0: 'unitless', 1: 'in', 2: 'ft', 3: 'mi', 4: 'mm', 5: 'cm', 6: 'm', 7: 'km',
};

function arcPoints(center: { x: number; y: number }, radius: number, start: number, end: number) {
  // DXF angles are counter-clockwise degrees. Normalise a crossing arc (e.g. 350° → 10°).
  const startRadians = (start * Math.PI) / 180;
  let span = ((end - start) * Math.PI) / 180;
  if (span <= 0) span += Math.PI * 2;
  const segments = Math.max(4, Math.ceil((span / (Math.PI * 2)) * 24));
  const points: number[] = [];
  for (let step = 0; step <= segments; step++) {
    const angle = startRadians + (span * step) / segments;
    points.push(center.x + Math.cos(angle) * radius, center.y + Math.sin(angle) * radius);
  }
  return points;
}

/** Converts supported DXF reference geometry into canvas paths without changing its coordinates. */
export function extractDxfPaths(drawing: { entities?: any[]; blocks?: Record<string, any>; header?: Record<string, any> }, idPrefix = `dxf-${Date.now()}`, targetUnit?: 'ft' | 'm'): DxfImportResult {
  const paths: ImportedDxfPath[] = [];
  const rawUnits = drawing.header?.$INSUNITS; const unitCode = typeof rawUnits === 'number' ? rawUnits : rawUnits?.value; const sourceUnit = INSUNITS[Number(unitCode)]; const conversion = targetUnit && sourceUnit && UNIT_METERS[sourceUnit] ? UNIT_METERS[sourceUnit] / UNIT_METERS[targetUnit] : 1;
  const layers = new Set<string>();
  const expanded = (drawing.entities ?? []).flatMap((entity: any) => { if (entity.type !== 'INSERT') return [entity]; const block = drawing.blocks?.[entity.name]; if (!block?.entities) return []; const sx = entity.xScale ?? 1; const sy = entity.yScale ?? sx; const rotation = (entity.rotation ?? 0) * Math.PI / 180; const origin = entity.position ?? { x: 0, y: 0 }; return block.entities.map((child: any) => ({ ...child, layer: child.layer || entity.layer, vertices: child.vertices?.map((v: any) => ({ x: origin.x + (v.x * sx * Math.cos(rotation) - v.y * sy * Math.sin(rotation)), y: origin.y + (v.x * sx * Math.sin(rotation) + v.y * sy * Math.cos(rotation)) })), center: child.center ? { x: origin.x + (child.center.x * sx * Math.cos(rotation) - child.center.y * sy * Math.sin(rotation)), y: origin.y + (child.center.x * sx * Math.sin(rotation) + child.center.y * sy * Math.cos(rotation)) } : child.center, radius: child.radius ? child.radius * Math.max(Math.abs(sx), Math.abs(sy)) : child.radius })); });
  for (const [index, entity] of expanded.entries()) {
    const layer = entity.layer || undefined;
    if (layer) layers.add(layer);
    const common = { id: `${idPrefix}-${index}`, source: 'dxf' as const, layer, color: entity.color };
    if (entity.type === 'LINE' && entity.vertices?.length >= 2) {
      const [a, b] = entity.vertices;
      paths.push({ ...common, points: [a.x * conversion, a.y * conversion, b.x * conversion, b.y * conversion] });
    } else if ((entity.type === 'LWPOLYLINE' || entity.type === 'POLYLINE') && entity.vertices?.length >= 2) {
      const points = entity.vertices.flatMap((vertex: any) => [vertex.x * conversion, vertex.y * conversion]);
      if (entity.shape || entity.closed) points.push(entity.vertices[0].x * conversion, entity.vertices[0].y * conversion);
      paths.push({ ...common, points });
    } else if (entity.type === 'CIRCLE' && entity.center && entity.radius > 0) {
      paths.push({ ...common, points: arcPoints({ x: entity.center.x * conversion, y: entity.center.y * conversion }, entity.radius * conversion, 0, 360) });
    } else if (entity.type === 'ARC' && entity.center && entity.radius > 0) {
      paths.push({ ...common, points: arcPoints({ x: entity.center.x * conversion, y: entity.center.y * conversion }, entity.radius * conversion, entity.startAngle ?? 0, entity.endAngle ?? 360) });
    }
  }
  return { paths, layers: [...layers].sort(), units: sourceUnit };
}
