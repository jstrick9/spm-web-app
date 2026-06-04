import type { DrawingObject, ImageItem, Point } from '../types';

export function normalizeRenderableDimension(
  value: unknown,
  fallback = 1,
  min = 0.1,
): number {
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(min, num);
}

export function isRenderableImageUrl(url: unknown): url is string {
  if (typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed) return false;

  return (
    trimmed.startsWith('data:image/') ||
    trimmed.startsWith('blob:') ||
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('/')
  );
}

export function sanitizeRenderableImageItems(images: unknown): ImageItem[] {
  if (!Array.isArray(images)) return [];

  const seen = new Set<string>();

  return images
    .map((img, index) => ({
      id: String((img as { id?: unknown })?.id || `img-${index + 1}`).trim(),
      url: String((img as { url?: unknown })?.url || '').trim(),
      label: String((img as { label?: unknown })?.label || '').trim(),
    }))
    .filter((img) => isRenderableImageUrl(img.url))
    .filter((img) => {
      if (seen.has(img.id)) return false;
      seen.add(img.id);
      return true;
    });
}

export function getFirstRenderableImage(
  imageUrl?: string,
  images?: ImageItem[],
): ImageItem | null {
  if (isRenderableImageUrl(imageUrl)) {
    return { id: 'primary', url: imageUrl, label: '' };
  }

  const sanitized = sanitizeRenderableImageItems(images);
  return sanitized[0] || null;
}

export function sanitizeRenderablePoints(points: unknown): Point[] {
  if (!Array.isArray(points)) return [];

  return points
    .map((p) => ({
      x: normalizeRenderableDimension((p as { x?: unknown })?.x, 0, 0),
      y: normalizeRenderableDimension((p as { y?: unknown })?.y, 0, 0),
    }))
    .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
}

export function isRenderablePolygon(points: unknown, minPoints = 3): boolean {
  return sanitizeRenderablePoints(points).length >= minPoints;
}

export function isRenderableSvgPath(path: unknown): path is string {
  return typeof path === 'string' && path.trim().length > 0;
}

export function sanitizeDrawingObjects(objects: unknown): DrawingObject[] {
  if (!Array.isArray(objects)) return [];

  return objects.filter((obj) => {
    if (!obj || typeof obj !== 'object') return false;
    const candidate = obj as DrawingObject;
    if (!candidate.id || !candidate.type) return false;
    return true;
  }) as DrawingObject[];
}

export function isRenderableCustomDrawing(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;

  const drawing = value as {
    objects?: unknown;
    drawingWidth?: unknown;
    drawingHeight?: unknown;
  };

  return (
    sanitizeDrawingObjects(drawing.objects).length > 0 &&
    normalizeRenderableDimension(drawing.drawingWidth, 0, 0) > 0 &&
    normalizeRenderableDimension(drawing.drawingHeight, 0, 0) > 0
  );
}