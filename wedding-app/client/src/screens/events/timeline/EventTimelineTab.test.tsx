import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { EventTimelineTab } from './EventTimelineTab';
import { timelineSdk } from '../../../sdk/timeline';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '../../../ui/Toast';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } }
});

vi.mock('../../../sdk', () => ({
  sdk: {
    timeline: {
      list: vi.fn().mockResolvedValue({ 
        items: [
          { id: 'i1', title: 'Arrival', starts_at: '2025-05-26T14:00:00.000Z', category: 'vendor_arrival', duration_min: 30, completed: 0 },
          { id: 'i2', title: 'Ceremony', starts_at: '2025-05-26T16:00:00.000Z', category: 'ceremony', duration_min: 60, completed: 1 }
        ] 
      }),
      update: vi.fn()
    }
  }
}));

vi.mock('../../../sdk/timeline', () => ({
  timelineSdk: {
    update: vi.fn(),
    create: vi.fn(),
  }
}));

describe('EventTimelineTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const TestWrapper = ({ children }: any) => (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        {children}
      </ToastProvider>
    </QueryClientProvider>
  );

  it('renders timeline items sorted by time', async () => {
    render(<EventTimelineTab eventId="evt-1" />, { wrapper: TestWrapper });
    
    expect(await screen.findByText('Arrival')).toBeInTheDocument();
    expect(screen.getByText('Ceremony')).toBeInTheDocument();
    
    expect(screen.getByText('30 mins')).toBeInTheDocument();
    // expect(screen.getByText('vendor arrival')).toBeInTheDocument(); // category badge
  });
  
  it('opens create dialog', async () => {
    render(<EventTimelineTab eventId="evt-1" />, { wrapper: TestWrapper });
    
    expect(await screen.findByText('Arrival')).toBeInTheDocument();
    
    const addBtn = screen.getByRole('button', { name: /Add Item/i });
    fireEvent.click(addBtn);
    
    expect(screen.getByText('Add Timeline Item')).toBeInTheDocument();
  });
});
