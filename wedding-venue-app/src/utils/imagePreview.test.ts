import { describe, expect, it } from 'vitest';
import {
  clearImagePreview,
  createImagePreview,
} from './imagePreview';

describe('imagePreview helpers', () => {
  it('creates a preview state object', () => {
    const preview = createImagePreview('https://example.com/image.png', 'Sample');

    expect(preview).toEqual({
      url: 'https://example.com/image.png',
      title: 'Sample',
    });
  });

  it('clears the preview state', () => {
    expect(clearImagePreview()).toBeNull();
  });
});