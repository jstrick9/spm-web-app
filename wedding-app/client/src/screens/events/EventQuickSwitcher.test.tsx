import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { EventQuickSwitcher } from './EventQuickSwitcher';

vi.mock('../../lib/router', () => ({
  useRouter: () => ({ navigate: vi.fn() }),
}));

vi.mock('../../sdk', () => ({
  sdk: {
    events: {
      list: vi.fn().mockResolvedValue({
        events: [
          { id: 'e1', title: 'Smith Wedding', status: 'booked', start_date: '2026-09-12', slug: 'smith' },
          { id: 'e2', title: 'Davis Reception', status: 'planning', start_date: '2026-10-18', slug: 'davis' },
          { id: 'e3', title: 'Baker Party', status: 'lead', start_date: null, slug: 'baker' },
        ],
        counts: {},
      }),
    },
  },
}));

function wrap() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

describe('EventQuickSwitcher', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('renders the switch button', async () => {
    render(<EventQuickSwitcher currentEventId="e1" orgId="org1" />, { wrapper: wrap() });
    await waitFor(() => {
      expect(screen.getByText('Switch event')).toBeTruthy();
    });
  });

  it('shows other events (not current) in dropdown', async () => {
    render(<EventQuickSwitcher currentEventId="e1" orgId="org1" />, { wrapper: wrap() });
    await waitFor(() => screen.getByText('Switch event'));
    
    fireEvent.click(screen.getByText('Switch event'));
    
    await waitFor(() => {
      expect(screen.getByText('Davis Reception')).toBeTruthy();
      expect(screen.getByText('Baker Party')).toBeTruthy();
      // Current event should NOT be in the list
      expect(screen.queryByText('Smith Wedding')).toBeNull();
    });
  });

  it('shows event dates in the dropdown', async () => {
    render(<EventQuickSwitcher currentEventId="e1" orgId="org1" />, { wrapper: wrap() });
    await waitFor(() => screen.getByText('Switch event'));
    
    fireEvent.click(screen.getByText('Switch event'));
    
    await waitFor(() => {
      expect(screen.getByText('2026-10-18')).toBeTruthy();
      expect(screen.getByText('TBD')).toBeTruthy(); // Baker has no date
    });
  });
});
