import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { EventGuestsTab } from './EventGuestsTab';
import { ToastProvider } from '../../../ui/Toast';
import { http, HttpResponse, server } from '../../../test/server';
import { setToken } from '../../../sdk/client';
import type { SdkGuest } from '../../../sdk/types';

function harness(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return (
    <QueryClientProvider client={qc}>
      <ToastProvider>{ui}</ToastProvider>
    </QueryClientProvider>
  );
}

beforeEach(() => { setToken('test-token'); });

const SAMPLE: SdkGuest[] = [
  mk('g1', 'Aunt Mary',  'pending',   { email: 'mary@example.com', party_name: 'Smith family' }),
  mk('g2', 'Uncle Bob',  'attending', { table_assignment: 'Table 3' }),
  mk('g3', 'Cousin Lin', 'declined',  { plus_one_allowed: 1 }),
  mk('g4', 'Sam Lee',    'pending',   { dietary_restrictions: 'Vegan' }),
];

function mk(id: string, name: string, status: SdkGuest['rsvp_status'], extras: Partial<SdkGuest> = {}): SdkGuest {
  return {
    id, organization_id: 'org-1', event_id: 'evt-1',
    full_name: name, email: null, phone: null,
    party_name: null, rsvp_status: status,
    dietary_restrictions: null, accessibility_notes: null,
    table_assignment: null, room_assignment: null, seat_assignment: null,
    plus_one_allowed: 0, allow_portal_access: 1, allow_lodging_access: 0,
    metadata: '{}', created_at: '',
    ...extras,
  };
}

function mockList(guests: SdkGuest[]) {
  const counts = { pending: 0, attending: 0, declined: 0, maybe: 0 };
  for (const g of guests) counts[g.rsvp_status]++;
  server.use(
    http.get('/api/events/:eventId/guests', () =>
      HttpResponse.json({ guests, counts }),
    ),
    http.get('/api/events/:eventId/guest-help-requests', () =>
      HttpResponse.json({ requests: [], counts: { open: 0, inReview: 0, resolved: 0, closed: 0 } }),
    ),
  );
}

describe('EventGuestsTab', () => {
  it('lists guests and shows the toolbar', async () => {
    mockList(SAMPLE);
    render(harness(<EventGuestsTab eventId="evt-1" />));
    expect(await screen.findByText('Aunt Mary')).toBeInTheDocument();
    expect(screen.getByText('Uncle Bob')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Search by name/i)).toBeInTheDocument();
  });

  it('filters by search term (client-side, instant)', async () => {
    mockList(SAMPLE);
    render(harness(<EventGuestsTab eventId="evt-1" />));
    await screen.findByText('Aunt Mary');
    await userEvent.type(screen.getByPlaceholderText(/Search by name/i), 'bob');
    // Wait for the debounce + filter
    await waitFor(() => expect(screen.queryByText('Aunt Mary')).not.toBeInTheDocument(), { timeout: 1000 });
    expect(screen.getByText('Uncle Bob')).toBeInTheDocument();
  });

  it('filters by status chip', async () => {
    mockList(SAMPLE);
    render(harness(<EventGuestsTab eventId="evt-1" />));
    await screen.findByText('Aunt Mary');
    await userEvent.click(screen.getByRole('button', { name: /^Attending\s/ }));
    expect(screen.queryByText('Aunt Mary')).not.toBeInTheDocument();
    expect(screen.getByText('Uncle Bob')).toBeInTheDocument();
  });

  it('clicking a row opens the detail drawer', async () => {
    mockList(SAMPLE);
    // Add empty rsvps handler for the drawer's useQuery
    server.use(http.get('/api/events/:eventId/rsvps', () => HttpResponse.json({ rsvps: [] })));
    render(harness(<EventGuestsTab eventId="evt-1" />));
    await userEvent.click(await screen.findByText('Aunt Mary'));
    // Drawer title — Aunt Mary appears twice (in row + drawer). Use a heading-style assertion.
    expect(await screen.findByRole('heading', { name: 'Aunt Mary' })).toBeInTheDocument();
  });

  it('selecting a guest reveals the bulk-actions bar', async () => {
    mockList(SAMPLE);
    render(harness(<EventGuestsTab eventId="evt-1" />));
    await screen.findByText('Aunt Mary');
    await userEvent.click(screen.getByRole('checkbox', { name: /Select Aunt Mary/i }));
    expect(screen.getByText(/1 selected/i)).toBeInTheDocument();
  });

  it('sorting by name (asc → desc) flips the order of the first row', async () => {
    mockList(SAMPLE);
    render(harness(<EventGuestsTab eventId="evt-1" />));
    await screen.findByText('Aunt Mary');
    // First visible name should be 'Aunt Mary' (asc by name default)
    const allNameCells = screen.getAllByText(/Mary|Bob|Lin|Sam/);
    expect(allNameCells[0]).toHaveTextContent('Aunt Mary');
    // Click the Name header to flip to desc
    await userEvent.click(screen.getByRole('button', { name: /Name/ }));
    const flipped = screen.getAllByText(/Mary|Bob|Lin|Sam/);
    expect(flipped[0]).toHaveTextContent('Uncle Bob');
  });

  it('"Add guest" button opens the create form', async () => {
    mockList(SAMPLE);
    render(harness(<EventGuestsTab eventId="evt-1" />));
    await screen.findByText('Aunt Mary');
    await userEvent.click(screen.getByRole('button', { name: /Add guest/i }));
    expect(await screen.findByRole('heading', { name: /Add guest/i })).toBeInTheDocument();
  });
});
