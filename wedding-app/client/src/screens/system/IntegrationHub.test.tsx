import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { IntegrationHub } from './IntegrationHub';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '../../ui/Toast';

let canViewIntegrations = true;
let canManageSettings = true;
vi.mock('../../lib/usePermission', () => ({
  usePermission: (permissionId: string) => {
    if (permissionId === 'integrations.view') return canViewIntegrations;
    if (permissionId === 'org.settings.manage') return canManageSettings;
    return true;
  },
}));

// Mock SDK for webhooks
vi.mock('../../sdk', () => ({
  sdk: {
    integrations: {
      providers: vi.fn().mockResolvedValue({
        providers: [
          { id: 'email_smtp', name: 'Email (SMTP)', category: 'email', description: 'Send transactional email.', iconKey: 'mail', kind: 'smtp', capabilities: ['send_email'] },
          { id: 'stripe', name: 'Stripe', category: 'payments', description: 'Collect card payments.', iconKey: 'credit-card', kind: 'api_key', capabilities: ['collect_payment'] },
          { id: 'sms_twilio', name: 'SMS (Twilio)', category: 'sms', description: 'Send SMS reminders.', iconKey: 'message', kind: 'api_key', capabilities: ['send_sms'] },
        ],
      }),
      list: vi.fn().mockResolvedValue({
        integrations: [
          { id: 'int1', provider: 'email_smtp', status: 'connected', display_name: 'Email', hasSecrets: true, last_error: null, last_synced_at: '2026-01-01', organization_id: 'org-1', config: '{}', created_by: 'u1', created_at: '2026-01-01', updated_at: '2026-01-01' },
        ],
      }),
      test: vi.fn().mockResolvedValue({ ok: true, integration: { id: 'int1', provider: 'email_smtp', status: 'connected' } }),
      upsert: vi.fn().mockResolvedValue({ integration: { id: 'int2', provider: 'email_smtp', status: 'connected', last_error: null } }),
      events: vi.fn().mockResolvedValue({ events: [] }),
    },
    webhooks: {
      list: vi.fn().mockResolvedValue({
        webhooks: [
          { id: 'wh1', url: 'https://hooks.zapier.com/test', is_active: 1, last_status: 200, failure_count: 0, organization_id: 'org-1', secret: '', event_types: '["*"]', description: null, last_triggered: null, created_at: '2026-01-01' },
        ],
      }),
      create: vi.fn().mockResolvedValue({ webhook: { id: 'wh2' } }),
      delete: vi.fn().mockResolvedValue(undefined),
      test: vi.fn().mockResolvedValue({ ok: true, message: 'Test webhook dispatched. Check deliveries for results.' }),
      deliveries: vi.fn().mockResolvedValue({ deliveries: [] }),
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
  beforeEach(() => {
    canViewIntegrations = true;
    canManageSettings = true; vi.clearAllMocks(); localStorage.clear(); });

  it('renders integration catalog and webhook section', async () => {
    render(<IntegrationHub orgId="org-1" />, { wrapper: makeWrapper() });
    
    expect(screen.getByText('Integration Hub')).toBeInTheDocument();
    expect(await screen.findByText('Email (SMTP)')).toBeInTheDocument();
    expect(await screen.findByText('Google Calendar')).toBeInTheDocument();
    expect(await screen.findByText('SMS (Twilio)')).toBeInTheDocument();
    
    // Webhook section
    await waitFor(() => {
      expect(screen.getByText('Webhooks & troubleshooting')).toBeInTheDocument();
    });
  });

  it('shows real webhooks from backend', async () => {
    render(<IntegrationHub orgId="org-1" />, { wrapper: makeWrapper() });
    
    await waitFor(() => {
      expect(screen.getByText('https://hooks.zapier.com/test')).toBeInTheDocument();
    });
  });

  it('shows Start setup buttons for not-connected catalog integrations', () => {
    render(<IntegrationHub orgId="org-1" />, { wrapper: makeWrapper() });
    
    const setupBtns = screen.getAllByRole('button', { name: /Start setup/i });
    expect(setupBtns.length).toBeGreaterThanOrEqual(4);
  });

  it('renders manager-friendly integration impact and delivery status panels', async () => {
    canViewIntegrations = true;
    canManageSettings = false;
    render(<IntegrationHub orgId="org-1" />, { wrapper: makeWrapper() });

    expect(await screen.findByText('Manager integration status panel')).toBeInTheDocument();
    expect(screen.getByText('Integration impact map')).toBeInTheDocument();
    expect(screen.getByText('Calendar sync monitor')).toBeInTheDocument();
    expect(screen.getByText('Weather/rain-plan alert engine')).toBeInTheDocument();
    expect(screen.getByText('DocuSign readiness')).toBeInTheDocument();
    expect(screen.getByText('CRM lead handoff monitor')).toBeInTheDocument();
    expect(screen.getByText('SMS delivery troubleshooting')).toBeInTheDocument();
    expect(screen.getByText(/Managers can review impact and delivery status/i)).toBeInTheDocument();
  });

  it('renders Add Webhook button', async () => {
    render(<IntegrationHub orgId="org-1" />, { wrapper: makeWrapper() });
    
    await waitFor(() => {
      expect(screen.getByText('Add Webhook')).toBeInTheDocument();
    });
  });
});
