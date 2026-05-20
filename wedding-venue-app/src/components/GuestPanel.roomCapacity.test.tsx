import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { GuestPanel } from './GuestPanel';
import { Guest, PlacedFixture, Venue } from '../types';

vi.mock('../hooks/useLayoutState', () => ({
  getTableSpecs: () => [],
  getFixtureTypes: () => [
    {
      id: 'room-spec',
      name: 'Lodging Room',
      shape: 'rectangle',
      width: 12,
      height: 10,
      category: 'lodging',
      lodgingType: 'rooms',
      isRoom: true,
      capacity: 1,
      icon: '🛏️',
      color: '#e0f2fe',
    },
  ],
}));

describe('GuestPanel lodging room capacity enforcement', () => {
  it('disables full room options for unassigned guests', () => {
    const guests: Guest[] = [
      { id: 'g1', name: 'Assigned Guest', rsvpStatus: 'confirmed', roomId: 'room-1' },
      { id: 'g2', name: 'Unassigned Guest', rsvpStatus: 'confirmed' },
    ];

    const fixtures: PlacedFixture[] = [
      {
        id: 'room-1',
        type: 'fixture',
        specId: 'room-spec',
        x: 10,
        y: 10,
        rotation: 0,
        label: 'Room 101',
      },
    ];

    const venue: Venue = {
      id: 'v1',
      name: 'Lodging Venue',
      width: 40,
      height: 30,
      capacity: 20,
      category: 'lodging',
      color: '#fff',
      borderColor: '#4A1942',
    };

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
        onAssignToRoom={() => undefined}
        onImportCSV={() => undefined}
        onExportCSV={() => undefined}
        onClose={() => undefined}
      />,
    );

    const selects = screen.getAllByRole('combobox');
    // Guest list first row is assigned guest, second is unassigned guest.
    const unassignedGuestSelect = selects.find((s) => (s as HTMLSelectElement).value === '') as HTMLSelectElement;
    expect(unassignedGuestSelect).toBeTruthy();

    const roomOption = Array.from(unassignedGuestSelect.options).find(o => o.value === 'room-1');
    expect(roomOption).toBeTruthy();
    expect(roomOption?.disabled).toBe(true);
  });
});
