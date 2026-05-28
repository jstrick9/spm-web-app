import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GlobalCalendar } from './GlobalCalendar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { sdk } from '../../sdk';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } }
});

vi.mock('../../sdk', () => ({
  sdk: {
    events: {
      list: vi.fn()
    }
  }
}));

describe('GlobalCalendar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const TestWrapper = ({ children }: any) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  it('renders calendar grid and maps events to days', async () => {
    // Generate an event for today so we know where it lands
    const today = new Date().toISOString();
    
    (sdk.events.list as any).mockResolvedValue({
      events: [
        { id: 'e1', title: 'Smith Wedding', start_date: today, status: 'booked' }
      ]
    });

    render(<GlobalCalendar orgId="org-1" />, { wrapper: TestWrapper });

    expect(screen.getByText('Event Calendar')).toBeInTheDocument();
    expect(screen.getByText('Sun')).toBeInTheDocument();
    expect(screen.getByText('Sat')).toBeInTheDocument();
    
    // Wait for load
    expect(await screen.findByText('Smith Wedding')).toBeInTheDocument();
  });
});
