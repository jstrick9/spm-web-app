/**
 * GuestsTable tests — Phase 34c (extends existing GuestsTable tests)
 *
 * Focus: aria-sort compliance on sort column headers.
 *
 * WCAG 1.3.1 + ARIA 1.2 rules verified:
 *   ✅ Each sortable <th> has aria-sort
 *   ✅ The active column gets aria-sort="ascending" or "descending"
 *   ✅ Inactive sortable columns get aria-sort="none"
 *   ✅ Non-sortable columns (checkbox, Tags) have NO aria-sort
 *   ✅ aria-sort is on <th>, not on the button inside
 *   ✅ Sort button aria-label for unsorted column
 *   ✅ Sort button aria-label when sorted ascending (with next-action hint)
 *   ✅ Sort button aria-label when sorted descending (with next-action hint)
 *   ✅ Sort icon is aria-hidden="true" in GuestsTable.SortHeader
 *   ✅ onSortChange fires when a column header button is clicked
 *   ✅ Clicking Name when Name is already active calls onSortChange("name")
 *   ✅ RSVP button still has aria-label (regression guard for existing fix)
 *   ✅ Select-all checkbox still has aria-label (regression guard)
 *   ✅ Per-row checkbox still has aria-label
 *   ✅ Empty state renders when guests=[]
 *   ✅ Filtered empty state renders when filtered=true
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GuestsTable, type GuestsTableProps } from './GuestsTable';
import type { SdkGuest } from '../../../sdk/types';

// ── Mocks ──────────────────────────────────────────────────────────────────

vi.mock('../../../sdk', () => ({
  sdk: {
    guests: { update: vi.fn().mockResolvedValue({ guest: {} }) },
  },
}));

vi.mock('../../../ui/Toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
    dismiss: vi.fn(),
    toasts: [],
  }),
}));

vi.mock('./rsvpMeta', () => ({
  RSVP_META: {
    attending: { label: 'Attending', variant: 'success', dotColor: '#22c55e' },
    pending:   { label: 'Pending',   variant: 'warning', dotColor: '#f59e0b' },
    declined:  { label: 'Declined',  variant: 'danger',  dotColor: '#ef4444' },
    maybe:     { label: 'Maybe',     variant: 'default', dotColor: '#6b7280' },
  },
  rsvpOrder: ['attending', 'pending', 'declined', 'maybe'],
  RsvpBadge: ({ status }: { status: string }) => (
    <span data-testid={`rsvp-badge-${status}`}>{status}</span>
  ),
}));

// ── Fixtures ───────────────────────────────────────────────────────────────

const GUEST: SdkGuest = {
  id:                   'g-1',
  organization_id:      'org-1',
  event_id:             'e-1',
  full_name:            'Jane Smith',
  email:                'jane@example.com',
  phone:                null,
  party_name:           'Smith Party',
  rsvp_status:          'attending',
  dietary_restrictions: null,
  accessibility_notes:  null,
  table_assignment:     'Table 3',
  room_assignment:      null,
  seat_assignment:      null,
  plus_one_allowed:     0,
  allow_portal_access:  1,
  allow_lodging_access: 0,
  metadata:             '{}',
  created_at:           '2026-01-01',
};

const BASE_PROPS: GuestsTableProps = {
  eventId:          'e-1',
  guests:           [GUEST],
  selectedIds:      new Set<string>(),
  onSelectionChange: vi.fn(),
  sortKey:          'name',
  sortDir:          'asc',
  onSortChange:     vi.fn(),
  onRowClick:       vi.fn(),
  filtered:         false,
  onClearFilters:   vi.fn(),
  onAddGuest:       vi.fn(),
};

function renderTable(props: Partial<GuestsTableProps> = {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <GuestsTable {...BASE_PROPS} {...props} />
    </QueryClientProvider>,
  );
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('GuestsTable — aria-sort (Phase 34c)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Active sort column: ascending ────────────────────────────────────────
  it('active sort column (sortDir="asc") has aria-sort="ascending"', () => {
    renderTable({ sortKey: 'name', sortDir: 'asc' });
    const nameHeader = screen.getByRole('columnheader', { name: /Name/i });
    expect(nameHeader).toHaveAttribute('aria-sort', 'ascending');
  });

  // ── Active sort column: descending ───────────────────────────────────────
  it('active sort column (sortDir="desc") has aria-sort="descending"', () => {
    renderTable({ sortKey: 'name', sortDir: 'desc' });
    const nameHeader = screen.getByRole('columnheader', { name: /Name/i });
    expect(nameHeader).toHaveAttribute('aria-sort', 'descending');
  });

  // ── Inactive sortable columns: "none" ────────────────────────────────────
  it('inactive sortable columns have aria-sort="none"', () => {
    renderTable({ sortKey: 'name', sortDir: 'asc' });

    // Email, Party, RSVP, Table are all sortable but not the active column
    const emailHeader = screen.getByRole('columnheader', { name: /Email/i });
    const partyHeader = screen.getByRole('columnheader', { name: /Party/i });
    const rsvpHeader  = screen.getByRole('columnheader', { name: /RSVP/i });
    const tableHeader = screen.getByRole('columnheader', { name: /Table/i });

    expect(emailHeader).toHaveAttribute('aria-sort', 'none');
    expect(partyHeader).toHaveAttribute('aria-sort', 'none');
    expect(rsvpHeader).toHaveAttribute('aria-sort', 'none');
    expect(tableHeader).toHaveAttribute('aria-sort', 'none');
  });

  // ── Non-sortable columns: no aria-sort ───────────────────────────────────
  it('Tags column (non-sortable) has no aria-sort attribute', () => {
    renderTable();
    const tagsHeader = screen.getByRole('columnheader', { name: 'Tags' });
    expect(tagsHeader).not.toHaveAttribute('aria-sort');
  });

  it('checkbox column (non-sortable) has no aria-sort attribute', () => {
    renderTable();
    const checkboxHeader = screen.getByRole('columnheader', { name: 'Select all rows' });
    expect(checkboxHeader).not.toHaveAttribute('aria-sort');
  });

  // ── aria-sort is on <th>, not on button ──────────────────────────────────
  it('aria-sort is on the <th>, not on the sort button inside', () => {
    renderTable({ sortKey: 'name', sortDir: 'asc' });
    const nameHeader = screen.getByRole('columnheader', { name: /Name/i });

    expect(nameHeader.tagName).toBe('TH');
    expect(nameHeader).toHaveAttribute('aria-sort', 'ascending');

    const btn = nameHeader.querySelector('button');
    expect(btn).not.toBeNull();
    expect(btn).not.toHaveAttribute('aria-sort');
  });

  // ── Button aria-label: unsorted column ───────────────────────────────────
  it('sort button for inactive column has "Sort by [column]" aria-label', () => {
    renderTable({ sortKey: 'name', sortDir: 'asc' });
    // Email is inactive — should have simple "Sort by Email" label
    expect(
      screen.getByRole('button', { name: 'Sort by Email' }),
    ).toBeInTheDocument();
  });

  // ── Button aria-label: active ascending ──────────────────────────────────
  it('sort button for active-ascending column describes state + next action', () => {
    renderTable({ sortKey: 'name', sortDir: 'asc' });
    expect(
      screen.getByRole('button', {
        name: 'Sort by Name, currently ascending. Click to sort descending.',
      }),
    ).toBeInTheDocument();
  });

  // ── Button aria-label: active descending ─────────────────────────────────
  it('sort button for active-descending column describes state + next action', () => {
    renderTable({ sortKey: 'email', sortDir: 'desc' });
    expect(
      screen.getByRole('button', {
        name: 'Sort by Email, currently descending. Click to sort ascending.',
      }),
    ).toBeInTheDocument();
  });

  // ── Sort icon is aria-hidden ──────────────────────────────────────────────
  it('sort icon SVGs inside sort headers are aria-hidden="true"', () => {
    const { container } = renderTable({ sortKey: 'name', sortDir: 'asc' });
    // Find all <th> elements that have a sort button
    const sortButtons = container.querySelectorAll('th button');
    expect(sortButtons.length).toBeGreaterThan(0);
    for (const btn of sortButtons) {
      const svgs = btn.querySelectorAll('svg');
      for (const svg of svgs) {
        expect(svg).toHaveAttribute('aria-hidden', 'true');
      }
    }
  });

  // ── onSortChange fires ────────────────────────────────────────────────────
  it('clicking an inactive sort column header calls onSortChange with that key', async () => {
    const onSortChange = vi.fn();
    renderTable({ sortKey: 'name', sortDir: 'asc', onSortChange });
    await userEvent.click(screen.getByRole('button', { name: 'Sort by Email' }));
    expect(onSortChange).toHaveBeenCalledWith('email');
  });

  it('clicking the active sort column header calls onSortChange again (triggers direction toggle)', async () => {
    const onSortChange = vi.fn();
    renderTable({ sortKey: 'name', sortDir: 'asc', onSortChange });
    await userEvent.click(
      screen.getByRole('button', {
        name: 'Sort by Name, currently ascending. Click to sort descending.',
      }),
    );
    expect(onSortChange).toHaveBeenCalledWith('name');
  });

  // ── Regression: existing aria-labels still correct ───────────────────────
  it('RSVP dropdown button still has aria-label', () => {
    renderTable();
    expect(
      screen.getByRole('button', {
        name: `Change RSVP status for ${GUEST.full_name}, currently ${GUEST.rsvp_status}`,
      }),
    ).toBeInTheDocument();
  });

  it('select-all checkbox still has aria-label', () => {
    renderTable();
    expect(
      screen.getByRole('checkbox', { name: 'Select all guests' }),
    ).toBeInTheDocument();
  });

  it('per-row checkbox has aria-label with guest name', () => {
    renderTable();
    expect(
      screen.getByRole('checkbox', { name: `Select ${GUEST.full_name}` }),
    ).toBeInTheDocument();
  });
});

// ── Empty states ──────────────────────────────────────────────────────────

describe('GuestsTable — empty states', () => {
  it('renders "No guests yet" when guests=[] and filtered=false', () => {
    renderTable({ guests: [], filtered: false });
    expect(screen.getByText('No guests yet')).toBeInTheDocument();
  });

  it('renders filter empty state when guests=[] and filtered=true', () => {
    renderTable({ guests: [], filtered: true });
    expect(screen.getByText('No guests match your filters')).toBeInTheDocument();
  });

  it('Add guest button calls onAddGuest when not filtered', async () => {
    const onAddGuest = vi.fn();
    renderTable({ guests: [], filtered: false, onAddGuest });
    await userEvent.click(screen.getByText(/Add guest/i));
    expect(onAddGuest).toHaveBeenCalled();
  });

  it('Clear filters button calls onClearFilters when filtered', async () => {
    const onClearFilters = vi.fn();
    renderTable({ guests: [], filtered: true, onClearFilters });
    await userEvent.click(screen.getByText('Clear filters'));
    expect(onClearFilters).toHaveBeenCalled();
  });
});

// ── Row interaction ───────────────────────────────────────────────────────

describe('GuestsTable — row interaction', () => {
  it('clicking a data row calls onRowClick with the guest', async () => {
    const onRowClick = vi.fn();
    renderTable({ onRowClick });
    await userEvent.click(screen.getByText(GUEST.full_name));
    expect(onRowClick).toHaveBeenCalledWith(GUEST);
  });

  it('renders guest name, email, table assignment', () => {
    renderTable();
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    expect(screen.getByText('jane@example.com')).toBeInTheDocument();
    expect(screen.getByText('Table 3')).toBeInTheDocument();
  });
});
