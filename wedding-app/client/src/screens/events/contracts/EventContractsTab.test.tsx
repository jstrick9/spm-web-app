import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { EventContractsTab } from './EventContractsTab';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '../../../ui/Toast';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } }
});

describe('EventContractsTab', () => {
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

  it('renders contracts', async () => {
    render(<EventContractsTab eventId="evt-1" />, { wrapper: TestWrapper });
    
    expect(screen.getByText('Master Venue Agreement')).toBeInTheDocument();
  });
});
