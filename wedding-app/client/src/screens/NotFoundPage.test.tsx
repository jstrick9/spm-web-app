import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NotFoundPage } from './NotFoundPage';

describe('NotFoundPage', () => {
  it('renders the 404 heading', () => {
    render(<NotFoundPage />);
    expect(screen.getByText('Page Not Found')).toBeTruthy();
  });

  it('has a Go Back button', () => {
    render(<NotFoundPage />);
    expect(screen.getByText('Go Back')).toBeTruthy();
  });

  it('has a Dashboard link', () => {
    render(<NotFoundPage />);
    expect(screen.getByText('Dashboard')).toBeTruthy();
  });

  it('shows a helpful description', () => {
    render(<NotFoundPage />);
    expect(screen.getByText(/doesn't exist or has been moved/)).toBeTruthy();
  });
});
