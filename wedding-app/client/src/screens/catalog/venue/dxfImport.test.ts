import { describe, expect, it } from 'vitest';
import { extractDxfPaths } from './dxfImport';

describe('extractDxfPaths', () => {
  it('preserves DXF units and layer metadata while importing line and closed polylines', () => {
    const result = extractDxfPaths({
      header: { $INSUNITS: 6 },
      entities: [
        { type: 'LINE', layer: 'Walls', color: 1, vertices: [{ x: 1, y: 2 }, { x: 3, y: 4 }] },
        { type: 'LWPOLYLINE', layer: 'Furniture', closed: true, vertices: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 5 }] },
      ],
    }, 'fixture');
    expect(result.units).toBe('m');
    expect(result.layers).toEqual(['Furniture', 'Walls']);
    expect(result.paths[0]).toMatchObject({ layer: 'Walls', color: 1, points: [1, 2, 3, 4] });
    expect(result.paths[1].points).toEqual([0, 0, 10, 0, 10, 5, 0, 0]);
  });

  it('approximates circles and crossing arcs as usable canvas paths', () => {
    const result = extractDxfPaths({ entities: [
      { type: 'CIRCLE', center: { x: 5, y: 5 }, radius: 5 },
      { type: 'ARC', center: { x: 0, y: 0 }, radius: 10, startAngle: 350, endAngle: 10 },
    ] }, 'fixture');
    expect(result.paths).toHaveLength(2);
    expect(result.paths[0].points[0]).toBeCloseTo(10);
    expect(result.paths[0].points[1]).toBeCloseTo(5);
    expect(result.paths[0].points[result.paths[0].points.length - 2]).toBeCloseTo(10);
    expect(result.paths[0].points[result.paths[0].points.length - 1]).toBeCloseTo(5);
    const arc = result.paths[1].points;
    expect(arc[0]).toBeCloseTo(9.848, 2);
    expect(arc[arc.length - 1]).toBeCloseTo(1.736, 2);
  });
});

it('expands INSERT blocks into editable transformed geometry', () => {
  const result = extractDxfPaths({ blocks: { TABLE: { entities: [{ type: 'LINE', vertices: [{ x: 0, y: 0 }, { x: 10, y: 0 }] }] } }, entities: [{ type: 'INSERT', name: 'TABLE', position: { x: 5, y: 7 }, xScale: 2, yScale: 2 }] }, 'block');
  expect(result.paths[0].points).toEqual([5, 7, 25, 7]);
});

it('automatically converts DXF units to the venue unit system', () => {
  const result = extractDxfPaths({ header: { $INSUNITS: 6 }, entities: [{ type: 'LINE', vertices: [{ x: 0, y: 0 }, { x: 3, y: 0 }] }] }, 'units', 'ft');
  expect(result.paths[0].points[2]).toBeCloseTo(9.84252, 4);
});
