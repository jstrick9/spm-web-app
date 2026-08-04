import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { usePrompt } from './usePrompt';

/** Harness that exposes the hook's API to the test via buttons. */
function Harness() {
  const { ask, askForm, askConfirm, promptNode } = usePrompt();
  const [result, setResult] = useState<string>('none');
  return (
    <div>
      <button onClick={async () => setResult((await ask({ title: 'Add a note', label: 'Note', required: true })) ?? 'cancelled')}>
        open prompt
      </button>
      <button onClick={async () => setResult((await askForm({ title: 'Contact', fields: [{ key: 'name', label: 'Name', required: true }, { key: 'phone', label: 'Phone' }] }))?.name ?? 'cancelled')}>
        open form
      </button>
      <button onClick={async () => setResult((await askConfirm({ title: 'Delete?', destructive: true })) ? 'confirmed' : 'cancelled')}>
        open confirm
      </button>
      <span data-testid="result">{result}</span>
      {promptNode}
    </div>
  );
}

describe('usePrompt dialogs', () => {
  it('resolves the entered value on Save and null on Cancel (required enforced)', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: /open prompt/i }));
    expect(await screen.findByRole('dialog')).toBeTruthy();

    // Required: empty Save does not close.
    await user.click(screen.getByRole('button', { name: /^Save$/ }));
    expect(screen.getByText(/this field is required/i)).toBeTruthy();
    expect(screen.getByRole('dialog')).toBeTruthy();

    await user.type(screen.getByLabelText(/^note$/i), 'Bring the tent');
    await user.click(screen.getByRole('button', { name: /^Save$/ }));
    await waitFor(() => expect(screen.getByTestId('result').textContent).toBe('Bring the tent'));
  });

  it('cancels via the Cancel button and Escape', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: /open prompt/i }));
    await user.click(await screen.findByRole('button', { name: /cancel/i }));
    expect(screen.getByTestId('result').textContent).toBe('cancelled');

    await user.click(screen.getByRole('button', { name: /open prompt/i }));
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    await waitFor(() => expect(screen.getByTestId('result').textContent).toBe('cancelled'));
  });

  it('multi-field form returns the record; required fields are enforced', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: /open form/i }));
    await user.click(await screen.findByRole('button', { name: /^Save$/ }));
    expect(screen.getByText(/fill in all required fields/i)).toBeTruthy();

    await user.type(screen.getByLabelText(/name/i), 'Avery');
    await user.type(screen.getByLabelText(/phone/i), '555-0100');
    await user.click(screen.getByRole('button', { name: /^Save$/ }));
    await waitFor(() => expect(screen.getByTestId('result').textContent).toBe('Avery'));
  });

  it('confirm dialog resolves true/false', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: /open confirm/i }));
    await user.click(await screen.findByRole('button', { name: /confirm/i }));
    expect(screen.getByTestId('result').textContent).toBe('confirmed');

    await user.click(screen.getByRole('button', { name: /open confirm/i }));
    await user.click(await screen.findByRole('button', { name: /cancel/i }));
    expect(screen.getByTestId('result').textContent).toBe('cancelled');
  });
});
