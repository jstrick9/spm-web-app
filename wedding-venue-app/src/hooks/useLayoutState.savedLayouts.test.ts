import { beforeEach, describe, expect, it } from 'vitest';
import { getSavedLayouts, setSavedLayouts } from './useLayoutState';

describe('saved layout persistence', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('loads legacy raw saved layouts and normalizes missing decor', () => {
    localStorage.setItem(
      'spm_savedLayouts',
      JSON.stringify([
        {
          id: 'saved-1',
          name: 'Legacy Layout',
          venueId: 'venue-1',
          tables: [],
          fixtures: [],
          guests: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ]),
    );

    const layouts = getSavedLayouts();

    expect(layouts).toHaveLength(1);
    expect(layouts[0].id).toBe('saved-1');
    expect(layouts[0].decor).toEqual([]);
  });

  it('stores saved layouts through the versioned collaboration layer', () => {
    setSavedLayouts([
      {
        id: 'saved-2',
        name: 'Modern Layout',
        venueId: 'venue-2',
        tables: [],
        fixtures: [],
        decor: [],
        guests: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ]);

    const stored = JSON.parse(localStorage.getItem('spm_savedLayouts') || 'null');

    expect(stored.version).toBe(3);
    expect(Array.isArray(stored.data)).toBe(true);
    expect(stored.data[0].id).toBe('saved-2');
    expect(stored.data[0].revision).toBe(1);
  });

  it('round-trips saved layout decor', () => {
    setSavedLayouts([
      {
        id: 'saved-3',
        name: 'Decor Layout',
        venueId: 'venue-3',
        tables: [],
        fixtures: [],
        decor: [
          {
            id: 'decor-1',
            decorItemId: 'item-1',
            x: 10,
            y: 12,
            rotation: 0,
            scaleX: 1,
            scaleY: 1,
            opacity: 1,
            zIndex: 100,
            parentType: 'canvas',
          },
        ],
        guests: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ]);

    const layouts = getSavedLayouts();

    expect(layouts).toHaveLength(1);
    expect(layouts[0].decor).toHaveLength(1);
    expect(layouts[0].decor[0].decorItemId).toBe('item-1');
  });
});