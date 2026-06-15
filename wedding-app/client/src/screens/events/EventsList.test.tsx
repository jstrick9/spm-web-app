import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { EventsList } from './EventsList';
import { ConfigProvider } from '../../config/ConfigProvider';
import { ToastProvider } from '../../ui/Toast';
import { http, HttpResponse, server } from '../../test/server';
import { setToken } from '../../sdk/client';

const ORG = 'org-1';

function harness(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={qc}>
      <ConfigProvider>
        <ToastProvider>{ui}</ToastProvider>
      </ConfigProvider>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  localStorage.clear();
  setToken('test-token');
});

const sampleEvents = [
  { id: 'e1', organization_id: ORG, title: 'Smith Wedding',  slug: 'smith',  status: 'booked',   start_date: '2026-09-12', end_date: null, guest_count: 80, primary_contact_user_id: null, budget_cents: 2500000, metadata: '{}', created_at: '' },
  { id: 'e2', organization_id: ORG, title: 'Jones Wedding',  slug: 'jones',  status: 'planning', start_date: '2026-10-15', end_date: null, guest_count: 50, primary_contact_user_id: null, budget_cents: null,    metadata: '{}', created_at: '' },
  { id: 'e3', organization_id: ORG, title: 'Lee Reception',  slug: 'lee',    status: 'lead',     start_date: null,         end_date: null, guest_count: 0,  primary_contact_user_id: null, budget_cents: null,    metadata: '{}', created_at: '' },
];

describe('EventsList', () => {
  it('renders the page header and toolbar', async () => {
    server.use(http.get('/api/orgs/:orgId/events', () =>
      HttpResponse.json({ events: [], counts: { lead: 0, hold: 0, booked: 0, planning: 0, completed: 0, cancelled: 0, lost: 0 } })
    ));
    render(harness(<EventsList orgId={ORG} />));
    expect(await screen.findByRole('heading', { name: /^Events$/ })).toBeInTheDocument();
    // Search input
    expect(screen.getByPlaceholderText(/Search events/i)).toBeInTheDocument();
    // Status chips - All + 7 statuses
    expect(screen.getAllByRole('button', { name: /^All\s/ }).length).toBeGreaterThan(0);
  });

  it('renders kanban columns by default with grouped events', async () => {
    server.use(http.get('/api/orgs/:orgId/events', () =>
      HttpResponse.json({
        events: sampleEvents,
        counts: { lead: 1, hold: 0, booked: 1, planning: 1, completed: 0, cancelled: 0, lost: 0 },
      })
    ));
    render(harness(<EventsList orgId={ORG} />));
    expect(await screen.findByText('Smith Wedding')).toBeInTheDocument();
    expect(screen.getByText('Jones Wedding')).toBeInTheDocument();
    expect(screen.getByText('Lee Reception')).toBeInTheDocument();
  });

  it('switches to table view when the toggle is clicked', async () => {
    server.use(http.get('/api/orgs/:orgId/events', () =>
      HttpResponse.json({
        events: sampleEvents,
        counts: { lead: 1, hold: 0, booked: 1, planning: 1, completed: 0, cancelled: 0, lost: 0 },
      })
    ));
    render(harness(<EventsList orgId={ORG} />));
    await screen.findByText('Smith Wedding');
    await userEvent.click(screen.getByRole('tab', { name: /List/ }));
    // Table headers
    expect(screen.getByText('Budget')).toBeInTheDocument();
  });

  it('shows empty state when no events match', async () => {
    server.use(http.get('/api/orgs/:orgId/events', () =>
      HttpResponse.json({
        events: [],
        counts: { lead: 0, hold: 0, booked: 0, planning: 0, completed: 0, cancelled: 0, lost: 0 },
      })
    ));
    render(harness(<EventsList orgId={ORG} />));
    expect(await screen.findByText(/No events yet/i)).toBeInTheDocument();
  });

  it('passes search query to the server (debounced)', async () => {
    let lastUrl = '';
    server.use(http.get('/api/orgs/:orgId/events', ({ request }) => {
      lastUrl = request.url;
      return HttpResponse.json({
        events: [],
        counts: { lead: 0, hold: 0, booked: 0, planning: 0, completed: 0, cancelled: 0, lost: 0 },
      });
    }));
    render(harness(<EventsList orgId={ORG} />));
    const search = await screen.findByPlaceholderText(/Search events/i);
    await userEvent.type(search, 'smith');
    // Wait for debounce
    await waitFor(() => expect(lastUrl).toContain('search=smith'), { timeout: 1000 });
  });

  it('opens the create dialog when "New event" is clicked', async () => {
    server.use(http.get('/api/orgs/:orgId/events', () =>
      HttpResponse.json({
        events: [],
        counts: { lead: 0, hold: 0, booked: 0, planning: 0, completed: 0, cancelled: 0, lost: 0 },
      })
    ));
    render(harness(<EventsList orgId={ORG} />));
    await userEvent.click(await screen.findByRole('button', { name: /New event/ }));
    expect(await screen.findByRole('heading', { name: /Create event/i })).toBeInTheDocument();
  });
});
