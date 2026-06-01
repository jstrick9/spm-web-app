import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { STATUS_META, statusOrder, StatusBadge } from './statusMeta';

describe('statusMeta', () => {
  it('defines metadata for all 7 event statuses', () => {
    expect(Object.keys(STATUS_META)).toHaveLength(7);
    for (const key of ['lead', 'hold', 'booked', 'planning', 'completed', 'cancelled', 'lost']) {
      expect(STATUS_META[key as keyof typeof STATUS_META]).toBeDefined();
      expect(STATUS_META[key as keyof typeof STATUS_META].label).toBeTruthy();
      expect(STATUS_META[key as keyof typeof STATUS_META].dotColor).toBeTruthy();
    }
  });

  it('statusOrder contains all 7 statuses', () => {
    expect(statusOrder).toHaveLength(7);
    expect(statusOrder).toContain('lead');
    expect(statusOrder).toContain('completed');
  });

  it('StatusBadge renders the status label', () => {
    render(<StatusBadge status="booked" />);
    expect(screen.getByText('Booked')).toBeTruthy();
  });

  it('StatusBadge renders for each status without crashing', () => {
    for (const status of statusOrder) {
      const { unmount } = render(<StatusBadge status={status} />);
      expect(screen.getByText(STATUS_META[status].label)).toBeTruthy();
      unmount();
    }
  });
});
