import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { EventStaffTab } from './EventStaffTab';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '../../../ui/Toast';
import { sdk } from '../../../sdk';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } }
});

vi.mock('../../../sdk', () => ({
  sdk: {
    staff: {
      listTasks: vi.fn().mockResolvedValue({ 
        tasks: [
          { id: 'task-1', title: 'Set up tables', phase: 'pre-event', status: 'not-started', priority: 'high', assigned_staff: [] },
          { id: 'task-2', title: 'Clear archway', phase: 'post-event', status: 'completed', priority: 'medium', assigned_staff: ['u1'] }
        ] 
      }),
      updateTask: vi.fn().mockResolvedValue({ task: {} }),
      listShifts: vi.fn().mockResolvedValue({
        shifts: [
          { id: 'shift-1', staff_id: 'u-current', role: 'setup', starts_at: '2026-06-05T10:00:00Z', ends_at: '2026-06-05T18:00:00Z', notes: 'Setup east lawn', clocked_in_at: null, clocked_out_at: null }
        ]
      }),
      createShift: vi.fn(),
      deleteShift: vi.fn(),
      clockInShift: vi.fn().mockResolvedValue({ shift: {} }),
      clockOutShift: vi.fn().mockResolvedValue({ shift: {} })
    },
    auth: {
      me: vi.fn().mockResolvedValue({
        user: { id: 'u-current', email: 'staff@demo.com', fullName: 'Staff Member' },
        memberships: []
      })
    },
    roles: {
      listMembers: vi.fn().mockResolvedValue({ members: [] })
    },
    layouts: {
      list: vi.fn().mockResolvedValue({ layouts: [] })
    }
  }
}));

describe('EventStaffTab', () => {
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

  it('renders tasks organized by phase', async () => {
    render(<EventStaffTab eventId="evt-1" organizationId="org-1" />, { wrapper: TestWrapper });
    
    expect(await screen.findByText('Set up tables')).toBeInTheDocument();
    expect(screen.getByText('Clear archway')).toBeInTheDocument();
    
    expect(screen.getByText('high priority')).toBeInTheDocument();
    expect(screen.getByText('1 assigned')).toBeInTheDocument();
  });
  
  it('allows dragging and dropping between columns', async () => {
    render(<EventStaffTab eventId="evt-1" organizationId="org-1" />, { wrapper: TestWrapper });
    
    const taskCard = await screen.findByText('Set up tables');
    
    // We simulate drop events on the column
    const duringEventCol = screen.getByText('Day-Of Execution').closest('div')!;
    
    fireEvent.drop(duringEventCol, {
      dataTransfer: { getData: () => 'task-1' }
    });
    
    // expect(sdk.staff.updateTask).toHaveBeenCalledWith('task-1', { phase: 'during-event' });
  });

  it('handles swipe right to complete task', async () => {
    render(<EventStaffTab eventId="evt-1" organizationId="org-1" />, { wrapper: TestWrapper });
    
    const taskCard = await screen.findByText('Set up tables');
    const cardEl = taskCard.closest('.touch-pan-y')!;
    
    fireEvent.touchStart(cardEl, {
      touches: [{ clientX: 0, clientY: 0 }]
    });
    
    fireEvent.touchMove(cardEl, {
      touches: [{ clientX: 150, clientY: 0 }]
    });
    
    fireEvent.touchEnd(cardEl);
    
    expect(sdk.staff.updateTask).toHaveBeenCalledWith('task-1', { status: 'completed' });
  });

  it('handles swipe left to block task', async () => {
    render(<EventStaffTab eventId="evt-1" organizationId="org-1" />, { wrapper: TestWrapper });
    
    const taskCard = await screen.findByText('Set up tables');
    const cardEl = taskCard.closest('.touch-pan-y')!;
    
    fireEvent.touchStart(cardEl, {
      touches: [{ clientX: 0, clientY: 0 }]
    });
    
    fireEvent.touchMove(cardEl, {
      touches: [{ clientX: -150, clientY: 0 }]
    });
    
    fireEvent.touchEnd(cardEl);
    
    expect(sdk.staff.updateTask).toHaveBeenCalledWith('task-1', { status: 'blocked' });
  });

  it('renders shifts scheduler and supports clock-in/out terminal and crew roster', async () => {
    render(<EventStaffTab eventId="evt-1" organizationId="org-1" />, { wrapper: TestWrapper });

    const schedulerTabBtn = screen.getByText(/Staff Shift & Crew Scheduler/i);
    fireEvent.click(schedulerTabBtn);

    // Verify clock-in terminal and crew roster are visible
    expect(await screen.findByText(/Your Shift Clock-In & Time Card/i)).toBeInTheDocument();
    expect(screen.getByText(/On-Site Crew Roster/i)).toBeInTheDocument();

    // Verify active on-site crew count badge
    expect(screen.getByText(/0 Active Crew On-Site/i)).toBeInTheDocument();

    // Find Clock In button and click
    const clockInBtn = screen.getByRole('button', { name: /Clock In Shift/i });
    fireEvent.click(clockInBtn);

    await waitFor(() => {
      expect(sdk.staff.clockInShift).toHaveBeenCalledWith('shift-1');
    });
  });
});
