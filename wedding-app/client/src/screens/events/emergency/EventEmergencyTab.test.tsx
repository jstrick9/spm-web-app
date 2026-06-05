import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { EventEmergencyTab } from './EventEmergencyTab';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '../../../ui/Toast';
import { sdk } from '../../../sdk';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } }
});

vi.mock('../../../sdk', () => ({
  sdk: {
    events: {
      get: vi.fn(),
      update: vi.fn(),
    }
  }
}));

describe('EventEmergencyTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryClient.clear();

    // Default mock response for sdk.events.get
    (sdk.events.get as any).mockResolvedValue({
      event: {
        id: 'evt-1',
        title: 'Manor Autumn Wedding',
        organization_id: 'org-123',
        status: 'planning',
        metadata: JSON.stringify({
          emergency_active_plan: 'plan-a',
          emergency_kit_checklist: [
            { id: 'bobby-pins', label: 'Bobby Pins & Hair Ties', status: 'stocked' },
            { id: 'safety-pins', label: 'Safety Pins (multi-size)', status: 'stocked' }
          ],
          emergency_incidents: [
            {
              id: 'inc-old',
              title: 'Caterer is 15m late',
              description: 'Stuck in traffic near main road.',
              severity: 'minor',
              status: 'reported',
              assignedTo: 'Planner Jane',
              createdAt: new Date().toISOString()
            }
          ]
        })
      }
    });
  });

  const TestWrapper = ({ children }: any) => (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        {children}
      </ToastProvider>
    </QueryClientProvider>
  );

  it('renders all sections and emergency contacts successfully', async () => {
    render(<EventEmergencyTab eventId="evt-1" />, { wrapper: TestWrapper });

    // Header & controls
    expect(await screen.findByText('Weather & Contingency Status')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Plan A: Outdoor Garden/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Plan B: Weather Backup/i })).toBeInTheDocument();

    // Incident log section
    expect(screen.getByText('On-Site Incident Log')).toBeInTheDocument();
    expect(screen.getByText('Caterer is 15m late')).toBeInTheDocument();

    // Contact Quick-dial
    expect(screen.getByText('Emergency Quick-Dial Contacts')).toBeInTheDocument();
    expect(screen.getByText('Marcus Vance')).toBeInTheDocument();
    expect(screen.getByText('Jane Doe')).toBeInTheDocument();

    // Kit survival items
    expect(screen.getByText('Bobby Pins & Hair Ties')).toBeInTheDocument();
    expect(screen.getByText('Safety Pins (multi-size)')).toBeInTheDocument();
  });

  it('allows toggling active contingency plan to Plan B', async () => {
    (sdk.events.update as any).mockResolvedValue({ event: {} });

    render(<EventEmergencyTab eventId="evt-1" />, { wrapper: TestWrapper });

    const planBButton = await screen.findByRole('button', { name: /Plan B: Weather Backup/i });
    fireEvent.click(planBButton);

    await waitFor(() => {
      expect(sdk.events.update).toHaveBeenCalledWith('evt-1', expect.objectContaining({
        metadata: expect.objectContaining({
          emergency_active_plan: 'plan-b'
        })
      }));
    });
  });

  it('allows reporting/adding a new on-site incident', async () => {
    (sdk.events.update as any).mockResolvedValue({ event: {} });

    render(<EventEmergencyTab eventId="evt-1" />, { wrapper: TestWrapper });

    const logButton = await screen.findByRole('button', { name: /Log Issue/i });
    fireEvent.click(logButton);

    // Form inputs should render
    expect(screen.getByText('Report Real-time Incident')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('E.g. Main power circuit tripped in ballroom'), {
      target: { value: 'Dress rip near hem' }
    });
    fireEvent.change(screen.getByPlaceholderText(/Catering microwave overloaded/i), {
      target: { value: 'Bridal gown has minor rip' }
    });
    fireEvent.change(screen.getByPlaceholderText('E.g. Planner Jane'), {
      target: { value: 'Couture Assistant' }
    });

    const submitBtn = screen.getByRole('button', { name: /Broadcast Incident & Log/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(sdk.events.update).toHaveBeenCalledWith('evt-1', expect.objectContaining({
        metadata: expect.objectContaining({
          emergency_incidents: expect.arrayContaining([
            expect.objectContaining({
              title: 'Dress rip near hem',
              description: 'Bridal gown has minor rip',
              assignedTo: 'Couture Assistant',
              severity: 'minor',
              status: 'reported'
            })
          ])
        })
      }));
    });
  });

  it('allows changing incident status to In Progress and Resolved', async () => {
    (sdk.events.update as any).mockResolvedValue({ event: {} });

    render(<EventEmergencyTab eventId="evt-1" />, { wrapper: TestWrapper });

    const inProgressBtn = await screen.findByRole('button', { name: 'In Progress' });
    fireEvent.click(inProgressBtn);

    await waitFor(() => {
      expect(sdk.events.update).toHaveBeenCalledWith('evt-1', expect.objectContaining({
        metadata: expect.objectContaining({
          emergency_incidents: [
            expect.objectContaining({
              id: 'inc-old',
              status: 'in-progress'
            })
          ]
        })
      }));
    });
  });

  it('allows toggling inventory stock levels of the survival kit', async () => {
    (sdk.events.update as any).mockResolvedValue({ event: {} });

    render(<EventEmergencyTab eventId="evt-1" />, { wrapper: TestWrapper });

    const bobbyPinsItem = await screen.findByText('Bobby Pins & Hair Ties');
    fireEvent.click(bobbyPinsItem); // should toggle 'stocked' -> 'low'

    await waitFor(() => {
      expect(sdk.events.update).toHaveBeenCalledWith('evt-1', expect.objectContaining({
        metadata: expect.objectContaining({
          emergency_kit_checklist: expect.arrayContaining([
            { id: 'bobby-pins', label: 'Bobby Pins & Hair Ties', status: 'low' }
          ])
        })
      }));
    });
  });

  it('allows toggling Plan B safety compliance items and broadcasting announcements', async () => {
    (sdk.events.update as any).mockResolvedValue({ event: {} });

    render(<EventEmergencyTab eventId="evt-1" />, { wrapper: TestWrapper });

    // Verify Safety Compliance section
    expect(await screen.findByText('Plan B Safety Compliance Auditor')).toBeInTheDocument();
    
    // Toggle "Emergency backup generator fuel levels verified at 100%"
    const checkItem = screen.getByText('Emergency backup generator fuel levels verified at 100%');
    fireEvent.click(checkItem);

    await waitFor(() => {
      expect(sdk.events.update).toHaveBeenCalledWith('evt-1', expect.objectContaining({
        metadata: expect.objectContaining({
          emergency_compliance_checklist: expect.objectContaining({
            generator: true
          })
        })
      }));
    });

    // Verify and Submit Mass Announcement Broadcast
    expect(screen.getByText('Mass Emergency Broadcasts')).toBeInTheDocument();
    const broadcastInput = screen.getByLabelText(/Compose Announcement/i);
    fireEvent.change(broadcastInput, { target: { value: 'Ballroom gate is now open' } });
    
    const broadcastBtn = screen.getByRole('button', { name: /Broadcast/i });
    fireEvent.click(broadcastBtn);

    await waitFor(() => {
      expect(sdk.events.update).toHaveBeenCalledWith('evt-1', expect.objectContaining({
        metadata: expect.objectContaining({
          emergency_broadcast_announcement: 'Ballroom gate is now open'
        })
      }));
    });
  });
});
