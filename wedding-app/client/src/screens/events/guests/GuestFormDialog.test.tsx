import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GuestFormDialog } from './GuestFormDialog';
import { ToastProvider } from '../../../ui/Toast';
import { http, HttpResponse, server } from '../../../test/server';
import { setToken } from '../../../sdk/client';
import type { SdkGuest } from '../../../sdk/types';

function harness(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return (
    <QueryClientProvider client={qc}>
      <ToastProvider>{ui}</ToastProvider>
    </QueryClientProvider>
  );
}

beforeEach(() => { setToken('test-token'); });

const SAMPLE_GUEST: SdkGuest = {
  id: 'g1', organization_id: 'org-1', event_id: 'evt-1',
  full_name: 'Aunt Mary', email: 'aunt@example.com', phone: null,
  party_name: null, rsvp_status: 'pending',
  dietary_restrictions: null, accessibility_notes: null,
  table_assignment: null, room_assignment: null, seat_assignment: null,
  plus_one_allowed: 0, allow_portal_access: 1, allow_lodging_access: 0,
  metadata: '{}', created_at: '',
};

describe('GuestFormDialog — create mode', () => {
  it('renders all the key fields', () => {
    render(harness(<GuestFormDialog eventId="evt-1" open onOpenChange={() => {}} />));
    expect(screen.getByLabelText(/Full name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Phone/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Party.*household/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Table/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Dietary restrictions/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Accessibility notes/i)).toBeInTheDocument();
  });

  it('blocks submit when name is empty', async () => {
    render(harness(<GuestFormDialog eventId="evt-1" open onOpenChange={() => {}} />));
    await userEvent.click(screen.getByRole('button', { name: /Add guest/i }));
    expect(await screen.findByText(/Name is required/i)).toBeInTheDocument();
  });

  it('rejects invalid email', async () => {
    render(harness(<GuestFormDialog eventId="evt-1" open onOpenChange={() => {}} />));
    await userEvent.type(screen.getByLabelText(/Full name/i), 'Test');
    await userEvent.type(screen.getByLabelText(/Email/i), 'not-an-email');
    await userEvent.click(screen.getByRole('button', { name: /Add guest/i }));
    expect(await screen.findByText(/Invalid email/i)).toBeInTheDocument();
  });

  it('on success: calls onSaved + closes', async () => {
    let postedBody: { fullName?: string; email?: string } = {};
    server.use(
      http.post('/api/events/:eventId/guests', async ({ request }) => {
        postedBody = await request.json() as typeof postedBody;
        return HttpResponse.json(
          { guest: { ...SAMPLE_GUEST, id: 'new-1', full_name: postedBody.fullName ?? '' } },
          { status: 201 },
        );
      }),
    );
    const onSaved = vi.fn();
    const onOpenChange = vi.fn();
    render(harness(<GuestFormDialog eventId="evt-1" open onOpenChange={onOpenChange} onSaved={onSaved} />));
    await userEvent.type(screen.getByLabelText(/Full name/i), 'Uncle Bob');
    await userEvent.type(screen.getByLabelText(/Email/i), 'bob@example.com');
    await userEvent.click(screen.getByRole('button', { name: /Add guest/i }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    expect(postedBody.fullName).toBe('Uncle Bob');
    expect(postedBody.email).toBe('bob@example.com');
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('toggle "plus-one allowed" sends boolean true to server', async () => {
    let posted: { plusOneAllowed?: boolean } = {};
    server.use(
      http.post('/api/events/:eventId/guests', async ({ request }) => {
        posted = await request.json() as typeof posted;
        return HttpResponse.json({ guest: { ...SAMPLE_GUEST, id: 'p1' } }, { status: 201 });
      }),
    );
    render(harness(<GuestFormDialog eventId="evt-1" open onOpenChange={() => {}} />));
    await userEvent.type(screen.getByLabelText(/Full name/i), 'PlusOne Person');
    await userEvent.click(screen.getByLabelText(/Plus-one allowed/i));
    await userEvent.click(screen.getByRole('button', { name: /Add guest/i }));
    await waitFor(() => expect(posted.plusOneAllowed).toBe(true));
  });

  it('on server error: surfaces a toast and stays open', async () => {
    server.use(
      http.post('/api/events/:eventId/guests', () =>
        HttpResponse.json({ error: 'forbidden' }, { status: 403 })),
    );
    render(harness(<GuestFormDialog eventId="evt-1" open onOpenChange={() => {}} />));
    await userEvent.type(screen.getByLabelText(/Full name/i), 'Blocked');
    await userEvent.click(screen.getByRole('button', { name: /Add guest/i }));
    expect(await screen.findByText(/Could not add guest/i)).toBeInTheDocument();
  });
});

describe('GuestFormDialog — edit mode', () => {
  it('pre-fills the form with the guest values', async () => {
    const filledGuest = {
      ...SAMPLE_GUEST,
      full_name: 'Cousin Lin',
      email: 'lin@example.com',
      party_name: 'Lin family',
      dietary_restrictions: 'Vegan',
      plus_one_allowed: 1 as const,
    };
    render(harness(<GuestFormDialog guest={filledGuest} open onOpenChange={() => {}} />));
    expect(screen.getByLabelText(/Full name/i)).toHaveValue('Cousin Lin');
    expect(screen.getByLabelText(/Email/i)).toHaveValue('lin@example.com');
    expect(screen.getByLabelText(/Party.*household/i)).toHaveValue('Lin family');
    expect(screen.getByLabelText(/Dietary restrictions/i)).toHaveValue('Vegan');
  });

  it('PATCH on save', async () => {
    let patched: { fullName?: string } = {};
    server.use(
      http.patch('/api/guests/:id', async ({ request, params }) => {
        patched = await request.json() as typeof patched;
        return HttpResponse.json({
          guest: { ...SAMPLE_GUEST, id: params.id as string, full_name: patched.fullName ?? SAMPLE_GUEST.full_name },
        });
      }),
    );
    render(harness(<GuestFormDialog guest={SAMPLE_GUEST} open onOpenChange={() => {}} />));
    const nameInput = screen.getByLabelText(/Full name/i);
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, 'Aunt Marigold');
    await userEvent.click(screen.getByRole('button', { name: /Save changes/i }));
    await waitFor(() => expect(patched.fullName).toBe('Aunt Marigold'));
  });
});
