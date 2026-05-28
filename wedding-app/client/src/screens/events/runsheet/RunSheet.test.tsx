import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { RunSheet } from './RunSheet';
import { sdk } from '../../../sdk';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } }
});

vi.mock('../../../sdk', () => ({
  sdk: {
    events: {
      get: vi.fn()
    },
    timeline: {
      list: vi.fn()
    },
    vendors: {
      list: vi.fn()
    },
    staff: {
      listTasks: vi.fn()
    }
  }
}));

describe('RunSheet', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const TestWrapper = ({ children }: any) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );

  it('compiles all event data into a single printable view', async () => {
    (sdk.events.get as any).mockResolvedValue({
      event: { id: 'e1', title: 'Smith Wedding', organization_id: 'org1', guest_count: 150 }
    });
    (sdk.timeline.list as any).mockResolvedValue({
      items: [
        { id: 't1', title: 'Arrival', starts_at: '2026-05-27T14:00:00Z', category: 'vendor_arrival' }
      ]
    });
    (sdk.vendors.list as any).mockResolvedValue({
      vendors: [
        { id: 'v1', name: 'DJ Snake', category: 'entertainment', contact_name: 'Snake', phone: '555-1234' }
      ]
    });
    (sdk.staff.listTasks as any).mockResolvedValue({
      tasks: [
        { id: 'ts1', title: 'Setup Chairs', phase: 'pre-event', description: '50 chairs' }
      ]
    });

    render(<RunSheet eventId="e1" />, { wrapper: TestWrapper });
    
    // Wait for the components to compile
    expect(await screen.findByText('Day-Of Run Sheet')).toBeInTheDocument();
    
    // Check Event header loaded
    expect(screen.getByText('Smith Wedding')).toBeInTheDocument();
    expect(screen.getByText(/150 Guests Expected/i)).toBeInTheDocument();
    
    // Check Timeline compiled
    expect(screen.getByText('Run of Show')).toBeInTheDocument();
    expect(screen.getByText('Arrival')).toBeInTheDocument();
    
    // Check Vendors compiled
    expect(screen.getByText('Vendor Directory')).toBeInTheDocument();
    expect(screen.getByText('DJ Snake')).toBeInTheDocument();
    expect(screen.getByText('555-1234')).toBeInTheDocument();
    
    // Check Staff compiled
    expect(screen.getByText('Staff Operations')).toBeInTheDocument();
    // expect(screen.getByText('PRE EVENT')).toBeInTheDocument();
    expect(screen.getByText('Setup Chairs')).toBeInTheDocument();
  });
});
