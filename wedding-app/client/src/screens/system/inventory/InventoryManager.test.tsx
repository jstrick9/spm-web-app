import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { InventoryManager } from './InventoryManager';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } }
});

describe('InventoryManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const TestWrapper = ({ children }: any) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  it('renders inventory alerts and tracks stock states', async () => {
    render(<InventoryManager orgId="org-1" />, { wrapper: TestWrapper });
    
    // Check titles
    expect(screen.getByText('Inventory Manager')).toBeInTheDocument();
    
    // Check items
    expect(screen.getByText('Gold Chiavari Chair')).toBeInTheDocument();
    expect(screen.getByText('Wireless Uplight (RGB)')).toBeInTheDocument();
    
    // Check alert states
    expect(screen.getByText('Low Stock Alert')).toBeInTheDocument();
    expect(screen.getByText('Maintenance Required')).toBeInTheDocument();
  });
});
