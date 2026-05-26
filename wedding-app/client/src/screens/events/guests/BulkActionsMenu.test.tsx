import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BulkActionsMenu } from './BulkActionsMenu';
import { ToastProvider } from '../../../ui/Toast';
import { http, HttpResponse, server } from '../../../test/server';
import { setToken } from '../../../sdk/client';

function harness(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return (
    <QueryClientProvider client={qc}>
      <ToastProvider>{ui}</ToastProvider>
    </QueryClientProvider>
  );
}

beforeEach(() => { setToken('test-token'); });

describe('BulkActionsMenu', () => {
  it('shows the selected count', () => {
    render(harness(<BulkActionsMenu eventId="evt-1" selectedIds={['g1','g2','g3']} onCleared={vi.fn()} />));
    expect(screen.getByText(/3 selected/i)).toBeInTheDocument();
  });

  it('clearing button calls onCleared', async () => {
    const onCleared = vi.fn();
    render(harness(<BulkActionsMenu eventId="evt-1" selectedIds={['g1']} onCleared={onCleared} />));
    await userEvent.click(screen.getByRole('button', { name: /Clear selection/i }));
    expect(onCleared).toHaveBeenCalledTimes(1);
  });

  it('bulk-set RSVP fires one PATCH per selected guest', async () => {
    const seen: Array<{ id: string; body: { rsvpStatus?: string } }> = [];
    server.use(
      http.patch('/api/guests/:id', async ({ request, params }) => {
        const body = await request.json() as { rsvpStatus?: string };
        seen.push({ id: params.id as string, body });
        return HttpResponse.json({ guest: { id: params.id, full_name: '', rsvp_status: body.rsvpStatus } });
      }),
    );
    const onCleared = vi.fn();
    render(harness(<BulkActionsMenu eventId="evt-1" selectedIds={['g1','g2']} onCleared={onCleared} />));
    await userEvent.click(screen.getByRole('button', { name: /Actions/i }));
    await userEvent.click(await screen.findByRole('menuitem', { name: /Attending/i }));
    await waitFor(() => expect(seen).toHaveLength(2));
    expect(seen.every((s) => s.body.rsvpStatus === 'attending')).toBe(true);
    expect(onCleared).toHaveBeenCalled();
  });

  it('partial failure surfaces "N of M updated" toast', async () => {
    let i = 0;
    server.use(
      http.patch('/api/guests/:id', () => {
        i += 1;
        if (i === 2) return HttpResponse.json({ error: 'server-error' }, { status: 500 });
        return HttpResponse.json({ guest: {} });
      }),
    );
    render(harness(<BulkActionsMenu eventId="evt-1" selectedIds={['g1','g2','g3']} onCleared={vi.fn()} />));
    await userEvent.click(screen.getByRole('button', { name: /Actions/i }));
    await userEvent.click(await screen.findByRole('menuitem', { name: /Declined/i }));
    expect(await screen.findByText(/Updated 2 of 3/i)).toBeInTheDocument();
  });

  it('bulk delete < 5 items: single-click confirm works', async () => {
    const seen: string[] = [];
    server.use(
      http.delete('/api/guests/:id', ({ params }) => {
        seen.push(params.id as string);
        return new HttpResponse(null, { status: 204 });
      }),
    );
    render(harness(<BulkActionsMenu eventId="evt-1" selectedIds={['g1','g2']} onCleared={vi.fn()} />));
    await userEvent.click(screen.getByRole('button', { name: /Actions/i }));
    await userEvent.click(await screen.findByRole('menuitem', { name: /Delete 2 guests/i }));
    // Confirm dialog appears; click its Delete button
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: /^Delete$/ }));
    await waitFor(() => expect(seen).toHaveLength(2));
  });

  it('bulk delete >= 5 items requires typing DELETE', async () => {
    render(harness(<BulkActionsMenu eventId="evt-1" selectedIds={['1','2','3','4','5','6']} onCleared={vi.fn()} />));
    await userEvent.click(screen.getByRole('button', { name: /Actions/i }));
    await userEvent.click(await screen.findByRole('menuitem', { name: /Delete 6 guests/i }));
    const dialog = await screen.findByRole('dialog');
    const deleteBtn = within(dialog).getByRole('button', { name: /^Delete$/ });
    expect(deleteBtn).toBeDisabled();
    await userEvent.type(within(dialog).getByLabelText(/Type DELETE/i), 'DELETE');
    expect(deleteBtn).not.toBeDisabled();
  });
});

// Tiny helper to scope queries inside an element (saves importing 'within')
import { within } from '@testing-library/react';
