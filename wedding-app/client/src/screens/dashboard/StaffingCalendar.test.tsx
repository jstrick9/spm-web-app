import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StaffingCalendar } from './StaffingCalendar';

describe('StaffingCalendar accessibility structure', () => {
  it('uses one calendar-day button and does not nest event buttons within it', () => {
    const today = new Date();
    const date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;
    const { container } = render(<StaffingCalendar isLoading={false} monthOffset={0} onMonthChange={() => {}} data={{ calendar: {
      events: [{ id: 'event-1', title: 'Accessible reception', start_date: date }],
      shifts: [],
    } }} />);
    const day = screen.getByRole('button', { name: /1 event\(s\), 0 shift\(s\)/ });
    expect(day.querySelector('button')).toBeNull();
    expect(container.querySelectorAll('button button')).toHaveLength(0);
  });
});
