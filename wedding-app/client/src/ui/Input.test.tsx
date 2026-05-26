import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { Input } from './Input';

function ControlledInput() {
  const [v, setV] = useState('');
  return <Input value={v} onChange={(e) => setV(e.target.value)} placeholder="x" />;
}

describe('Input', () => {
  it('forwards value + onChange', async () => {
    render(<ControlledInput />);
    const input = screen.getByPlaceholderText('x') as HTMLInputElement;
    await userEvent.type(input, 'hi');
    expect(input.value).toBe('hi');
  });

  it('invalid=true sets aria-invalid', () => {
    render(<Input invalid placeholder="x" />);
    expect(screen.getByPlaceholderText('x')).toHaveAttribute('aria-invalid', 'true');
  });

  it('renders with start and end slots', () => {
    render(<Input startSlot={<span data-testid="s">S</span>} endSlot={<span data-testid="e">E</span>} placeholder="x" />);
    expect(screen.getByTestId('s')).toBeInTheDocument();
    expect(screen.getByTestId('e')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('x')).toBeInTheDocument();
  });
});
