import { describe, expect, it, vi, beforeEach } from 'vitest';
import { checkFixtureCollision, getFixtureBoundingBox, boxesOverlap } from './collisionDetection';

vi.mock('../hooks/useLayoutState', () => ({
  getFixtureTypes: vi.fn(() => [
    { id: 'venue-fixture', width: 10, height: 10, category: 'venue', isExterior: false },
    { id: 'lodging-fixture', width: 10, height: 10, category: 'lodging', isExterior: false },
    { id: 'exterior-fixture', width: 10, height: 10, category: 'exterior', isExterior: true },
  ]),
  getTableSpecs: vi.fn(() => []),
}));

vi.mock('../data/venueData', () => ({
  getSpacingSettings: vi.fn(() => ({
    enableCollisionDetection: true,
    minFixtureSpacing: 4,
    minWallSpacing: 3,
    minTableSpacing: 3,
  })),
  getChairSpecs: vi.fn(() => []),
}));

describe('collisionDetection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('applies fixture spacing only to venue fixtures', () => {
    const venueBox = getFixtureBoundingBox({ id: 'a', x: 10, y: 10, specId: 'venue-fixture' } as any);
    const lodgingBox = getFixtureBoundingBox({ id: 'b', x: 10, y: 10, specId: 'lodging-fixture' } as any);
    const exteriorBox = getFixtureBoundingBox({ id: 'c', x: 10, y: 10, specId: 'exterior-fixture' } as any);

    expect(venueBox.width).toBe(14);
    expect(venueBox.height).toBe(14);

    expect(lodgingBox.width).toBe(10);
    expect(lodgingBox.height).toBe(10);

    expect(exteriorBox.width).toBe(10);
    expect(exteriorBox.height).toBe(10);
  });

  it('does not enforce wall spacing for lodging fixtures', () => {
    const result = checkFixtureCollision(
      { x: 0, y: 0, specId: 'lodging-fixture' },
      [],
      [],
      { id: 'v1', width: 40, height: 40 } as any
    );

    expect(result.collides).toBe(false);
    expect(result.wallError).toBe('');
  });

  it('detects overlap correctly with epsilon-safe comparison', () => {
    expect(boxesOverlap({ x: 0, y: 0, width: 10, height: 10 }, { x: 5, y: 5, width: 5, height: 5 })).toBe(true);
    expect(boxesOverlap({ x: 0, y: 0, width: 10, height: 10 }, { x: 10.01, y: 0, width: 5, height: 5 })).toBe(false);
  });
});
