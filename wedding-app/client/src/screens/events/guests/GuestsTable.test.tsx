import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GuestsTable } from './GuestsTable';
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

const baseGuest: SdkGuest = {
  id: 'g1', organization_id: 'org-1', event_id: 'evt-1',
  full_name: 'Aunt Mary', email: 'aunt@example.com', phone: null,
  party_name: 'Smith family', rsvp_status: 'pending',
  dietary_restrictions: null, accessibility_notes: null,
  table_assignment: null, room_assignment: null, seat_assignment: null,
  plus_one_allowed: 0, allow_portal_access: 1, allow_lodging_access: 0,
  metadata: '{}', created_at: '',
};

const guests: SdkGuest[] = [
  baseGuest,
  { ...baseGuest, id: 'g2', full_name: 'Uncle Bob',  rsvp_status: 'attending', table_assignment: 'Table 3' },
  { ...baseGuest, id: 'g3', full_name: 'Cousin Lin', rsvp_status: 'declined',  plus_one_allowed: 1 },
];

function defaultProps(overrides: Partial<React.ComponentProps<typeof GuestsTable>> = {}) {
  return {
    eventId: 'evt-1',
    guests,
    selectedIds: new Set<string>(),
    onSelectionChange: vi.fn(),
    sortKey: 'name' as const,
    sortDir: 'asc' as const,
    onSortChange: vi.fn(),
    onRowClick: vi.fn(),
    filtered: false,
    onClearFilters: vi.fn(),
    onAddGuest: vi.fn(),
    ...overrides,
  };
}

describe('GuestsTable', () => {
  it('renders one row per guest', () => {
    render(harness(<GuestsTable {...defaultProps()} />));
    expect(screen.getByText('Aunt Mary')).toBeInTheDocument();
    expect(screen.getByText('Uncle Bob')).toBeInTheDocument();
    expect(screen.getByText('Cousin Lin')).toBeInTheDocument();
  });

  it('shows the empty state when there are zero guests', () => {
    render(harness(<GuestsTable {...defaultProps({ guests: [] })} />));
    expect(screen.getByText(/No guests yet/i)).toBeInTheDocument();
  });

  it('empty state changes to "filtered" when filters are active', () => {
    render(harness(<GuestsTable {...defaultProps({ guests: [], filtered: true })} />));
    expect(screen.getByText(/No guests match your filters/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Clear filters/i })).toBeInTheDocument();
  });

  it('click a row → calls onRowClick', async () => {
    const onRowClick = vi.fn();
    render(harness(<GuestsTable {...defaultProps({ onRowClick })} />));
    await userEvent.click(screen.getByText('Aunt Mary'));
    expect(onRowClick).toHaveBeenCalledTimes(1);
    expect(onRowClick.mock.calls[0][0].id).toBe('g1');
  });

  it('click the row checkbox does NOT open the row', async () => {
    const onRowClick = vi.fn();
    const onSelectionChange = vi.fn();
    render(harness(<GuestsTable {...defaultProps({ onRowClick, onSelectionChange })} />));
    const checkbox = screen.getByRole('checkbox', { name: /Select Aunt Mary/i });
    await userEvent.click(checkbox);
    expect(onRowClick).not.toHaveBeenCalled();
    expect(onSelectionChange).toHaveBeenCalledTimes(1);
    const newSet = onSelectionChange.mock.calls[0][0] as Set<string>;
    expect(newSet.has('g1')).toBe(true);
  });

  it('select-all checkbox is indeterminate when some-but-not-all rows are selected', () => {
    render(harness(<GuestsTable {...defaultProps({ selectedIds: new Set(['g1']) })} />));
    const selectAll = screen.getByRole('checkbox', { name: /Select all guests/i }) as HTMLButtonElement;
    expect(selectAll.getAttribute('data-state')).toBe('indeterminate');
  });

  it('select-all checkbox selects every visible row', async () => {
    const onSelectionChange = vi.fn();
    render(harness(<GuestsTable {...defaultProps({ onSelectionChange })} />));
    await userEvent.click(screen.getByRole('checkbox', { name: /Select all guests/i }));
    const set = onSelectionChange.mock.calls[0][0] as Set<string>;
    expect([...set].sort()).toEqual(['g1', 'g2', 'g3']);
  });

  it('clicking a header invokes onSortChange', async () => {
    const onSortChange = vi.fn();
    render(harness(<GuestsTable {...defaultProps({ onSortChange })} />));
    await userEvent.click(screen.getByRole('button', { name: /Email/i }));
    expect(onSortChange).toHaveBeenCalledWith('email');
  });

  it('inline RSVP dropdown patches the server and does not open the row', async () => {
    let patched: { id?: string; rsvpStatus?: string } = {};
    server.use(
      http.patch('/api/guests/:id', async ({ request, params }) => {
        const body = await request.json() as { rsvpStatus?: string };
        patched = { id: params.id as string, rsvpStatus: body.rsvpStatus };
        return HttpResponse.json({ guest: { ...baseGuest, id: patched.id! } });
      }),
    );
    const onRowClick = vi.fn();
    render(harness(<GuestsTable {...defaultProps({ onRowClick })} />));
    // Open the inline RSVP dropdown for Aunt Mary
    await userEvent.click(screen.getByRole('button', { name: /Change RSVP for Aunt Mary/i }));
    // Radix renders each item as role=menuitem; pick the Attending one
    const items = await screen.findAllByRole('menuitem');
    const attending = items.find((el) => /Attending/i.test(el.textContent ?? ''));
    expect(attending, 'expected an Attending menu item').toBeDefined();
    await userEvent.click(attending!);
    await waitFor(() => expect(patched.id).toBe('g1'));
    expect(patched.rsvpStatus).toBe('attending');
    expect(onRowClick).not.toHaveBeenCalled();
  });

  it('renders +1 / 🍽 / ♿ / 🔒 tags appropriately', () => {
    const tagged: SdkGuest = {
      ...baseGuest, id: 'gt', full_name: 'Tagged Person',
      plus_one_allowed: 1, dietary_restrictions: 'Vegan',
      accessibility_notes: 'Wheelchair', allow_portal_access: 0,
    };
    render(harness(<GuestsTable {...defaultProps({ guests: [tagged] })} />));
    expect(screen.getByText('+1')).toBeInTheDocument();
    expect(screen.getByText('🍽 diet')).toBeInTheDocument();
    expect(screen.getByText('♿ access')).toBeInTheDocument();
    expect(screen.getByText('🔒 no portal')).toBeInTheDocument();
  });
});
