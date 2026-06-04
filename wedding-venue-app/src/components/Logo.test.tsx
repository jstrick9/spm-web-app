import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Logo from './Logo';

describe('Logo', () => {
  it('renders fallback initials when no url is provided', () => {
    render(<Logo />);
    expect(screen.getByText('7P')).toBeInTheDocument();
  });

  it('renders an image when url is provided', () => {
    render(<Logo url="https://example.com/logo.png" />);
    const img = screen.getByRole('img', { name: /seven paths manor/i });
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', 'https://example.com/logo.png');
  });

  it('falls back to initials when image fails to load', () => {
    render(<Logo url="https://example.com/broken-logo.png" />);
    const img = screen.getByRole('img', { name: /seven paths manor/i });

    fireEvent.error(img);

    expect(screen.getByText('7P')).toBeInTheDocument();
  });
});