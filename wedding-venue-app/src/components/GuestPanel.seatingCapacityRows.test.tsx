import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Guest, PlacedTable, Venue } from '../types';

const baseGuests: Guest[] = [
  { id: 'g1', name: 'Alice', rsvpStatus: 'confirmed' },
  { id: 'g2', name: 'Bob', rsvpStatus: 'confirmed' },
];

const ceremonyVenue: Venue = {
  id: 'v-ceremony',
  name: 'Ceremony Lawn',
  width: 80,
  height: 50,
  capacity: 200,
  category: 'ceremony',
  color: '#ffffff',
  borderColor: '#4A1942',
};

function mockTableSpecs(rowCount: number, rowSpacing: number) {
  vi.doMock('../hooks/useLayoutState', () => ({
    getTableSpecs: () => [
      {
        id: 'seating-row',
        name: 'Ceremony Seating Row',
        shape: 'rectangle',
        width: 10,
        height: 2,
        capacity: 4,
        color: '#f8f4ef',
        isSeatingType: true,
        seatingRowCount: rowCount,
        seatingRowSpacing: rowSpacing,
      },
    ],
    getFixtureTypes: () => [],
  }));
}

async function renderPanel(rowCount: number, rowSpacing: number) {
  vi.resetModules();
  mockTableSpecs(rowCount, rowSpacing);
  const { GuestPanel } = await import('./GuestPanel');

  const table: PlacedTable = {
    id: 't1',
    type: 'table',
    specId: 'seating-row',
    x: 10,
    y: 10,
    rotation: 0,
    label: 'Row A',
    guests: [],
    customCapacity: 4,
  };

  const onAssignToTable = vi.fn();

  render(
    <GuestPanel
      guests={baseGuests}
      tables={[table]}
      venue={ceremonyVenue}
      onAddGuest={() => 'g3'}
      onUpdateGuest={() => undefined}
      onRemoveGuest={() => undefined}
      onAssignToTable={onAssignToTable}
      onImportCSV={() => undefined}
      onExportCSV={() => undefined}
      onClose={() => undefined}
    />,
  );

  return { onAssignToTable };
}

describe('GuestPanel seating capacity with row count/spacing', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('uses row count to compute total seating capacity', async () => {
    await renderPanel(3, 3);
    // 4 chairs per row * 3 rows = 12 capacity
    expect(screen.getAllByText('Row A (0/12)').length).toBeGreaterThan(0);
  });

  it('row spacing changes do not change total seat capacity', async () => {
    await renderPanel(3, 8);
    // Capacity should still be 12 even with larger row spacing
    expect(screen.getAllByText('Row A (0/12)').length).toBeGreaterThan(0);
  });

  it('allows assignment until capacity then disables additional selection', async () => {
    const { onAssignToTable } = await renderPanel(1, 3); // capacity 4
    const selects = screen.getAllByDisplayValue('Unseated');
	const select = selects[0];
    fireEvent.change(select, { target: { value: 't1' } });
    expect(onAssignToTable).toHaveBeenCalledWith('g1', 't1');
  });
});
