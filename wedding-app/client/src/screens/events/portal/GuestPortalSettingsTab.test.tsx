import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { GuestPortalSettingsTab } from './GuestPortalSettingsTab';
import { sdk } from '../../../sdk';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '../../../ui/Toast';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } }
});

vi.mock('../../../sdk', () => ({
  sdk: {
    guests: {
      getPortalConfig: vi.fn().mockResolvedValue({ 
        config: { id: 'c1', enabled: 1, password_hash: null } 
      }),
      updatePortalConfig: vi.fn().mockResolvedValue({ config: { enabled: 1 } })
    }
  }
}));

describe('GuestPortalSettingsTab', () => {
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

  it('renders portal link and loads data', async () => {
    render(<GuestPortalSettingsTab eventId="evt-1" />, { wrapper: TestWrapper });
    
    expect(await screen.findByText('Public Guest Portal')).toBeInTheDocument();
    
    // Test URL display
    expect(screen.getByText(/#\/portal\/evt-1/i)).toBeInTheDocument();
  });

  it('triggers save bar on toggle', async () => {
    render(<GuestPortalSettingsTab eventId="evt-1" />, { wrapper: TestWrapper });
    
    expect(await screen.findByText('Public Guest Portal')).toBeInTheDocument();
    
    const pwdCheckbox = screen.getByLabelText(/Require a master password/i);
    fireEvent.click(pwdCheckbox);
    
    expect(screen.getByText('Unsaved changes')).toBeInTheDocument();
    
    // Enter password
    const pwdInput = screen.getByPlaceholderText('e.g. Smith2026');
    fireEvent.change(pwdInput, { target: { value: 'secret123' } });
    
    const saveBtn = screen.getByRole('button', { name: /Save Settings/i });
    fireEvent.click(saveBtn);
    
    await waitFor(() => {
      expect(sdk.guests.updatePortalConfig).toHaveBeenCalledWith('evt-1', {
        enabled: true,
        password: 'secret123'
      });
    });
  });
});
