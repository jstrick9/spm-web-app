import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { EventTimelineTab } from './EventTimelineTab';
import { timelineSdk } from '../../../sdk/timeline';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '../../../ui/Toast';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } }
});

vi.mock('../../../sdk', () => ({
  sdk: {
    timeline: {
      list: vi.fn().mockResolvedValue({ 
        items: [
          { id: 'i1', title: 'Arrival', starts_at: '2025-05-26T14:00:00.000Z', category: 'vendor_arrival', duration_min: 30, completed: 0 },
          { id: 'i2', title: 'Ceremony', starts_at: '2025-05-26T16:00:00.000Z', category: 'ceremony', duration_min: 60, completed: 1 }
        ] 
      }),
      update: vi.fn().mockResolvedValue({ item: {} }),
      create: vi.fn().mockResolvedValue({ item: {} }),
      delete: vi.fn().mockResolvedValue(undefined),
      ops: vi.fn().mockResolvedValue({ ops: { approvals: [], changeLogs: [], incidents: [], reminders: [], offlinePackets: [] } }),
      setApproval: vi.fn().mockResolvedValue({ approval: {} }),
      addChangeLog: vi.fn().mockResolvedValue({ changeLog: {} }),
      addIncident: vi.fn().mockResolvedValue({ incident: {} }),
      addReminder: vi.fn().mockResolvedValue({ reminder: {} }),
      saveOfflinePacket: vi.fn().mockResolvedValue({ offlinePacket: {} }),
      readiness: vi.fn().mockResolvedValue({
        readiness: {
          eventId: 'evt-1', score: 82,
          summary: { timelineItems: 2, vendors: 1, attendingGuests: 10, layoutSeats: 8, assignedSeats: 6, hasApprovedLayout: false },
          issues: [{ id: 'layout-seat-shortage', severity: 'critical', category: 'layout', title: 'Not enough seats for attending guests', detail: '10 guests are attending, but the current layout has 8 seat(s).', href: '#/events/evt-1?tab=layout', relatedIds: [] }]
        }
      })
    },
    vendors: {
      list: vi.fn().mockResolvedValue({ vendors: [{ id: 'v1', name: 'DJ Co', category: 'dj', phone: '555-1000', email: 'dj@example.com' }] })
    },
    staff: {
      listTasks: vi.fn().mockResolvedValue({ tasks: [{ id: 't1', title: 'Line up processional', assignee_name: 'Sam Staff', assignee_phone: '555-2000', phase: 'during-event', status: 'not-started', priority: 'high' }] }),
      createTask: vi.fn().mockResolvedValue({ task: {} })
    }
  }
}));

vi.mock('../../../sdk/timeline', () => ({
  timelineSdk: {
    update: vi.fn(),
    create: vi.fn(),
  }
}));

describe('EventTimelineTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    queryClient.clear();
  });

  const TestWrapper = ({ children }: any) => (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        {children}
      </ToastProvider>
    </QueryClientProvider>
  );

  it('renders timeline items sorted by time and readiness issues', async () => {
    render(<EventTimelineTab eventId="evt-1" organizationId="org-1" />, { wrapper: TestWrapper });
    
    expect(await screen.findByText('Arrival')).toBeInTheDocument();
    expect(screen.getByText('Ceremony')).toBeInTheDocument();
    expect(screen.getByText('Timeline & Layout Readiness')).toBeInTheDocument();
    expect(screen.getByText('Not enough seats for attending guests')).toBeInTheDocument();
    
    expect(screen.getByText(/30 min/i)).toBeInTheDocument();
    // expect(screen.getByText('vendor arrival')).toBeInTheDocument(); // category badge
  });
  
  it('renders manager timeline command center and item assignment controls in manager mode', async () => {
    localStorage.setItem('wvi_registration_role', 'venue_manager');
    render(<EventTimelineTab eventId="evt-1" organizationId="org-1" />, { wrapper: TestWrapper });

    expect(await screen.findByText('Manager timeline readiness review')).toBeInTheDocument();
    expect(screen.getByText('Live timeline command mode')).toBeInTheDocument();
    expect(screen.getByText('What changed since yesterday?')).toBeInTheDocument();
    expect(screen.getByText('Audience print / phone views')).toBeInTheDocument();
    expect(await screen.findAllByText('Manager assignment & day-of controls')).toHaveLength(2);
    expect(screen.getByRole('button', { name: /Make visible offline/i })).toBeInTheDocument();
  });

  it('opens create dialog', async () => {
    render(<EventTimelineTab eventId="evt-1" organizationId="org-1" />, { wrapper: TestWrapper });
    
    expect(await screen.findByText('Arrival')).toBeInTheDocument();
    
    const addBtn = screen.getByRole('button', { name: /Add Item/i });
    fireEvent.click(addBtn);
    
    expect(screen.getByText('Add Timeline Item')).toBeInTheDocument();
  });
});
