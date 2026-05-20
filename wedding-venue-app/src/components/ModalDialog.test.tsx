import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ModalDialog } from './ModalDialog';

describe('ModalDialog', () => {
  it('renders a dialog with accessible title and description', () => {
    render(
      <ModalDialog
        title="Test Dialog"
        description="Dialog description"
        onClose={() => undefined}
      >
        <button type="button">Inner Action</button>
      </ModalDialog>,
    );

    expect(screen.getByRole('dialog', { name: /test dialog/i })).toBeInTheDocument();
    expect(screen.getByText('Dialog description')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Inner Action' })).toBeInTheDocument();
  });

  it('calls onClose when escape is pressed', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(
      <ModalDialog title="Test Dialog" onClose={onClose}>
        <button type="button">Inner Action</button>
      </ModalDialog>,
    );

    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when backdrop is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(
      <ModalDialog title="Test Dialog" onClose={onClose}>
        <button type="button">Inner Action</button>
      </ModalDialog>,
    );

    const dialog = screen.getByRole('dialog', { name: /test dialog/i });
    const backdrop = dialog.parentElement;

    expect(backdrop).toBeTruthy();
    if (!backdrop) throw new Error('Backdrop not found');

    await user.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});