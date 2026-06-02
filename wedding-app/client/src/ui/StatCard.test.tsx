/**
 * StatCard tests — Phase 33
 *
 * Covers all new functionality added in Phase 33:
 *   • role="status" on value node
 *   • aria-live="polite" on value node
 *   • aria-atomic="true" on value node
 *   • aria-label combines label + value when both are strings
 *   • loading prop shows Skeleton, hides value
 *   • trend icon is aria-hidden (decorative)
 *   • benchmark renders correctly
 *   • rightSlot renders correctly
 *   • className applied to Card
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatCard } from './StatCard';

describe('StatCard', () => {
  // ── Core rendering ───────────────────────────────────────────────────────
  it('renders label and value', () => {
    render(<StatCard label="Total Events" value="42" />);
    expect(screen.getByText('Total Events')).toBeTruthy();
    expect(screen.getByText('42')).toBeTruthy();
  });

  it('renders description when provided', () => {
    render(<StatCard label="Budget" value="$10,000" description="planned amount" />);
    expect(screen.getByText('planned amount')).toBeTruthy();
  });

  // ── Accessibility: role="status" (Phase 33 fix) ──────────────────────────
  it('has role="status" on the value container', () => {
    render(<StatCard label="Revenue" value="$50,000" />);
    const statusEl = screen.getByRole('status');
    expect(statusEl).toBeTruthy();
    expect(statusEl.textContent).toContain('$50,000');
  });

  it('has aria-live="polite" on the value container', () => {
    render(<StatCard label="Revenue" value="$50,000" />);
    const statusEl = screen.getByRole('status');
    expect(statusEl.getAttribute('aria-live')).toBe('polite');
  });

  it('has aria-atomic="true" on the value container', () => {
    render(<StatCard label="Revenue" value="$50,000" />);
    const statusEl = screen.getByRole('status');
    expect(statusEl.getAttribute('aria-atomic')).toBe('true');
  });

  it('sets aria-label to "label: value" when both are strings', () => {
    render(<StatCard label="Guests" value="120" />);
    const statusEl = screen.getByRole('status');
    expect(statusEl.getAttribute('aria-label')).toBe('Guests: 120');
  });

  it('uses ariaLabel override when provided', () => {
    render(<StatCard label="Budget" value={42} ariaLabel="Total budget 42 dollars" />);
    const statusEl = screen.getByRole('status');
    expect(statusEl.getAttribute('aria-label')).toBe('Total budget 42 dollars');
  });

  it('does not set aria-label when label is not a string (ReactNode)', () => {
    render(<StatCard label={<span>Budget</span>} value="$10K" />);
    const statusEl = screen.getByRole('status');
    // aria-label should be absent (computed label would be undefined)
    expect(statusEl.getAttribute('aria-label')).toBeNull();
  });

  // ── Loading state ────────────────────────────────────────────────────────
  it('shows Skeleton when loading=true', () => {
    const { container } = render(<StatCard label="Revenue" value="$100K" loading />);
    // Skeleton renders a div with animate-pulse or similar — value text hidden
    expect(screen.queryByText('$100K')).toBeNull();
    // The role="status" container should still be present (for AT continuity)
    expect(screen.getByRole('status')).toBeTruthy();
  });

  it('shows value when loading=false (default)', () => {
    render(<StatCard label="Revenue" value="$100K" />);
    expect(screen.getByText('$100K')).toBeTruthy();
  });

  it('hides trend and benchmark while loading', () => {
    render(
      <StatCard
        label="X"
        value="Y"
        loading
        trend={{ value: 12, direction: 'up' }}
        benchmark={{ label: 'avg', value: '10%' }}
      />,
    );
    expect(screen.queryByText('12%')).toBeNull();
    expect(screen.queryByText('10%')).toBeNull();
  });

  // ── Trend ────────────────────────────────────────────────────────────────
  it('renders trend with correct value', () => {
    render(
      <StatCard
        label="Conversion"
        value="34%"
        trend={{ value: 12, direction: 'up' }}
      />,
    );
    expect(screen.getByText('12%')).toBeTruthy();
    expect(screen.getByText('vs last period')).toBeTruthy();
  });

  it('trend icon is aria-hidden', () => {
    const { container } = render(
      <StatCard label="X" value="Y" trend={{ value: 5, direction: 'up' }} />,
    );
    // The SVG icon should have aria-hidden="true"
    const icons = container.querySelectorAll('[aria-hidden="true"]');
    expect(icons.length).toBeGreaterThan(0);
  });

  it('applies isGood=false coloring for down trend that is good (e.g. churn rate)', () => {
    const { container } = render(
      <StatCard
        label="Churn"
        value="5%"
        trend={{ value: 8, direction: 'down', isGood: true }}
      />,
    );
    // Should use success color class, not danger
    const trendSpan = container.querySelector('.text-success');
    expect(trendSpan).toBeTruthy();
  });

  // ── Benchmark ────────────────────────────────────────────────────────────
  it('renders benchmark label and value', () => {
    render(
      <StatCard
        label="RSVP rate"
        value="78%"
        benchmark={{ label: 'Industry avg', value: '52%' }}
      />,
    );
    expect(screen.getByText('Industry avg:')).toBeTruthy();
    expect(screen.getByText('52%')).toBeTruthy();
  });

  // ── Right slot ───────────────────────────────────────────────────────────
  it('renders rightSlot content', () => {
    render(
      <StatCard
        label="Revenue"
        value="$50K"
        rightSlot={<span data-testid="sparkline">chart</span>}
      />,
    );
    expect(screen.getByTestId('sparkline')).toBeTruthy();
  });

  // ── ClassName ────────────────────────────────────────────────────────────
  it('passes className to the Card', () => {
    const { container } = render(
      <StatCard label="X" value="Y" className="custom-class" />,
    );
    expect(container.firstChild?.className).toContain('custom-class');
  });
});
