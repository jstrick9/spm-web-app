import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SeatingReport } from './SeatingReport';

const mockGuests = [
  { id: 'g1', full_name: 'Alice Smith', rsvp_status: 'attending' as const, table_assignment: 'Table 1', dietary_restrictions: 'Vegetarian', accessibility_notes: null, organization_id: 'o1', event_id: 'e1', email: null, phone: null, party_name: null, room_assignment: null, seat_assignment: null, plus_one_allowed: 0 as const, allow_portal_access: 1 as const, allow_lodging_access: 0 as const, metadata: '{}', created_at: '2026-01-01' },
  { id: 'g2', full_name: 'Bob Jones', rsvp_status: 'attending' as const, table_assignment: 'Table 1', dietary_restrictions: null, accessibility_notes: 'Wheelchair', organization_id: 'o1', event_id: 'e1', email: null, phone: null, party_name: null, room_assignment: null, seat_assignment: null, plus_one_allowed: 0 as const, allow_portal_access: 1 as const, allow_lodging_access: 0 as const, metadata: '{}', created_at: '2026-01-01' },
  { id: 'g3', full_name: 'Carol Davis', rsvp_status: 'pending' as const, table_assignment: null, dietary_restrictions: 'Vegan', accessibility_notes: null, organization_id: 'o1', event_id: 'e1', email: null, phone: null, party_name: null, room_assignment: null, seat_assignment: null, plus_one_allowed: 0 as const, allow_portal_access: 1 as const, allow_lodging_access: 0 as const, metadata: '{}', created_at: '2026-01-01' },
];

describe('SeatingReport', () => {
  it('renders the event title', () => {
    render(<SeatingReport eventTitle="Smith Wedding" eventDate="2026-09-12" guests={mockGuests} onClose={vi.fn()} />);
    expect(screen.getByText('Smith Wedding')).toBeTruthy();
  });

  it('shows dietary summary', () => {
    render(<SeatingReport eventTitle="Test" eventDate={null} guests={mockGuests} onClose={vi.fn()} />);
    expect(screen.getAllByText('Vegetarian').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Vegan').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Standard').length).toBeGreaterThanOrEqual(1);
  });

  it('groups guests by table', () => {
    render(<SeatingReport eventTitle="Test" eventDate={null} guests={mockGuests} onClose={vi.fn()} />);
    expect(screen.getByText('Table 1')).toBeTruthy();
    expect(screen.getByText('Unassigned')).toBeTruthy();
  });

  it('shows guest names in their tables', () => {
    render(<SeatingReport eventTitle="Test" eventDate={null} guests={mockGuests} onClose={vi.fn()} />);
    expect(screen.getByText('Alice Smith')).toBeTruthy();
    expect(screen.getByText('Bob Jones')).toBeTruthy();
    expect(screen.getByText('Carol Davis')).toBeTruthy();
  });

  it('shows accessibility notes', () => {
    render(<SeatingReport eventTitle="Test" eventDate={null} guests={mockGuests} onClose={vi.fn()} />);
    expect(screen.getByText('Wheelchair')).toBeTruthy();
  });

  it('has print and close buttons', () => {
    render(<SeatingReport eventTitle="Test" eventDate={null} guests={mockGuests} onClose={vi.fn()} />);
    expect(screen.getByText('🖨️ Print')).toBeTruthy();
    expect(screen.getByText('Close')).toBeTruthy();
  });

  it('shows guest and table counts', () => {
    render(<SeatingReport eventTitle="Test" eventDate={null} guests={mockGuests} onClose={vi.fn()} />);
    expect(screen.getByText(/3 guests/)).toBeTruthy();
    expect(screen.getByText(/2 tables/)).toBeTruthy();
  });
});
