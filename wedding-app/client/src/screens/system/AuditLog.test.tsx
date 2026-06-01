import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
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
  beforeEach(() => { vi.clearAllMocks(); });

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

  it('shows action filter chips', async () => {
    render(<AuditLog orgId="org1" />, { wrapper: wrap() });
    await waitFor(() => {
      expect(screen.getByText(/All \(/)).toBeTruthy();
    });
  });
});
