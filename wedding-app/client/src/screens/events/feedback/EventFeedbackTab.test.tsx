import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { EventFeedbackTab } from './EventFeedbackTab';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '../../../ui/Toast';
import { sdk } from '../../../sdk';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } }
});

vi.mock('../../../sdk', () => ({
  sdk: {
    feedback: {
      getPolls: vi.fn().mockResolvedValue({ 
        polls: [
          { id: 'p1', question: 'Which centerpiece?', status: 'active', options: [{ id: 'o1', text: 'Tall Vase', votes: 15 }, { id: 'o2', text: 'Low Floral', votes: 5 }] }
        ] 
      }),
      getFeedback: vi.fn().mockResolvedValue({ 
        feedback: [
          { id: 'f1', target: 'DJ Snake', rating: 5, comments: 'Great mix!', submittedBy: 'Sarah Smith' }
        ] 
      }),
      createPoll: vi.fn()
    }
  }
}));

describe('EventFeedbackTab', () => {
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

  it('renders polls and calculates voting percentages', async () => {
    render(<EventFeedbackTab eventId="evt-1" />, { wrapper: TestWrapper });
    
    expect(await screen.findByText('Which centerpiece?')).toBeInTheDocument();
    
    // Check options and math (15 vs 5 means 75% to 25%)
    expect(screen.getByText('Tall Vase')).toBeInTheDocument();
    expect(screen.getByText('15 (75%)')).toBeInTheDocument();
    expect(screen.getByText('5 (25%)')).toBeInTheDocument();
  });

  it('renders feedback and calculates average ratings', async () => {
    render(<EventFeedbackTab eventId="evt-1" />, { wrapper: TestWrapper });
    
    expect(await screen.findByText('DJ Snake')).toBeInTheDocument();
    expect(screen.getByText('"Great mix!"')).toBeInTheDocument();
    
    // Average rating
    expect(screen.getByText('5.0')).toBeInTheDocument();
  });

  it('allows creating a new poll', async () => {
    (sdk.feedback.createPoll as any).mockResolvedValue({ poll: { id: 'p2' } });

    render(<EventFeedbackTab eventId="evt-1" />, { wrapper: TestWrapper });
    
    await screen.findByText('Create New Poll');
    
    fireEvent.change(screen.getByPlaceholderText('E.g., Which centerpiece design?'), { target: { value: 'Outdoor or Indoor ceremony?' } });
    fireEvent.change(screen.getByPlaceholderText('Option 1'), { target: { value: 'Outdoor' } });
    fireEvent.change(screen.getByPlaceholderText('Option 2'), { target: { value: 'Indoor' } });
    
    fireEvent.click(screen.getByRole('button', { name: /Publish Poll/i }));
    
    await waitFor(() => {
      expect(sdk.feedback.createPoll).toHaveBeenCalledWith('evt-1', expect.objectContaining({
        question: 'Outdoor or Indoor ceremony?'
      }));
    });
  });
});
