import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { GuestPanel } from './GuestPanel';
import { Guest, PlacedFixture, PlacedTable, Venue } from '../types';

vi.mock('../hooks/useLayoutState', () => ({
  getTableSpecs: () => [
    {
      id: 'round-6',
      name: '60" Round',
      shape: 'circle',
      width: 5,
      height: 5,
      capacity: 8,
      color: '#ffffff',
    },
  ],
  getFixtureTypes: () => [
    {
      id: 'room-spec',
      name: 'Guest Room',
      shape: 'rectangle',
      width: 12,
      height: 10,
      category: 'lodging',
      lodgingType: 'rooms',
      isRoom: true,
      capacity: 2,
      color: '#e0f2fe',
      icon: '🛏️',
    },
  ],
}));

describe('GuestPanel assignment flows', () => {
  it('assigns guests to tables in non-lodging venues', () => {
    const guests: Guest[] = [{ id: 'g1', name: 'Alice', rsvpStatus: 'confirmed' }];
    const tables: PlacedTable[] = [
      { id: 't1', type: 'table', specId: 'round-6', x: 10, y: 10, rotation: 0, label: 'Table 1', guests: [] },
    ];

    const venue: Venue = {
      id: 'v-reception',
      name: 'Reception Hall',
      width: 60,
      height: 40,
      capacity: 120,
      category: 'reception',
      color: '#fff',
      borderColor: '#4A1942',
    };

    const onAssignToTable = vi.fn();

    render(
      <GuestPanel
        guests={guests}
        tables={tables}
        venue={venue}
        onAddGuest={() => 'new-id'}
        onUpdateGuest={() => undefined}
        onRemoveGuest={() => undefined}
        onAssignToTable={onAssignToTable}
        onImportCSV={() => undefined}
        onExportCSV={() => undefined}
        onClose={() => undefined}
      />,
    );

    const select = screen.getByDisplayValue('Unseated');
    fireEvent.change(select, { target: { value: 't1' } });

    expect(onAssignToTable).toHaveBeenCalledWith('g1', 't1');
  });

  it('assigns guests to room fixtures in lodging venues', () => {
    const guests: Guest[] = [{ id: 'g1', name: 'Bob', rsvpStatus: 'confirmed' }];
    const fixtures: PlacedFixture[] = [
      { id: 'room-1', type: 'fixture', specId: 'room-spec', x: 10, y: 10, rotation: 0, label: 'Room 101' },
    ];

    const venue: Venue = {
      id: 'v-lodging',
      name: 'Lodging Wing',
      width: 40,
      height: 30,
      capacity: 20,
      category: 'lodging',
      color: '#fff',
      borderColor: '#4A1942',
    };

    const onAssignToRoom = vi.fn();

    render(
      <GuestPanel
        guests={guests}
        tables={[]}
        fixtures={fixtures}
        venue={venue}
        onAddGuest={() => 'new-id'}
        onUpdateGuest={() => undefined}
        onRemoveGuest={() => undefined}
        onAssignToTable={() => undefined}
        onAssignToRoom={onAssignToRoom}
        onImportCSV={() => undefined}
        onExportCSV={() => undefined}
        onClose={() => undefined}
      />,
    );

    const select = screen.getByDisplayValue('Unassigned Room');
    fireEvent.change(select, { target: { value: 'room-1' } });

    expect(onAssignToRoom).toHaveBeenCalledWith('g1', 'room-1');
  });
});
