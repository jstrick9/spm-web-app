import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { IntegrationHub } from './IntegrationHub';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '../../ui/Toast';

// Mock SDK for webhooks
vi.mock('../../sdk', () => ({
  sdk: {
    webhooks: {
      list: vi.fn().mockResolvedValue({
        webhooks: [
          { id: 'wh1', url: 'https://hooks.zapier.com/test', is_active: 1, last_status: 200, failure_count: 0, organization_id: 'org-1', secret: '', event_types: '["*"]', description: null, last_triggered: null, created_at: '2026-01-01' },
        ],
      }),
      create: vi.fn().mockResolvedValue({ webhook: { id: 'wh2' } }),
      delete: vi.fn().mockResolvedValue(undefined),
      test: vi.fn().mockResolvedValue({ ok: true }),
      update: vi.fn().mockResolvedValue({ webhook: {} }),
    },
  },
}));

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>
      <ToastProvider>{children}</ToastProvider>
    </QueryClientProvider>
  );
}

describe('IntegrationHub', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('renders integration catalog and webhook section', async () => {
    render(<IntegrationHub orgId="org-1" />, { wrapper: makeWrapper() });
    
    expect(screen.getByText('Integration Hub')).toBeInTheDocument();
    expect(screen.getByText('QuickBooks Online')).toBeInTheDocument();
    expect(screen.getByText('Calendly')).toBeInTheDocument();
    
    // Webhook section
    await waitFor(() => {
      expect(screen.getByText('Outbound Webhooks')).toBeInTheDocument();
    });
  });

  it('shows real webhooks from backend', async () => {
    render(<IntegrationHub orgId="org-1" />, { wrapper: makeWrapper() });
    
    await waitFor(() => {
      expect(screen.getByText('https://hooks.zapier.com/test')).toBeInTheDocument();
    });
  });

  it('shows Connect buttons for catalog integrations', () => {
    render(<IntegrationHub orgId="org-1" />, { wrapper: makeWrapper() });
    
    const connectBtns = screen.getAllByRole('button', { name: /^Connect$/i });
    expect(connectBtns.length).toBeGreaterThanOrEqual(4);
  });

  it('renders Add Webhook button', async () => {
    render(<IntegrationHub orgId="org-1" />, { wrapper: makeWrapper() });
    
    await waitFor(() => {
      expect(screen.getByText('Add Webhook')).toBeInTheDocument();
    });
  });
});
