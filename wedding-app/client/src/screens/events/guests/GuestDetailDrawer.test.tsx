import { describe, it, expect, vi } from 'vitest';
vi.mock("../../../ui/Toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GuestDetailDrawer } from './GuestDetailDrawer';

vi.mock('../../../sdk', () => ({
  sdk: {
    rsvps: {
      list: vi.fn().mockResolvedValue({ rsvps: [] }),
    },
  },
}));

function wrap() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

const mockGuest: any = {
  id: 'g1', full_name: 'Sarah Johnson', email: 'sarah@test.com', phone: '555-1234',
  rsvp_status: 'attending' as const, party_name: 'Bride Family',
  table_assignment: 'Table 1', room_assignment: null, seat_assignment: null,
  dietary_restrictions: 'Vegetarian', accessibility_notes: 'Wheelchair access',
  plus_one_allowed: 1, allow_portal_access: 1, allow_lodging_access: 0,
  organization_id: 'org1', event_id: 'e1', metadata: '{}', created_at: '2026-01-01',
};

describe('GuestDetailDrawer', () => {
  it('renders guest name and contact info', async () => {
    render(<GuestDetailDrawer guest={mockGuest} open={true} onOpenChange={vi.fn()} />, { wrapper: wrap() });
    await waitFor(() => {
      expect(screen.getByText('Sarah Johnson')).toBeTruthy();
      expect(screen.getByText('sarah@test.com')).toBeTruthy();
    });
  });

  it('shows dietary restrictions', async () => {
    render(<GuestDetailDrawer guest={mockGuest} open={true} onOpenChange={vi.fn()} />, { wrapper: wrap() });
    await waitFor(() => {
      expect(screen.getByText('Vegetarian')).toBeTruthy();
    });
  });

  it('shows accessibility notes', async () => {
    render(<GuestDetailDrawer guest={mockGuest} open={true} onOpenChange={vi.fn()} />, { wrapper: wrap() });
    await waitFor(() => {
      expect(screen.getByText('Wheelchair access')).toBeTruthy();
    });
  });

  it('shows table assignment', async () => {
    render(<GuestDetailDrawer guest={mockGuest} open={true} onOpenChange={vi.fn()} />, { wrapper: wrap() });
    await waitFor(() => {
      expect(screen.getByText('Table 1')).toBeTruthy();
    });
  });
});
