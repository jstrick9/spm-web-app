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
export function extractDxfPaths(drawing: { entities?: any[]; header?: Record<string, any> }, idPrefix = `dxf-${Date.now()}`): DxfImportResult {
  const paths: ImportedDxfPath[] = [];
  const layers = new Set<string>();
  for (const [index, entity] of (drawing.entities ?? []).entries()) {
    const layer = entity.layer || undefined;
    if (layer) layers.add(layer);
    const common = { id: `${idPrefix}-${index}`, source: 'dxf' as const, layer, color: entity.color };
    if (entity.type === 'LINE' && entity.vertices?.length >= 2) {
      const [a, b] = entity.vertices;
      paths.push({ ...common, points: [a.x, a.y, b.x, b.y] });
    } else if ((entity.type === 'LWPOLYLINE' || entity.type === 'POLYLINE') && entity.vertices?.length >= 2) {
      const points = entity.vertices.flatMap((vertex: any) => [vertex.x, vertex.y]);
      if (entity.shape || entity.closed) points.push(entity.vertices[0].x, entity.vertices[0].y);
      paths.push({ ...common, points });
    } else if (entity.type === 'CIRCLE' && entity.center && entity.radius > 0) {
      paths.push({ ...common, points: arcPoints(entity.center, entity.radius, 0, 360) });
    } else if (entity.type === 'ARC' && entity.center && entity.radius > 0) {
      paths.push({ ...common, points: arcPoints(entity.center, entity.radius, entity.startAngle ?? 0, entity.endAngle ?? 360) });
    }
  }
  const rawUnits = drawing.header?.$INSUNITS;
  const unitCode = typeof rawUnits === 'number' ? rawUnits : rawUnits?.value;
  return { paths, layers: [...layers].sort(), units: INSUNITS[Number(unitCode)] };
}
