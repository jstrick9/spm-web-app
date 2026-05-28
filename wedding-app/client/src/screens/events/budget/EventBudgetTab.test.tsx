import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EventBudgetTab } from './EventBudgetTab';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } }
});

vi.mock('../../../sdk', () => ({
  sdk: {
    vendors: {
      list: vi.fn().mockResolvedValue({ vendors: [] })
    }
  }
}));

describe('EventBudgetTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const TestWrapper = ({ children }: any) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  it('renders budget layout with aggregated math', () => {
    render(<EventBudgetTab eventId="evt-1" organizationId="org-1" />, { wrapper: TestWrapper });
    
    expect(screen.getByText('Budget Tracker')).toBeInTheDocument();
    
    // Check line items render
    expect(screen.getByText('Base Rental')).toBeInTheDocument();
    expect(screen.getByText('Dinner Service')).toBeInTheDocument();
    expect(screen.getByText('Arch & Centerpieces')).toBeInTheDocument();
    
    // Total Math: 
    // Planned: 10k + 8.5k + 3k + 4.5k = 26k
    // Actual: 10k + 9k + 4.5k = 23.5k
    expect(screen.getByText('$26,000.00')).toBeInTheDocument();
    expect(screen.getByText('$23,500.00')).toBeInTheDocument();
    
    // Variance math (Actual - Planned): 23.5k - 26k = -2.5k 
    expect(screen.getByText('-$2,500 vs planned')).toBeInTheDocument();
  });
});
