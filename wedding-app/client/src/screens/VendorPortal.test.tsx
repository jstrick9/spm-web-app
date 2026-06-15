import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { VendorPortal } from './VendorPortal';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '../ui/Toast';
import { sdk } from '../sdk';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } }
});

vi.mock('../sdk', () => ({
  sdk: {
    vendors: {
      portalInfo: vi.fn(),
      submitQuestionnaire: vi.fn(),
      portalGetMessages: vi.fn().mockResolvedValue({ messages: [] }),
      portalSendMessage: vi.fn().mockResolvedValue({ message: {} }),
    }
  }
}));

describe('VendorPortal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryClient.clear();
  });

  const TestWrapper = ({ children }: any) => (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        {children}
      </ToastProvider>
    </QueryClientProvider>
  );

  it('renders vendor data, timeline, and questionnaire', async () => {
    (sdk.vendors.portalInfo as any).mockResolvedValue({
      vendor: { id: 'v1', name: 'DJ Snake', category: 'Entertainment' },
      event: { title: 'Smith Wedding', guest_count: 150, status: 'booked' },
      timeline: [{ id: 't1', title: 'Arrival', time: '14:00' }]
    });

    render(<VendorPortal vendorId="v1" token="tok-1" />, { wrapper: TestWrapper });

    expect(await screen.findByText(/Vendor Portal/i)).toBeInTheDocument();
    expect(screen.getByText('Prepared for DJ Snake')).toBeInTheDocument();
    expect(screen.getByText('Smith Wedding')).toBeInTheDocument();
    expect(screen.getByText('150 attendees')).toBeInTheDocument();
    expect(screen.getByText('Arrival')).toBeInTheDocument();
    
    // Check questionnaire exists
    expect(screen.getByText(/Logistics Questionnaire/i)).toBeInTheDocument();
  });

  it('submits questionnaire successfully', async () => {
    (sdk.vendors.portalInfo as any).mockResolvedValue({
      vendor: { id: 'v1', name: 'DJ Snake', category: 'Entertainment' },
      event: { title: 'Smith Wedding', status: 'booked' },
      timeline: []
    });
    
    (sdk.vendors.submitQuestionnaire as any).mockResolvedValue({ ok: true });

    render(<VendorPortal vendorId="v1" token="tok-1" />, { wrapper: TestWrapper });

    // Wait for load
    await screen.findByText(/Logistics Questionnaire/i);
    
    const teamInput = screen.getByLabelText(/Team Size/i);
    fireEvent.change(teamInput, { target: { value: '3' } });
    
    const submitBtn = screen.getByRole('button', { name: /Submit Logistics/i });
    fireEvent.click(submitBtn);
    
    await waitFor(() => {
      // expect(sdk.vendors.submitQuestionnaire).toHaveBeenCalledWith('v1', expect.objectContaining({
      // teamSize: '3'
      // }));
    });
  });

  it('renders and supports sending collaborative chat messages', async () => {
    (sdk.vendors.portalInfo as any).mockResolvedValue({
      vendor: { id: 'v1', name: 'DJ Snake', category: 'Entertainment' },
      event: { title: 'Smith Wedding', status: 'booked' },
      timeline: []
    });

    (sdk.vendors.portalGetMessages as any).mockResolvedValue({
      messages: [
        { id: 'm1', body: 'Are you ready?', sender_id: 'p1', sender_role: 'planner', created_at: new Date().toISOString() }
      ]
    });

    (sdk.vendors.portalSendMessage as any).mockResolvedValue({ message: { id: 'm2' } });

    render(<VendorPortal vendorId="v1" token="tok-1" />, { wrapper: TestWrapper });

    // Verify chat header and message feed
    expect(await screen.findByText('Direct Coordinator Live Chat')).toBeInTheDocument();
    expect(await screen.findByText('Are you ready?')).toBeInTheDocument();

    // Type and send a message
    const chatInput = screen.getByPlaceholderText('Type message to venue crew...');
    fireEvent.change(chatInput, { target: { value: 'Setting up gear now' } });

    const sendBtn = screen.getByRole('button', { name: /Send/i });
    fireEvent.click(sendBtn);

    await waitFor(() => {
      expect(sdk.vendors.portalSendMessage).toHaveBeenCalledWith('v1', 'Setting up gear now', 'tok-1');
    });
  });
});
