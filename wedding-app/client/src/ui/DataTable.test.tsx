import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DataTable, type Column } from './DataTable';

interface Row { id: string; name: string; count: number }
const data: Row[] = [
  { id: '1', name: 'Alpha', count: 10 },
  { id: '2', name: 'Beta',  count: 20 },
];
const columns: Column<Row>[] = [
  { id: 'name', header: 'Name', cell: (r) => r.name },
  { id: 'count', header: 'Count', cell: (r) => r.count },
];

describe('DataTable', () => {
  it('renders headers + rows', () => {
    render(<DataTable data={data} columns={columns} />);
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Alpha')).toBeInTheDocument();
    expect(screen.getByText('20')).toBeInTheDocument();
  });

  it('renders emptyMessage when no rows', () => {
    render(<DataTable data={[]} columns={columns} emptyMessage="Nothing here." />);
    expect(screen.getByText('Nothing here.')).toBeInTheDocument();
  });

  it('fires onRowClick', async () => {
    const onClick = vi.fn();
    render(<DataTable data={data} columns={columns} onRowClick={onClick} />);
    await userEvent.click(screen.getByText('Alpha'));
    expect(onClick).toHaveBeenCalledWith(data[0]);
  });
});
