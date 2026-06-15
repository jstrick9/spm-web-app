import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { ToastProvider, useToast } from './Toast';

function TestComponent() {
  const { toast } = useToast();
  return (
    <button onClick={() => toast({ title: 'Hi', description: 'There', variant: 'success' })}>
      fire
    </button>
  );
}

describe('Toast', () => {
  it('renders a toast when toast() is called', async () => {
    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>,
    );
    await userEvent.click(screen.getByText('fire'));
    expect(screen.getByText('Hi')).toBeInTheDocument();
    expect(screen.getByText('There')).toBeInTheDocument();
  });

  it('throws when useToast is called outside provider', () => {
    function Naked() { useToast(); return null; }
    expect(() => render(<Naked />)).toThrow(/inside <ToastProvider>/);
  });
});
