import { describe, expect, it } from 'vitest';
import {
  getFirstRenderableImage,
  isRenderableCustomDrawing,
  isRenderableImageUrl,
  isRenderablePolygon,
  isRenderableSvgPath,
  normalizeRenderableDimension,
  sanitizeRenderableImageItems,
  sanitizeRenderablePoints,
} from './renderGuards';

describe('render guards', () => {
  it('normalizes invalid dimensions', () => {
    expect(normalizeRenderableDimension(undefined, 5)).toBe(5);
    expect(normalizeRenderableDimension(-10, 5)).toBeGreaterThan(0);
    expect(normalizeRenderableDimension(12, 5)).toBe(12);
  });

  it('accepts valid image urls and rejects invalid ones', () => {
    expect(isRenderableImageUrl('data:image/png;base64,abc')).toBe(true);
    expect(isRenderableImageUrl('https://example.com/image.png')).toBe(true);
    expect(isRenderableImageUrl('/assets/logo.png')).toBe(true);
    expect(isRenderableImageUrl('')).toBe(false);
    expect(isRenderableImageUrl(undefined)).toBe(false);
  });

  it('sanitizes image collections', () => {
    const items = sanitizeRenderableImageItems([
      { id: 'a', url: 'https://example.com/a.png', label: 'A' },
      { id: 'a', url: 'https://example.com/b.png', label: 'Duplicate id' },
      { id: 'c', url: '', label: 'Bad' },
    ]);

    expect(items).toHaveLength(1);
    expect(items[0].id).toBe('a');
  });

  it('returns the first renderable image', () => {
    expect(getFirstRenderableImage('https://example.com/logo.png', [])?.url).toBe(
      'https://example.com/logo.png',
    );

    expect(
      getFirstRenderableImage(undefined, [
        { id: '1', url: '', label: 'bad' },
        { id: '2', url: 'https://example.com/ok.png', label: 'ok' },
      ])?.url,
    ).toBe('https://example.com/ok.png');
  });

  it('sanitizes points and validates polygons', () => {
    const points = sanitizeRenderablePoints([
      { x: 10, y: 10 },
      { x: 20, y: 10 },
      { x: 20, y: 20 },
    ]);

    expect(points).toHaveLength(3);
    expect(isRenderablePolygon(points)).toBe(true);
    expect(isRenderablePolygon([{ x: 0, y: 0 }, { x: 1, y: 1 }])).toBe(false);
  });

  it('validates svg paths', () => {
    expect(isRenderableSvgPath('M 0 0 L 10 10 Z')).toBe(true);
    expect(isRenderableSvgPath('')).toBe(false);
    expect(isRenderableSvgPath(undefined)).toBe(false);
  });

  it('validates custom drawings', () => {
    expect(
      isRenderableCustomDrawing({
        objects: [{ id: 'o1', type: 'rect' }],
        drawingWidth: 100,
        drawingHeight: 80,
      }),
    ).toBe(true);

    expect(
      isRenderableCustomDrawing({
        objects: [],
        drawingWidth: 100,
        drawingHeight: 80,
      }),
    ).toBe(false);
  });
});