import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CrossEventGuestBrowser } from './CrossEventGuestBrowser';

// Mock the SDK
vi.mock('../../sdk', () => ({
  sdk: {
    guests: {
      listForOrg: vi.fn().mockResolvedValue({
        guests: [
          {
            id: 'g1', organization_id: 'org1', event_id: 'e1',
            full_name: 'Alice Smith', email: 'alice@example.com', phone: '555-1234',
            party_name: 'Smith Family', rsvp_status: 'attending',
            dietary_restrictions: 'Vegetarian', accessibility_notes: null,
            table_assignment: 'Table 3', room_assignment: null, seat_assignment: null,
            plus_one_allowed: 1, allow_portal_access: 1, allow_lodging_access: 0,
            metadata: '{}', created_at: '2026-01-01', event_title: 'Johnson Wedding',
          },
          {
            id: 'g2', organization_id: 'org1', event_id: 'e2',
            full_name: 'Bob Jones', email: 'bob@example.com', phone: null,
            party_name: null, rsvp_status: 'pending',
            dietary_restrictions: null, accessibility_notes: 'Wheelchair access',
            table_assignment: null, room_assignment: null, seat_assignment: null,
            plus_one_allowed: 0, allow_portal_access: 1, allow_lodging_access: 0,
            metadata: '{}', created_at: '2026-01-02', event_title: 'Davis Reception',
          },
        ],
        total: 2,
        counts: { pending: 1, attending: 1, declined: 0, maybe: 0 },
      }),
      update: vi.fn().mockResolvedValue({ guest: {} }),
      duplicates: vi.fn().mockResolvedValue({ clusters: [] }),
      merge: vi.fn().mockResolvedValue({ primary: {}, mergedCount: 0 }),
    },
    events: {
      list: vi.fn().mockResolvedValue({
        events: [
          { id: 'e1', title: 'Johnson Wedding', status: 'planning', organization_id: 'org1' },
          { id: 'e2', title: 'Davis Reception', status: 'booked', organization_id: 'org1' },
        ],
        counts: {},
      }),
    },
  },
}));

// Mock toast
vi.mock('../../ui/Toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

// Mock debounce to be instant
vi.mock('../../lib/useDebouncedValue', () => ({
  useDebouncedValue: (val: string) => val,
}));

function renderWithProviders(ui: React.ReactElement) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={qc}>{ui}</QueryClientProvider>
  );
}

describe('CrossEventGuestBrowser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the page header', async () => {
    renderWithProviders(<CrossEventGuestBrowser orgId="org1" />);
    expect(screen.getByText('Guests')).toBeTruthy();
  });

  it('renders KPI tiles with counts', async () => {
    renderWithProviders(<CrossEventGuestBrowser orgId="org1" />);
    await waitFor(() => {
      expect(screen.getByText('Total Guests')).toBeTruthy();
      expect(screen.getByText('Attending')).toBeTruthy();
      expect(screen.getByText('Pending')).toBeTruthy();
    });
  });

  it('renders guest rows with names', async () => {
    renderWithProviders(<CrossEventGuestBrowser orgId="org1" />);
    await waitFor(() => {
      expect(screen.getByText('Alice Smith')).toBeTruthy();
      expect(screen.getByText('Bob Jones')).toBeTruthy();
    });
  });

  it('shows event titles linking to event detail', async () => {
    renderWithProviders(<CrossEventGuestBrowser orgId="org1" />);
    await waitFor(() => {
      expect(screen.getByText('Johnson Wedding')).toBeTruthy();
      expect(screen.getByText('Davis Reception')).toBeTruthy();
    });
  });

  it('renders the search input', async () => {
    renderWithProviders(<CrossEventGuestBrowser orgId="org1" />);
    expect(screen.getByPlaceholderText(/Search guests/i)).toBeTruthy();
  });

  it('renders RSVP filter chips', async () => {
    renderWithProviders(<CrossEventGuestBrowser orgId="org1" />);
    await waitFor(() => {
      expect(screen.getByText(/All \(/)).toBeTruthy();
      expect(screen.getByText(/Attending \(/)).toBeTruthy();
      expect(screen.getByText(/Pending \(/)).toBeTruthy();
    });
  });

  it('renders the export CSV button', async () => {
    renderWithProviders(<CrossEventGuestBrowser orgId="org1" />);
    expect(screen.getByText('Export CSV')).toBeTruthy();
  });
});
