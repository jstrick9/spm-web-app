/**
 * DataTable tests — Phase 34c (replaces + extends the existing 3-test file)
 *
 * Existing tests preserved verbatim:
 *   ✅ renders headers + rows
 *   ✅ renders emptyMessage when no rows
 *   ✅ fires onRowClick
 *
 * Phase 34c additions — aria-sort compliance:
 *   ✅ non-sortable column has no aria-sort attribute
 *   ✅ sortable column with sortDir="none" gets aria-sort="none"
 *   ✅ sortable column with sortDir="ascending" gets aria-sort="ascending"
 *   ✅ sortable column with sortDir="descending" gets aria-sort="descending"
 *   ✅ aria-sort is on the <th>, not on the button inside
 *   ✅ sort button has aria-label for unsorted state
 *   ✅ sort button has aria-label describing current state + next action (asc)
 *   ✅ sort button has aria-label describing current state + next action (desc)
 *   ✅ sort icon is aria-hidden="true"
 *   ✅ onSort fires when sort button clicked
 *   ✅ non-sortable column header renders without a button
 *   ✅ sortable column header renders with a button
 *   ✅ tableLabel sets aria-label on <table>
 *   ✅ mixed sortable + non-sortable columns in same table
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DataTable, type Column } from './DataTable';

// ── Shared fixtures ────────────────────────────────────────────────────────

interface Row { id: string; name: string; count: number }

const data: Row[] = [
  { id: '1', name: 'Alpha', count: 10 },
  { id: '2', name: 'Beta',  count: 20 },
];

const staticColumns: Column<Row>[] = [
  { id: 'name',  header: 'Name',  cell: (r) => r.name  },
  { id: 'count', header: 'Count', cell: (r) => r.count },
];

// ── Original tests (preserved) ─────────────────────────────────────────────

describe('DataTable — original behaviour', () => {
  it('renders headers + rows', () => {
    render(<DataTable data={data} columns={staticColumns} />);
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('20')).toBeInTheDocument();
  });

  it('renders emptyMessage when no rows', () => {
    render(
      <DataTable data={[]} columns={staticColumns} emptyMessage="Nothing here." />,
    );
    expect(screen.getByText('Nothing here.')).toBeInTheDocument();
  });

  it('fires onRowClick', async () => {
    const onClick = vi.fn();
    render(<DataTable data={data} columns={staticColumns} onRowClick={onClick} />);
    await userEvent.click(screen.getByText('Alpha'));
    expect(onClick).toHaveBeenCalledWith(data[0]);
  });
});

// ── Phase 34c: aria-sort tests ─────────────────────────────────────────────

describe('DataTable — aria-sort (Phase 34c, WCAG 1.3.1 / ARIA 1.2)', () => {
  // Helper: build a column that is sortable
  function sortableCol(
    overrides: Partial<Column<Row>> = {},
  ): Column<Row> {
    return {
      id:      'name',
      header:  'Name',
      cell:    (r) => r.name,
      onSort:  vi.fn(),
      sortDir: 'none',
      ...overrides,
    };
  }

  // ── Non-sortable column: NO aria-sort at all ────────────────────────────
  it('non-sortable column has NO aria-sort attribute', () => {
    render(<DataTable data={data} columns={staticColumns} />);
    const ths = screen.getAllByRole('columnheader');
    for (const th of ths) {
      // aria-sort must be completely absent, not just "none"
      expect(th).not.toHaveAttribute('aria-sort');
    }
  });

  it('non-sortable column header renders a plain element, not a button', () => {
    render(<DataTable data={data} columns={staticColumns} />);
    // No button elements inside column headers for non-sortable columns
    const ths = screen.getAllByRole('columnheader');
    for (const th of ths) {
      const btn = th.querySelector('button');
      expect(btn).toBeNull();
    }
  });

  // ── sortDir="none" → aria-sort="none" ──────────────────────────────────
  it('sortable column with sortDir="none" gets aria-sort="none"', () => {
    const col = sortableCol({ sortDir: 'none' });
    render(<DataTable data={data} columns={[col]} />);
    const th = screen.getByRole('columnheader', { name: /Name/i });
    expect(th).toHaveAttribute('aria-sort', 'none');
  });

  // ── sortDir="ascending" → aria-sort="ascending" ────────────────────────
  it('sortable column with sortDir="ascending" gets aria-sort="ascending"', () => {
    const col = sortableCol({ sortDir: 'ascending' });
    render(<DataTable data={data} columns={[col]} />);
    const th = screen.getByRole('columnheader', { name: /Name/i });
    expect(th).toHaveAttribute('aria-sort', 'ascending');
  });

  // ── sortDir="descending" → aria-sort="descending" ──────────────────────
  it('sortable column with sortDir="descending" gets aria-sort="descending"', () => {
    const col = sortableCol({ sortDir: 'descending' });
    render(<DataTable data={data} columns={[col]} />);
    const th = screen.getByRole('columnheader', { name: /Name/i });
    expect(th).toHaveAttribute('aria-sort', 'descending');
  });

  // ── aria-sort is on <th>, not on the button ─────────────────────────────
  it('aria-sort is on the <th>, not on the button inside', () => {
    const col = sortableCol({ sortDir: 'ascending' });
    render(<DataTable data={data} columns={[col]} />);

    const th = screen.getByRole('columnheader', { name: /Name/i });
    expect(th.tagName).toBe('TH');
    expect(th).toHaveAttribute('aria-sort', 'ascending');

    const btn = th.querySelector('button');
    expect(btn).not.toBeNull();
    expect(btn).not.toHaveAttribute('aria-sort');
  });

  // ── Button aria-label: unsorted state ──────────────────────────────────
  it('sort button has correct aria-label for unsorted column', () => {
    const col = sortableCol({ sortDir: 'none' });
    render(<DataTable data={data} columns={[col]} />);
    const btn = screen.getByRole('button', { name: 'Sort by Name' });
    expect(btn).toBeInTheDocument();
  });

  // ── Button aria-label: ascending state ─────────────────────────────────
  it('sort button aria-label describes ascending state and next action', () => {
    const col = sortableCol({ sortDir: 'ascending' });
    render(<DataTable data={data} columns={[col]} />);
    const btn = screen.getByRole('button', {
      name: 'Sort by Name, currently ascending. Click to sort descending.',
    });
    expect(btn).toBeInTheDocument();
  });

  // ── Button aria-label: descending state ────────────────────────────────
  it('sort button aria-label describes descending state and next action', () => {
    const col = sortableCol({ sortDir: 'descending' });
    render(<DataTable data={data} columns={[col]} />);
    const btn = screen.getByRole('button', {
      name: 'Sort by Name, currently descending. Click to clear sort.',
    });
    expect(btn).toBeInTheDocument();
  });

  // ── Custom sortLabel override ───────────────────────────────────────────
  it('sortLabel prop overrides the generated aria-label', () => {
    const col = sortableCol({
      sortDir:   'none',
      sortLabel: 'Sort guests by name',
    });
    render(<DataTable data={data} columns={[col]} />);
    expect(
      screen.getByRole('button', { name: 'Sort guests by name' }),
    ).toBeInTheDocument();
  });

  // ── Sort icon is aria-hidden ────────────────────────────────────────────
  it('sort icon SVG is aria-hidden="true"', () => {
    const col = sortableCol({ sortDir: 'ascending' });
    const { container } = render(<DataTable data={data} columns={[col]} />);
    const th = container.querySelector('th');
    // All SVG icons inside the sort header should be aria-hidden
    const svgs = th?.querySelectorAll('svg');
    expect(svgs?.length).toBeGreaterThan(0);
    svgs?.forEach((svg) => {
      expect(svg).toHaveAttribute('aria-hidden', 'true');
    });
  });

  // ── onSort fires ───────────────────────────────────────────────────────
  it('clicking the sort button fires onSort', async () => {
    const onSort = vi.fn();
    const col = sortableCol({ onSort, sortDir: 'none' });
    render(<DataTable data={data} columns={[col]} />);
    await userEvent.click(screen.getByRole('button', { name: /Sort by Name/i }));
    expect(onSort).toHaveBeenCalledOnce();
  });

  // ── Sortable column renders as button ──────────────────────────────────
  it('sortable column header contains a button', () => {
    const col = sortableCol({ sortDir: 'none' });
    render(<DataTable data={data} columns={[col]} />);
    const th = screen.getByRole('columnheader', { name: /Name/i });
    const btn = th.querySelector('button');
    expect(btn).not.toBeNull();
  });

  // ── tableLabel sets aria-label on <table> ──────────────────────────────
  it('tableLabel sets aria-label on the <table> element', () => {
    render(
      <DataTable
        data={data}
        columns={staticColumns}
        tableLabel="Guest list"
      />,
    );
    const table = screen.getByRole('table', { name: 'Guest list' });
    expect(table).toBeInTheDocument();
  });

  // ── Mixed: sortable + non-sortable in same table ───────────────────────
  it('mixed table: sortable cols get aria-sort, non-sortable do not', () => {
    const cols: Column<Row>[] = [
      {
        id: 'name', header: 'Name', cell: (r) => r.name,
        onSort: vi.fn(), sortDir: 'ascending',
      },
      {
        id: 'count', header: 'Count', cell: (r) => r.count,
        // no onSort, no sortDir → not sortable
      },
    ];
    render(<DataTable data={data} columns={cols} />);

    const nameHeader  = screen.getByRole('columnheader', { name: /Name/i });
    const countHeader = screen.getByRole('columnheader', { name: 'Count' });

    expect(nameHeader).toHaveAttribute('aria-sort', 'ascending');
    expect(countHeader).not.toHaveAttribute('aria-sort');
  });

  // ── Only one column can be ascending/descending at once ────────────────
  it('only the active sort column is ascending/descending; others are "none"', () => {
    const cols: Column<Row>[] = [
      {
        id: 'name',  header: 'Name',  cell: (r) => r.name,
        onSort: vi.fn(), sortDir: 'ascending',  // active
      },
      {
        id: 'count', header: 'Count', cell: (r) => r.count,
        onSort: vi.fn(), sortDir: 'none',        // inactive
      },
    ];
    render(<DataTable data={data} columns={cols} />);

    const nameHeader  = screen.getByRole('columnheader', { name: /Name/i });
    const countHeader = screen.getByRole('columnheader', { name: /Count/i });

    expect(nameHeader).toHaveAttribute('aria-sort', 'ascending');
    expect(countHeader).toHaveAttribute('aria-sort', 'none');
  });
});
