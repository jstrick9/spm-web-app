import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GuestsToolbar } from './GuestsToolbar';

const defaultProps = {
  eventId: 'e1',
  search: '',
  onSearchChange: vi.fn(),
  statusFilter: 'all' as any,
  onStatusFilterChange: vi.fn(),
  counts: { pending: 5, attending: 10, declined: 2, maybe: 3 },
  selectedIds: [] as string[],
  onSelectionCleared: vi.fn(),
  onAddClick: vi.fn(),
  onImportClick: vi.fn(),
};

describe('GuestsToolbar', () => {
  it('renders search input', () => {
    render(<GuestsToolbar {...defaultProps} />);
    const inputs = screen.getAllByRole('textbox');
    expect(inputs.length).toBeGreaterThanOrEqual(1);
  });

  it('shows Add guest button', () => {
    render(<GuestsToolbar {...defaultProps} />);
    expect(screen.getByText('Add guest')).toBeTruthy();
  });

  it('shows total guest count', () => {
    render(<GuestsToolbar {...defaultProps} />);
    // Total = 5+10+2+3 = 20
    expect(screen.getByText(/20/)).toBeTruthy();
  });
});
