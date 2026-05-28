import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CatalogScreen } from './CatalogScreen';
import { catalogSdk } from '../../sdk/catalog';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '../../ui/Toast';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } }
});

vi.mock('../../sdk', () => ({
  sdk: {
    catalog: {
      list: vi.fn().mockResolvedValue({ 
        items: [
          { id: 'item-1', name: 'Standard Round', spec: JSON.stringify({ type: 'table', shape: 'round', radius: 30 }) }
        ] 
      }),
      replaceAll: vi.fn().mockResolvedValue({ items: [] })
    }
  }
}));

describe('CatalogScreen', () => {
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

  it('renders catalog items and allows adding new', async () => {
    render(<CatalogScreen orgId="org-1" />, { wrapper: TestWrapper });
    
    expect(await screen.findByDisplayValue('Standard Round')).toBeInTheDocument();
    
    const addBtn = screen.getByRole('button', { name: /Add Item/i });
    fireEvent.click(addBtn);
    
    expect(screen.getByDisplayValue('New table')).toBeInTheDocument();
  });
});
