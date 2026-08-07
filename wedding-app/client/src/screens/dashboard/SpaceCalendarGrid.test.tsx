import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SpaceCalendarGrid } from './SpaceCalendarGrid';

const COMMITMENTS = [
  { id: 'c1', start_date: '2026-09-12', title: 'Smith & Jones Wedding', venue_name: 'Grand Ballroom' },
  { id: 'c2', start_date: '2026-09-12', title: 'Patel Engagement', venue_name: 'Grand Ballroom' },
  { id: 'c3', start_date: '2026-09-01', title: 'September Kickoff', venue_name: 'Terrace' },
  { id: 'c4', start_date: '2026-08-31', title: 'August Carryover', venue_name: 'Garden' },
] as any;

describe('SpaceCalendarGrid — local calendar month math', () => {
  it('renders September 2026 with the correct weekday alignment and day count', () => {
    const { container } = render(
      <SpaceCalendarGrid year={2026} month={8} commitments={COMMITMENTS} onOpen={() => {}} />,
    );
    // 30 day cells for September (2 leading blanks for Sun/Mon are empty divs)
    expect(container.querySelectorAll('[class*="min-h-16"]').length).toBe(30);
    // weekday header order
    const headers = screen.getAllByText(/^(Sun|Mon|Tue|Wed|Thu|Fri|Sat)$/).map((n) => n.textContent);
    expect(headers).toEqual(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']);
    // day-of-month numbers render on days that have commitments
    expect(screen.getByText('1')).toBeTruthy();
    expect(screen.getByText('12')).toBeTruthy();
  });

  it('places commitments on their calendar date and never on the previous month', () => {
    render(<SpaceCalendarGrid year={2026} month={8} commitments={COMMITMENTS} onOpen={() => {}} />);
    expect(screen.getByText(/Grand Ballroom · Smith & Jones Wedding/)).toBeTruthy();
    expect(screen.getByText(/Grand Ballroom · Patel Engagement/)).toBeTruthy();
    expect(screen.getByText(/Terrace · September Kickoff/)).toBeTruthy();
    // August carryover must NOT appear in the September grid
    expect(screen.queryByText(/Garden · August Carryover/)).toBeNull();
  });

  it('marks conflicted (double-booked) commitments with a warning badge', () => {
    render(
      <SpaceCalendarGrid
        year={2026}
        month={8}
        commitments={COMMITMENTS}
        conflictedIds={new Set(['c1', 'c2'])}
        onOpen={() => {}}
      />,
    );
    const c1 = screen.getByText(/Grand Ballroom · Smith & Jones Wedding/);
    expect(c1.textContent).toContain('⚠');
    expect(screen.getByText(/Terrace · September Kickoff/).textContent).not.toContain('⚠');
  });

  it('opens the event when a commitment chip is clicked', () => {
    const onOpen = vi.fn();
    render(<SpaceCalendarGrid year={2026} month={8} commitments={COMMITMENTS} onOpen={onOpen} />);
    screen.getByText(/Grand Ballroom · Smith & Jones Wedding/).click();
    expect(onOpen).toHaveBeenCalledWith('c1');
  });
});
