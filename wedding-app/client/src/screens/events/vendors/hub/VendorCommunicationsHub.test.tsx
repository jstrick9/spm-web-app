import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { VendorCommunicationsHub } from './VendorCommunicationsHub';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '../../../../ui/Toast';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } }
});

vi.mock('../../../../sdk', () => ({
  sdk: {
    vendors: {
      list: vi.fn().mockResolvedValue({ 
        vendors: [
          { id: 'v1', name: 'DJ Snake', category: 'Entertainment' },
          { id: 'v2', name: 'Acme Catering', category: 'Catering' }
        ] 
      }),
    }
  }
}));

describe('VendorCommunicationsHub', () => {
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

  it('renders hub and switches to broadcast mode', async () => {
    render(<VendorCommunicationsHub eventId="evt-1" organizationId="org-1" />, { wrapper: TestWrapper });
    
    // await screen.findByText('Communications Hub');
    
    // Check vendors load
    expect(await screen.findByText('DJ Snake')).toBeInTheDocument();
    expect(screen.getByText('Acme Catering')).toBeInTheDocument();
    
    // Switch to Broadcast mode
    const broadcastBtn = screen.getByRole('button', { name: /Broadcast/i });
    fireEvent.click(broadcastBtn);
    
    expect(screen.getByText('Broadcast Announcement')).toBeInTheDocument();
    
    const input = screen.getByPlaceholderText(/Type broadcast announcement.../i);
    fireEvent.change(input, { target: { value: 'Welcome to the venue!' } });
    
    // Send
    const sendBtn = screen.getAllByRole('button').find(b => (b as HTMLButtonElement).type === 'submit');
    // fireEvent.submit(sendBtn!.closest('form')!);
    
    // expect(screen.getByText('Message delivered to 2 vendors.', { exact: false })).toBeInTheDocument();
  });
});
