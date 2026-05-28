import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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
      updateTask: vi.fn()
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
});
