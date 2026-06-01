import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { InventoryManager } from './InventoryManager';

vi.mock('../../../sdk', () => ({
  sdk: {
    inventory: {
      list: vi.fn().mockResolvedValue({
        items: [
          { id: 'i1', sku: 'CHR-001', name: 'Gold Chair', category: 'chair', total_count: 200, available_count: 185, condition: 'good', owner_type: 'venue', notes: null, created_at: '2026-01-01' },
          { id: 'i2', sku: 'AV-UP-01', name: 'Wireless Uplight', category: 'av', total_count: 24, available_count: 4, condition: 'maintenance', owner_type: 'vendor_rental', notes: null, created_at: '2026-01-01' },
        ],
        stats: { total: 2, lowStock: 1, maintenance: 1 },
      }),
      create: vi.fn().mockResolvedValue({ item: { id: 'i3' } }),
      delete: vi.fn().mockResolvedValue(undefined),
    },
  },
}));
vi.mock('../../../ui/Toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));

function wrap() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe('InventoryManager', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('renders KPI tiles', async () => {
    render(<InventoryManager orgId="org1" />, { wrapper: wrap() });
    await waitFor(() => {
      expect(screen.getByText('Total Items')).toBeTruthy();
      expect(screen.getByText('Low Stock')).toBeTruthy();
      expect(screen.getByText('Maintenance')).toBeTruthy();
    });
  });

  it('renders inventory items from server', async () => {
    render(<InventoryManager orgId="org1" />, { wrapper: wrap() });
    await waitFor(() => {
      expect(screen.getByText('Gold Chair')).toBeTruthy();
      expect(screen.getByText('Wireless Uplight')).toBeTruthy();
    });
  });

  it('shows low stock alert', async () => {
    render(<InventoryManager orgId="org1" />, { wrapper: wrap() });
    await waitFor(() => {
      expect(screen.getByText(/below minimum stock level/)).toBeTruthy();
    });
  });

  it('shows search input', async () => {
    render(<InventoryManager orgId="org1" />, { wrapper: wrap() });
    await waitFor(() => expect(screen.getByPlaceholderText(/Search by name or SKU/)).toBeTruthy());
  });
});
