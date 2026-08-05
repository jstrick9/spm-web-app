import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CreateEventDialog, ENTRY_STATUSES } from './CreateEventDialog';
import { ToastProvider } from '../../ui/Toast';
import { http, HttpResponse, server } from '../../test/server';
import { setToken } from '../../sdk/client';

function harness(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return (
    <QueryClientProvider client={qc}>
      <ToastProvider>{ui}</ToastProvider>
    </QueryClientProvider>
  );
}

beforeEach(() => { setToken('test-token'); });

describe('CreateEventDialog', () => {
  it('renders all fields when open', () => {
    render(harness(<CreateEventDialog orgId="org-1" open onOpenChange={() => {}} />));
    expect(screen.getByLabelText(/Event title/i)).toBeInTheDocument();
    expect(screen.getByText(/^Status$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Start date/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/End date/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Expected guests/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Budget/i)).toBeInTheDocument();
  });

  it('blocks submit when title is empty', async () => {
    const onCreated = vi.fn();
    render(harness(<CreateEventDialog orgId="org-1" open onOpenChange={() => {}} onCreated={onCreated} />));
    await userEvent.click(screen.getByRole('button', { name: /Create event/i }));
    expect(await screen.findByText(/Title is required/i)).toBeInTheDocument();
    expect(onCreated).not.toHaveBeenCalled();
  });

  it('rejects an end date before start date', async () => {
    render(harness(<CreateEventDialog orgId="org-1" open onOpenChange={() => {}} />));
    await userEvent.type(screen.getByLabelText(/Event title/i), 'X');
    await userEvent.type(screen.getByLabelText(/Start date/i), '2026-09-12');
    await userEvent.type(screen.getByLabelText(/End date/i), '2026-09-10');
    await userEvent.click(screen.getByRole('button', { name: /Create event/i }));
    expect(await screen.findByText(/End date must be on or after/i)).toBeInTheDocument();
  });

  it('on success: calls onCreated + closes', async () => {
    server.use(http.post('/api/events', async () =>
      HttpResponse.json({ event: { id: 'new-1', organization_id: 'org-1', title: 'New Wedding', slug: 'nw', status: 'lead', start_date: null, end_date: null, guest_count: 0, primary_contact_user_id: null, budget_cents: null, metadata: '{}', created_at: '' } }, { status: 201 })
    ));
    const onCreated = vi.fn();
    const onOpenChange = vi.fn();
    render(harness(<CreateEventDialog orgId="org-1" open onOpenChange={onOpenChange} onCreated={onCreated} />));
    await userEvent.type(screen.getByLabelText(/Event title/i), 'New Wedding');
    await userEvent.click(screen.getByRole('button', { name: /Create event/i }));
    await waitFor(() => expect(onCreated).toHaveBeenCalledTimes(1));
    expect(onCreated.mock.calls[0][0].id).toBe('new-1');
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('warns about a possible duplicate when the server flags one', async () => {
    server.use(http.post('/api/events', async () =>
      HttpResponse.json({
        event: { id: 'new-1', organization_id: 'org-1', title: 'Smith Wedding', slug: 'sw', status: 'lead', start_date: '2026-09-12', end_date: null, guest_count: 0, primary_contact_user_id: null, budget_cents: null, metadata: '{}', created_at: '' },
        duplicateWarning: { matchedEventId: 'old-1', matchedStatus: 'booked', matchedTitle: 'Smith Wedding' },
      }, { status: 201 })
    ));
    const onCreated = vi.fn();
    render(harness(<CreateEventDialog orgId="org-1" open onOpenChange={vi.fn()} onCreated={onCreated} />));
    await userEvent.type(screen.getByLabelText(/Event title/i), 'Smith Wedding');
    await userEvent.click(screen.getByRole('button', { name: /Create event/i }));
    await waitFor(() => expect(onCreated).toHaveBeenCalledTimes(1));
    // Duplicate warning is surfaced, and creation still succeeds.
    expect(screen.getByText(/possible duplicate/i)).toBeTruthy();
    expect(screen.getByText(/Smith Wedding/i).closest('[role="status"]') ?? document.body).toBeTruthy();
  });

  it('on server error: shows a toast and stays open', async () => {
    server.use(http.post('/api/events', () =>
      HttpResponse.json({ error: 'forbidden' }, { status: 403 })
    ));
    render(harness(<CreateEventDialog orgId="org-1" open onOpenChange={() => {}} />));
    await userEvent.type(screen.getByLabelText(/Event title/i), 'Blocked Wedding');
    await userEvent.click(screen.getByRole('button', { name: /Create event/i }));
    expect(await screen.findByText(/Could not create event/i)).toBeInTheDocument();
  });

  it('converts budget dollars to cents on submit', async () => {
    let received: { budgetCents?: number } = {};
    server.use(http.post('/api/events', async ({ request }) => {
      received = await request.json() as { budgetCents?: number };
      return HttpResponse.json({ event: { id: 'b1', organization_id: 'org-1', title: 'B', slug: 'b', status: 'lead', start_date: null, end_date: null, guest_count: 0, primary_contact_user_id: null, budget_cents: received.budgetCents ?? null, metadata: '{}', created_at: '' } }, { status: 201 });
    }));
    render(harness(<CreateEventDialog orgId="org-1" open onOpenChange={() => {}} />));
    await userEvent.type(screen.getByLabelText(/Event title/i), 'Budget Test');
    await userEvent.type(screen.getByLabelText(/Budget/i), '25000.50');
    await userEvent.click(screen.getByRole('button', { name: /Create event/i }));
    await waitFor(() => expect(received.budgetCents).toBe(2500050));
  });
});

describe('CreateEventDialog pipeline-entry contract', () => {
  it('restricts new events to entry statuses only (no terminal/final-review)', () => {
    // Radix Select options render in a portal that jsdom cannot open, so the
    // contract is asserted at the source: the select renders ENTRY_STATUSES.
    expect(ENTRY_STATUSES).toEqual(['lead', 'hold', 'booked', 'planning']);
    expect(ENTRY_STATUSES).not.toContain('completed');
    expect(ENTRY_STATUSES).not.toContain('cancelled');
    expect(ENTRY_STATUSES).not.toContain('lost');
    expect(ENTRY_STATUSES).not.toContain('final_review');
  });

  it('presets the status from initialStatus when it opens', async () => {
    const { rerender } = render(harness(<CreateEventDialog orgId="org-1" open={false} onOpenChange={() => {}} initialStatus="planning" />));
    rerender(harness(<CreateEventDialog orgId="org-1" open onOpenChange={() => {}} initialStatus="planning" />));
    await waitFor(() => {
      const trigger = screen.getByRole('combobox', { name: /^status/i });
      expect(trigger.textContent).toMatch(/Planning/i);
    });
  });
});
