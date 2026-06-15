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
      list: vi.fn().mockResolvedValue({ vendors: [{ id: 'v1', name: 'DJ Snake', category: 'entertainment', metadata: JSON.stringify({ arrivalTime: '3:00 PM', coiReceived: true }), contract_amount_cents: 100000, amount_paid_cents: 100000 }] })
    },
    staff: {
      listTasks: vi.fn().mockResolvedValue({ tasks: [
        { id: 't1', title: 'Setup ceremony', status: 'completed', priority: 'high' },
        { id: 't2', title: 'Resolve incident', status: 'blocked', priority: 'critical' }
      ] })
    },
    risk: {
      forOrg: vi.fn().mockResolvedValue({ events: [{ eventId: 'e1', eventTitle: 'Smith', healthScore: 72, daysUntil: 5, alerts: [] }] })
    }
  }
}));

describe('AnalyticsDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    queryClient.clear();
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


  it('renders manager operations analytics dashboard in manager mode', async () => {
    localStorage.setItem('wvi_registration_role', 'venue_manager');
    render(<AnalyticsDashboard orgId="org-1" />, { wrapper: TestWrapper });

    expect(await screen.findByText('Manager Operations Analytics')).toBeInTheDocument();
    expect(screen.getByText('Manager operations analytics dashboard')).toBeInTheDocument();
    expect(screen.getByText('Post-event debrief generator')).toBeInTheDocument();
    expect(screen.getByText('Timeline drift report')).toBeInTheDocument();
    expect(screen.getByText('Staff productivity report')).toBeInTheDocument();
    expect(screen.getByText('Vendor scorecard report')).toBeInTheDocument();
    expect(screen.getByText('Guest service operations report')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Export weekly manager briefing/i })).toBeInTheDocument();
  });


  it('renders Revenue by Month chart section', async () => {
    render(<AnalyticsDashboard orgId="org-1" />, { wrapper: TestWrapper });
    expect(await screen.findByText('Revenue by Month')).toBeInTheDocument();
  });
});