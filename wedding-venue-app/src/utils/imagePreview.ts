export interface ImagePreviewState {
  url: string;
  title: string;
}

export function createImagePreview(
  url: string,
  title: string,
): ImagePreviewState {
  return { url, title };
}

export function clearImagePreview(): null {
  return null;
}