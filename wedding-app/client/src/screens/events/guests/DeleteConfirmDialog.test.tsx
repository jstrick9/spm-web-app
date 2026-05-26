import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DeleteConfirmDialog } from './DeleteConfirmDialog';

describe('DeleteConfirmDialog', () => {
  it('shows "Delete guest?" for a single item', () => {
    render(<DeleteConfirmDialog open count={1} onOpenChange={vi.fn()} onConfirm={vi.fn()} />);
    expect(screen.getByRole('heading', { name: /Delete guest\?/i })).toBeInTheDocument();
  });

  it('shows "Delete N guests?" for a bulk operation', () => {
    render(<DeleteConfirmDialog open count={3} onOpenChange={vi.fn()} onConfirm={vi.fn()} />);
    expect(screen.getByRole('heading', { name: /Delete 3 guests\?/i })).toBeInTheDocument();
  });

  it('< 5 items: Delete button enabled immediately', () => {
    render(<DeleteConfirmDialog open count={2} onOpenChange={vi.fn()} onConfirm={vi.fn()} />);
    expect(screen.getByRole('button', { name: /^Delete$/ })).not.toBeDisabled();
  });

  it('>= 5 items: typing DELETE enables the button', async () => {
    render(<DeleteConfirmDialog open count={7} onOpenChange={vi.fn()} onConfirm={vi.fn()} />);
    const btn = screen.getByRole('button', { name: /^Delete$/ });
    expect(btn).toBeDisabled();
    await userEvent.type(screen.getByLabelText(/Type DELETE/i), 'delete');
    expect(btn).toBeDisabled();  // case-sensitive
    await userEvent.clear(screen.getByLabelText(/Type DELETE/i));
    await userEvent.type(screen.getByLabelText(/Type DELETE/i), 'DELETE');
    expect(btn).not.toBeDisabled();
  });

  it('clicking Cancel closes the dialog', async () => {
    const onOpenChange = vi.fn();
    render(<DeleteConfirmDialog open count={1} onOpenChange={onOpenChange} onConfirm={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: /Cancel/i }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('clicking Delete invokes onConfirm', async () => {
    const onConfirm = vi.fn();
    render(<DeleteConfirmDialog open count={1} onOpenChange={vi.fn()} onConfirm={onConfirm} />);
    await userEvent.click(screen.getByRole('button', { name: /^Delete$/ }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
