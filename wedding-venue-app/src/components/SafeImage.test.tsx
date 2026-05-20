import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SafeImage } from './SafeImage';

describe('SafeImage', () => {
  it('renders fallback when no valid image source exists', () => {
    render(
      <SafeImage
        src=""
        alt="Test image"
        fallback={<div>Fallback content</div>}
      />,
    );

    expect(screen.getByText('Fallback content')).toBeInTheDocument();
  });

  it('renders an img element when a valid source exists', () => {
    render(
      <SafeImage
        src="https://example.com/test.png"
        alt="Test image"
      />,
    );

    const img = screen.getByRole('img', { name: 'Test image' });
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', 'https://example.com/test.png');
  });

  it('falls back after image load error', () => {
    render(
      <SafeImage
        src="https://example.com/broken.png"
        alt="Broken image"
        fallback={<div>Broken fallback</div>}
      />,
    );

    const img = screen.getByRole('img', { name: 'Broken image' });
    fireEvent.error(img);

    expect(screen.getByText('Broken fallback')).toBeInTheDocument();
  });

  it('uses the first valid image from images collection when src is absent', () => {
    render(
      <SafeImage
        alt="Gallery image"
        images={[
          { id: '1', url: '', label: 'Bad image' },
          { id: '2', url: 'https://example.com/gallery.png', label: 'Good image' },
        ]}
      />,
    );

    const img = screen.getByRole('img', { name: 'Gallery image' });
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', 'https://example.com/gallery.png');
  });
});