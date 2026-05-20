import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PropertiesPanel } from './PropertiesPanel';

vi.mock('../hooks/useLayoutState', () => ({
  getTableSpecs: () => [
    {
      id: 'seat-row',
      name: 'Ceremony Seating Row',
      shape: 'rectangle',
      width: 20,
      height: 2,
      capacity: 10,
      color: '#f8f4e3',
      category: 'interior',
      isSeatingType: true,
      seatingRowCount: 2,
      seatingRowSpacing: 3,
    },
  ],
  getFixtureTypes: () => [],
  getLinenColors: () => [
    { id: 'white', name: 'White', hex: '#FFFFFF', textColor: '#374151', enabled: true },
  ],
}));

vi.mock('../data/venueData', () => ({
  getChairSpecs: () => [
    { id: 'white-plastic', name: 'White Plastic', width: 1.5, depth: 1.5, color: '#ffffff', icon: '🪑' },
  ],
}));

describe('PropertiesPanel seating types', () => {
  it.skip('shows row count/spacing summary and updates chair count with seating defaults', () => {
    const onUpdateTable = vi.fn();

    render(
      <PropertiesPanel
        selectedId="t1"
        tables={[
          {
            id: 't1',
            type: 'table',
            specId: 'seat-row',
            x: 10,
            y: 10,
            rotation: 0,
            label: 'Row A',
            guests: [],
            chairCount: 4,
          },
        ]}
        fixtures={[]}
        guests={[]}
        onUpdateTable={onUpdateTable}
        onUpdateFixture={() => undefined}
        onRemoveItem={() => undefined}
        onDuplicateItem={() => undefined}
        onClose={() => undefined}
        onAddGuest={() => undefined}
        onRemoveGuestFromTable={() => undefined}
        onViewImage={() => undefined}
        visible
        onToggleVisibility={() => undefined}
        arrangements={[]}
      />,
    );

    expect(screen.getByText(/Rows:/i)).toBeInTheDocument();
    expect(screen.getByText(/Row Spacing:/i)).toBeInTheDocument();
    expect(screen.getByText(/Total Chairs:/i)).toBeInTheDocument();
    expect(screen.getByText(/Rows:\s*2/i)).toBeInTheDocument();
    expect(screen.getByText(/Row Spacing:\s*3 ft/i)).toBeInTheDocument();
    expect(screen.getByText(/Total Chairs:\s*8/i)).toBeInTheDocument();

    // Seating types should not show linen controls.
    expect(screen.queryByText(/Table Linen/i)).not.toBeInTheDocument();

    const chairInput = screen.getByDisplayValue('4');
    fireEvent.change(chairInput, { target: { value: '5' } });

    expect(onUpdateTable).toHaveBeenCalledWith('t1', {
      chairCount: 5,
      showChairs: true,
    });
  });
});
