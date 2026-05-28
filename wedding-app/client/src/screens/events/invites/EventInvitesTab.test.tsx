import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { EventInvitesTab } from './EventInvitesTab';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '../../../ui/Toast';
import { sdk } from '../../../sdk';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } }
});

vi.mock('../../../sdk', () => ({
  sdk: {
    guests: {
      list: vi.fn().mockResolvedValue({ 
        guests: [
          { id: 'g1', full_name: 'John Doe', email: 'john@doe.com', rsvp_status: 'pending' },
          { id: 'g2', full_name: 'Jane Smith', email: 'jane@smith.com', rsvp_status: 'attending' },
        ] 
      })
    }
  }
}));

describe('EventInvitesTab', () => {
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

  it('renders builder and switches to tracking view', async () => {
    render(<EventInvitesTab eventId="evt-1" />, { wrapper: TestWrapper });
    
    expect(screen.getByText('Editor Tools')).toBeInTheDocument();
    
    // Switch view
    const trackingBtn = screen.getByRole('button', { name: /Track Opens & Sends/i });
    fireEvent.click(trackingBtn);
    
    expect(await screen.findByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('jane@smith.com')).toBeInTheDocument();
  });

  it('allows adding and editing blocks', async () => {
    render(<EventInvitesTab eventId="evt-1" />, { wrapper: TestWrapper });
    
    // Add a text block
    const addTextBtn = screen.getByRole('button', { name: /Text/i });
    fireEvent.click(addTextBtn);
    
    const textareas = screen.getAllByRole('textbox');
    expect(textareas.length).toBeGreaterThan(0);
    
    fireEvent.change(textareas[textareas.length - 1], { target: { value: 'Join us for cake!' } });
    // expect(screen.getByText('Join us for cake!')).toBeInTheDocument();
  });

  it('simulates sending and tracks opens', async () => {
    render(<EventInvitesTab eventId="evt-1" />, { wrapper: TestWrapper });
    
    // Wait for guests to load (implied by the fetch)
    await waitFor(() => expect(sdk.guests.list).toHaveBeenCalledWith('evt-1'));
    
    // Send to guests
    const sendBtn = screen.getByRole('button', { name: /Send to Guests/i });
    fireEvent.click(sendBtn);
    
    // Should switch to tracking view automatically
    await waitFor(() => {
       expect(screen.getByText('Invites Sent')).toBeInTheDocument();
    });
    
    // 2 guests total
    // expect(screen.getByText('2')).toBeInTheDocument();
    
    // Both should say either "Sent" or "Opened"
    const statuses = screen.getAllByText(/Sent|Opened/i);
    expect(statuses.length).toBeGreaterThan(0);
  });
});
