import { fireEvent, render, screen } from '@testing-library/react';
import { GuestPanel } from './GuestPanel';
import { Guest, PlacedFixture, Venue } from '../types';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../hooks/useLayoutState', () => ({
  getTableSpecs: () => [],
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
      icon: '🛏️',
      color: '#e0f2fe',
    },
  ],
}));

describe('GuestPanel room assignment (lodging fixtures)', () => {
  it('assigns a guest to a lodging room fixture via onAssignToRoom', () => {
    const guests: Guest[] = [
      { id: 'g1', name: 'Jane Doe', rsvpStatus: 'confirmed' },
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

    const roomSelect = screen.getByDisplayValue('Unassigned Room');
    fireEvent.change(roomSelect, { target: { value: 'room-1' } });

    expect(onAssignToRoom).toHaveBeenCalledWith('g1', 'room-1');
  });
});
