import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AnalyticsDashboard } from './AnalyticsDashboard';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConfigProvider } from '../../config/ConfigProvider';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } }
});

vi.mock('../../sdk', () => ({
  sdk: {
    events: {
      list: vi.fn().mockResolvedValue({ 
        events: [
          { id: 'e1', title: 'Smith', status: 'booked', budget_cents: 1000000, start_date: new Date().toISOString(), guest_count: 150 }
        ] 
      }),
    },
    vendors: {
      list: vi.fn().mockResolvedValue({ vendors: [{ id: 'v1', name: 'DJ Snake', category: 'entertainment' }] })
    }
  }
}));

describe('AnalyticsDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const TestWrapper = ({ children }: any) => (
    <QueryClientProvider client={queryClient}>
      <ConfigProvider>
        {children}
      </ConfigProvider>
    </QueryClientProvider>
  );

  it('renders aggregated dashboard analytics successfully', async () => {
    render(<AnalyticsDashboard orgId="org-1" />, { wrapper: TestWrapper });
    
    expect(await screen.findByText('Advanced Analytics')).toBeInTheDocument();
    
    // Revenue maps directly to the budget
    expect(screen.getByText('$10,000')).toBeInTheDocument();
    
    // Average Guests Maps
    expect(screen.getByText('150')).toBeInTheDocument();
    
    // Total Vendors Tracked
    expect(screen.getByText('1')).toBeInTheDocument();
  });


  it('renders Revenue by Month chart section', async () => {
    render(<AnalyticsDashboard orgId="org-1" />, { wrapper: TestWrapper });
    expect(await screen.findByText('Revenue by Month')).toBeInTheDocument();
  });
});