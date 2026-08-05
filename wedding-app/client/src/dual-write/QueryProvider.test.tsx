import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useMutation } from '@tanstack/react-query';
import { QueryProvider } from './QueryProvider';
import { ToastProvider } from '../ui/Toast';
import { ApiError } from '../sdk/client';

function BoomButton({ withOwnHandler = false }: { withOwnHandler?: boolean }) {
  const mutation = useMutation({
    mutationFn: async () => {
      throw new ApiError('server', 500, 'internal-error', { error: 'internal-error', message: 'Disk full' });
    },
    ...(withOwnHandler ? { onError: (_e: unknown) => {} } : {}),
  });
  return (
    <button onClick={() => mutation.mutate()} data-testid="boom">
      Boom
    </button>
  );
}

function OfflineButton() {
  const mutation = useMutation({
    mutationFn: async () => {
      throw new ApiError('offline', 0, 'network-error');
    },
  });
  return <button onClick={() => mutation.mutate()}>Offline</button>;
}

function wrap(ui: React.ReactNode) {
  return render(
    <ToastProvider>
      <QueryProvider>{ui}</QueryProvider>
    </ToastProvider>,
  );
}

afterEach(() => { vi.restoreAllMocks(); });

describe('QueryProvider mutation error safety net (UX-6)', () => {
  it('shows a destructive toast when a mutation has no onError handler', async () => {
    wrap(<BoomButton />);
    await userEvent.click(screen.getByTestId('boom'));
    await waitFor(() => {
      expect(screen.getByText('Server error')).toBeTruthy();
    });
    expect(screen.getByText(/Disk full/)).toBeTruthy();
  });

  it('does not double-toast when the mutation handles its own error', async () => {
    wrap(<BoomButton withOwnHandler />);
    await userEvent.click(screen.getByTestId('boom'));
    // Give the global net a moment — it must NOT fire.
    await new Promise((r) => setTimeout(r, 150));
    expect(screen.queryByText('Server error')).toBeNull();
    expect(screen.queryByText(/Disk full/)).toBeNull();
  });

  it('skips offline errors (the write queue owns those)', async () => {
    wrap(<OfflineButton />);
    await userEvent.click(screen.getByText('Offline'));
    await new Promise((r) => setTimeout(r, 150));
    expect(screen.queryByText('Something went wrong')).toBeNull();
  });
});
