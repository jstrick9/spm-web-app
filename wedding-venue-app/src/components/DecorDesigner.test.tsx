import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { DecorDesigner } from './DecorDesigner';
import { AuthProvider } from '../contexts/AuthContext';
import type { DecorItem, TableSpec } from '../types';

/**
 * Lightweight setup: seed the localStorage stores the designer reads on mount
 * with 1 base table (allowAsDecorBase) and 2 decor items, then render inside
 * the AuthProvider so `useAuth()` works.
 */
function seedStores() {
  const tableSpec: Partial<TableSpec> = {
    id: 'tbl-rect-8',
    name: 'Rectangular 8ft',
    width: 8,
    height: 4,
    shape: 'rectangle',
    allowAsDecorBase: true,
    isSeatingType: false,
    capacity: 8,
  };
  localStorage.setItem('spm_tableSpecs', JSON.stringify([tableSpec]));

  const items: DecorItem[] = [
    {
      id: 'decor-rose',
      name: 'Rose Centerpiece',
      categoryId: 'florals',
      width: 1,
      height: 1,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'decor-candle',
      name: 'Pillar Candle',
      categoryId: 'lighting',
      width: 0,
      height: 0,
      widthInches: 4,
      heightInches: 6,
      createdAt: new Date().toISOString(),
    },
  ];
  localStorage.setItem('spm_decor_catalog', JSON.stringify(items));
  localStorage.setItem('spm_decor_arrangements', JSON.stringify([]));
  localStorage.setItem('spm_decor_categories', JSON.stringify([
    { id: 'florals', name: 'Florals', createdAt: new Date().toISOString() },
    { id: 'lighting', name: 'Lighting', createdAt: new Date().toISOString() },
  ]));
}

function renderDesigner() {
  return render(
    <AuthProvider>
      <DecorDesigner onClose={() => {}} onSave={() => {}} />
    </AuthProvider>,
  );
}

describe('DecorDesigner — multi-select & duplicate', () => {
  beforeEach(() => {
    localStorage.clear();
    seedStores();
  });

  it('renders the header and a catalog item button', async () => {
    renderDesigner();
    expect(screen.getByLabelText(/Close Decor Designer/i)).toBeInTheDocument();
    // Catalog item button — name shows in uppercase via CSS but the text node is original.
    expect(await screen.findByText(/Rose Centerpiece/i)).toBeInTheDocument();
  });

  it('Cmd+A selects every placed decor item; Delete removes the whole selection', () => {
    renderDesigner();
    // Add two items by clicking the catalog buttons.
    const addRose = screen.getByText(/Rose Centerpiece/i).closest('button')!;
    const addCandle = screen.getByText(/Pillar Candle/i).closest('button')!;
    act(() => { fireEvent.click(addRose); });
    act(() => { fireEvent.click(addCandle); });

    // Cmd+A — select all.
    act(() => {
      fireEvent.keyDown(window, { key: 'a', metaKey: true });
    });

    // The properties panel header should show "2 selected".
    expect(screen.getByText(/2 selected/i)).toBeInTheDocument();

    // Delete — both items removed.
    act(() => {
      fireEvent.keyDown(window, { key: 'Delete' });
    });
    expect(screen.queryByText(/2 selected/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/1 selected/i)).not.toBeInTheDocument();
  });

  it('Cmd+D duplicates the current selection (count grows by selection size)', () => {
    renderDesigner();
    const addRose = screen.getByText(/Rose Centerpiece/i).closest('button')!;
    act(() => { fireEvent.click(addRose); });

    // The just-added item is auto-selected; selection size is 1 so the
    // properties panel header doesn't show a count badge yet — that's fine,
    // we assert via the duplicate keystroke producing a second item.
    act(() => {
      fireEvent.keyDown(window, { key: 'd', metaKey: true });
    });

    // After Cmd+D, the new duplicate is selected. Cmd+A then selects both.
    act(() => {
      fireEvent.keyDown(window, { key: 'a', metaKey: true });
    });
    expect(screen.getByText(/2 selected/i)).toBeInTheDocument();
  });

  it('Escape with no selection closes the designer (calls onClose)', () => {
    let closed = false;
    render(
      <AuthProvider>
        <DecorDesigner onClose={() => { closed = true; }} onSave={() => {}} />
      </AuthProvider>,
    );
    act(() => {
      fireEvent.keyDown(window, { key: 'Escape' });
    });
    expect(closed).toBe(true);
  });

  it('Rulers toggle persists across remounts via localStorage', () => {
    const { unmount } = renderDesigner();
    const toggle = screen.getByRole('button', { name: /rulers on/i });
    act(() => { fireEvent.click(toggle); });
    expect(screen.getByRole('button', { name: /rulers off/i })).toBeInTheDocument();
    unmount();

    renderDesigner();
    expect(screen.getByRole('button', { name: /rulers off/i })).toBeInTheDocument();
  });
});
