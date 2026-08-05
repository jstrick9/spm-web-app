import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuditLog } from './AuditLog';

vi.mock('../../sdk', () => ({
  sdk: {
    audit: {
      list: vi.fn().mockResolvedValue({
        logs: [
          { id: 'a1', action: 'event.create', actor_label: 'owner@venue.com', target_type: 'event', target_id: 'e1', ip: '127.0.0.1', details: '{}', created_at: '2026-09-01T10:00:00Z' },
          { id: 'a2', action: 'guest.create', actor_label: 'owner@venue.com', target_type: 'guest', target_id: 'g1', ip: '127.0.0.1', details: '{}', created_at: '2026-09-01T10:05:00Z' },
          { id: 'a3', action: 'rsvp.submit', actor_label: null, target_type: 'rsvp', target_id: 'r1', ip: '192.168.1.1', details: '{}', created_at: '2026-09-01T11:00:00Z' },
        ],
        total: 3, limit: 200, nextBefore: undefined,
      }),
    },
  },
}));

vi.mock('../../lib/useDebouncedValue', () => ({
  useDebouncedValue: (v: string) => v,
}));

function wrap() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

describe('AuditLog', () => {
  beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); });

  it('renders manager security and audit controls in manager mode', async () => {
    localStorage.setItem('wvi_registration_role', 'venue_manager');
    render(<AuditLog orgId="org1" />, { wrapper: wrap() });
    expect(await screen.findByText('Manager permission policy template')).toBeTruthy();
    expect(screen.getByText('Shared tablet/kiosk session security')).toBeTruthy();
    expect(screen.getByText('Manager audit filters & PII access report')).toBeTruthy();
    expect(screen.getByText('PII access')).toBeTruthy();
    expect(screen.getByText('Per-event manager access scope')).toBeTruthy();
    expect(screen.getByText('Delegated approval workflow')).toBeTruthy();
  });

  it('renders the page header', async () => {
    render(<AuditLog orgId="org1" />, { wrapper: wrap() });
    expect(screen.getByText('Audit Log')).toBeTruthy();
  });

  it('shows audit entries from server', async () => {
    render(<AuditLog orgId="org1" />, { wrapper: wrap() });
    await waitFor(() => {
      expect(screen.getByText('Event Created')).toBeTruthy();
      expect(screen.getByText('Guest Added')).toBeTruthy();
      expect(screen.getByText('RSVP Submitted')).toBeTruthy();
    });
  });

  it('shows actor labels', async () => {
    render(<AuditLog orgId="org1" />, { wrapper: wrap() });
    await waitFor(() => {
      expect(screen.getAllByText('owner@venue.com').length).toBeGreaterThanOrEqual(1);
    });
  });

  it('shows target type badges', async () => {
    render(<AuditLog orgId="org1" />, { wrapper: wrap() });
    await waitFor(() => {
      expect(screen.getByText('event')).toBeTruthy();
      expect(screen.getByText('guest')).toBeTruthy();
    });
  });

  it('has search input', async () => {
    render(<AuditLog orgId="org1" />, { wrapper: wrap() });
    expect(screen.getByPlaceholderText(/Search actions/i)).toBeTruthy();
  });

  it('pages older records via the server nextBefore token (UX-08)', async () => {
    const { sdk } = await import('../../sdk');
    (sdk.audit.list as any).mockResolvedValue({
      logs: [{ id: 'a1', action: 'event.create', actor_label: 'owner@venue.com', target_type: 'event', target_id: 'e1', ip: '1.1.1.1', details: '{}', created_at: '2026-09-01T10:00:00Z' }],
      total: 250, limit: 200, nextBefore: '2026-09-01T10:00:00Z',
    });
    render(<AuditLog orgId="org-1" />, { wrapper: wrap() });
    await waitFor(() => expect(screen.getByText(/250 record/i)).toBeTruthy());
    const older = screen.getByRole('button', { name: /older/i });
    expect(older).toBeTruthy();
    // Clicking Older refetches with before=nextBefore
    (sdk.audit.list as any).mockResolvedValue({
      logs: [{ id: 'a0', action: 'user.login', actor_label: 'owner@venue.com', target_type: null, target_id: null, ip: '1.1.1.1', details: '{}', created_at: '2026-08-01T10:00:00Z' }],
      total: 250, limit: 200, nextBefore: undefined,
    });
    older.click();
    await waitFor(() => {
      const calls = (sdk.audit.list as any).mock.calls;
      expect(calls.some((c: any[]) => c[1]?.before === '2026-09-01T10:00:00Z')).toBe(true);
    });
  });

  it('sends an explicit actor email filter to the server and resets paging (UX-6)', async () => {
    const { sdk } = await import('../../sdk');
    (sdk.audit.list as any).mockResolvedValue({
      logs: [{ id: 'a1', action: 'event.create', actor_label: 'owner@venue.com', target_type: 'event', target_id: 'e1', ip: '1.1.1.1', details: '{}', created_at: '2026-09-01T10:00:00Z' }],
      total: 1, limit: 200, nextBefore: undefined,
    });
    render(<AuditLog orgId="org-1" />, { wrapper: wrap() });
    await waitFor(() => expect(screen.getByLabelText(/filter by actor email/i)).toBeTruthy());
    const input = screen.getByLabelText(/filter by actor email/i);
    fireEvent.change(input, { target: { value: 'owner@venue.com' } });
    await waitFor(() => {
      const calls = (sdk.audit.list as any).mock.calls;
      expect(calls.some((c: any[]) => c[1]?.actorEmail === 'owner@venue.com')).toBe(true);
    });
    // Paging resets when the actor filter changes
    const calls = (sdk.audit.list as any).mock.calls;
    expect(calls[calls.length - 1][1]?.before).toBeUndefined();
  });

  it('applies action filter chips server-side across the whole history (UX-6)', async () => {
    const { sdk } = await import('../../sdk');
    (sdk.audit.list as any).mockResolvedValue({
      logs: [{ id: 'a1', action: 'event.create', actor_label: 'owner@venue.com', target_type: 'event', target_id: 'e1', ip: '1.1.1.1', details: '{}', created_at: '2026-09-01T10:00:00Z' }],
      total: 7, limit: 200, nextBefore: undefined,
    });
    render(<AuditLog orgId="org-1" />, { wrapper: wrap() });
    const chip = await screen.findByRole('button', { name: /Event Created/ });
    chip.click();
    await waitFor(() => {
      const calls = (sdk.audit.list as any).mock.calls;
      expect(calls.some((c: any[]) => c[1]?.action === 'event.create')).toBe(true);
    });
    // Server-filtered badge appears
    await waitFor(() => expect(screen.getByText(/server-filtered/i)).toBeTruthy());
    // Chip toggles off again → no action param
    screen.getByRole('button', { name: /Event Created/ }).click();
    await waitFor(() => {
      const calls = (sdk.audit.list as any).mock.calls;
      expect(calls[calls.length - 1][1]?.action).toBeUndefined();
    });
  });

  it('sends an after timestamp for time-range filters and resets paging (UX-6)', async () => {
    const { sdk } = await import('../../sdk');
    (sdk.audit.list as any).mockResolvedValue({
      logs: [{ id: 'a1', action: 'event.create', actor_label: 'owner@venue.com', target_type: 'event', target_id: 'e1', ip: '1.1.1.1', details: '{}', created_at: '2026-09-01T10:00:00Z' }],
      total: 1, limit: 200, nextBefore: undefined,
    });
    render(<AuditLog orgId="org-1" />, { wrapper: wrap() });
    await waitFor(() => expect(screen.getByLabelText(/time range/i)).toBeTruthy());
    fireEvent.change(screen.getByLabelText(/time range/i), { target: { value: '24h' } });
    await waitFor(() => {
      const calls = (sdk.audit.list as any).mock.calls;
      const after = calls[calls.length - 1][1]?.after;
      expect(typeof after).toBe('string');
      expect(new Date(after).getTime()).toBeGreaterThan(Date.now() - 25 * 3_600_000);
      expect(calls[calls.length - 1][1]?.before).toBeUndefined();
    });
  });

  it('shows curated action filter chips', async () => {
    render(<AuditLog orgId="org1" />, { wrapper: wrap() });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'All' })).toBeTruthy();
      expect(screen.getByRole('button', { name: /Event Created/ })).toBeTruthy();
      expect(screen.getByRole('button', { name: /Guest Added/ })).toBeTruthy();
    });
  });

  it('clear-all resets every server filter', async () => {
    const { sdk } = await import('../../sdk');
    (sdk.audit.list as any).mockResolvedValue({
      logs: [{ id: 'a1', action: 'event.create', actor_label: 'owner@venue.com', target_type: 'event', target_id: 'e1', ip: '1.1.1.1', details: '{}', created_at: '2026-09-01T10:00:00Z' }],
      total: 1, limit: 200, nextBefore: undefined,
    });
    render(<AuditLog orgId="org-1" />, { wrapper: wrap() });
    await waitFor(() => expect(screen.getByLabelText(/filter by actor email/i)).toBeTruthy());
    fireEvent.change(screen.getByLabelText(/filter by actor email/i), { target: { value: 'owner@venue.com' } });
    await waitFor(() => expect(screen.getByText(/clear all filters/i)).toBeTruthy());
    screen.getByText(/clear all filters/i).click();
    await waitFor(() => {
      const calls = (sdk.audit.list as any).mock.calls;
      const last = calls[calls.length - 1][1];
      expect(last?.actorEmail).toBeUndefined();
    });
    await waitFor(() => expect(screen.queryByText(/server-filtered/i)).toBeNull());
  });
});
