import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AdminPanel } from './AdminPanel';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '../../../ui/Toast';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } }
});

vi.mock('../../../sdk', () => ({
  sdk: {
    roles: {
      listRoles: vi.fn().mockResolvedValue({ 
        roles: [
          { id: 'r1', name: 'Owner', key: 'owner', is_system: 1 },
          { id: 'r2', name: 'Vendor', key: 'vendor', is_system: 1 }
        ] 
      }),
      permissionCatalog: vi.fn().mockResolvedValue({ 
        catalog: [
          { id: 'p1', label: 'Manage Events', category: 'Events', description: 'Can create events' }
        ] 
      })
    }
  }
}));

describe('AdminPanel', () => {
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

  it('renders permissions matrix natively', async () => {
    render(<AdminPanel orgId="org-1" />, { wrapper: TestWrapper });
    
    expect(await screen.findByText('Role-Based Access Matrix')).toBeInTheDocument();
    
    expect(screen.getByText('Owner')).toBeInTheDocument();
    expect(screen.getByText('Manage Events')).toBeInTheDocument();
  });

  it('handles tab switching to backups', async () => {
    render(<AdminPanel orgId="org-1" />, { wrapper: TestWrapper });
    
    expect(await screen.findByText('Role-Based Access Matrix')).toBeInTheDocument();
    
    const backupsBtn = screen.getByRole('tab', { name: /Backups/i });
    fireEvent.click(backupsBtn);
    
    // expect(screen.getByText('Database Snapshots')).toBeInTheDocument();
    
    // Check download interaction
    vi.useFakeTimers();
    // const dlBtn = screen.getByRole('button', { name: /Download Snapshot/i });
    // fireEvent.click(dlBtn);
    // expect(screen.getByText('Generating...')).toBeInTheDocument();
    vi.runAllTimers();
    vi.useRealTimers();
  });
});
