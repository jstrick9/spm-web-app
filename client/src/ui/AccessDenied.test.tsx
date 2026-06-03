/**
 * AccessDenied component tests
 *
 * Covers:
 *   • Renders with generic message when no feature prop given
 *   • Renders with feature-specific message when feature prop given
 *   • Has role="alert" and aria-live="polite" for screen readers
 *   • ShieldOff icon is aria-hidden (decorative)
 *   • Custom className is applied
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AccessDenied } from './AccessDenied';

describe('AccessDenied', () => {
  it('renders with generic message when no feature specified', () => {
    render(<AccessDenied />);
    expect(screen.getByText('Access Restricted')).toBeTruthy();
    expect(screen.getByText(/Contact your venue administrator/)).toBeTruthy();
  });

  it('renders feature-specific heading and message', () => {
    render(<AccessDenied feature="Budget" />);
    expect(screen.getByText(/Budget — Access Restricted/)).toBeTruthy();
    expect(screen.getAllByText(/Budget/).length).toBeGreaterThan(0);
  });

  it('has role="alert" for screen reader announcement', () => {
    render(<AccessDenied />);
    const alert = screen.getByRole('alert');
    expect(alert).toBeTruthy();
  });

  it('has aria-live="polite" on the alert container', () => {
    render(<AccessDenied />);
    const alert = screen.getByRole('alert');
    expect(alert.getAttribute('aria-live')).toBe('polite');
  });

  it('icon is aria-hidden (decorative)', () => {
    const { container } = render(<AccessDenied />);
    const iconWrapper = container.querySelector('[aria-hidden="true"]');
    expect(iconWrapper).toBeTruthy();
  });

  it('applies custom className', () => {
    const { container } = render(<AccessDenied className="min-h-[500px]" />);
    const root = container.firstChild as HTMLElement;
    expect(root.className).toContain('min-h-[500px]');
  });
});
