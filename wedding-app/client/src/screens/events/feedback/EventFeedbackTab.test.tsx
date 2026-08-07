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
    couple: {
      postEventReviewQueue: vi.fn().mockResolvedValue({ requests: [], openRequests: [], reviewLinks: { google: '', theKnot: '', weddingwire: '', zola: '', other: '' }, configuredReviewLinks: 0, nps: { totalResponses: 0, averageScore: null, promoters: 0, detractors: 0 }, closeoutApprovals: { lostItemsOpen: 0, testimonialsAwaitingConsent: 0, feedbackToDebrief: 0 }, privacyBoundaries: ['Keep internal notes private.'] }),
      updatePostEventReviewLinks: vi.fn().mockResolvedValue({ reviewLinks: {}, updatedAt: 'now', updatedBy: 'test' }),
      updateRequest: vi.fn().mockResolvedValue({ request: {} }),
      bulkUpdatePostEventReviewQueue: vi.fn().mockResolvedValue({ updated: [], count: 1 }),
      queuePostEventFollowUp: vi.fn().mockResolvedValue({ queued: [], count: 1, channel: 'email' }),
    },
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
      createPoll: vi.fn(),
      submitFeedback: vi.fn().mockResolvedValue({ feedback: { id: 'f2', target: 'Catering', rating: 4, comments: 'Great', submittedBy: 'Venue team' } })
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

describe('EventFeedbackTab — feedback composer', () => {
  beforeEach(() => vi.clearAllMocks());

  it('records feedback via the composer (regression: the card was display-only "No feedback collected yet" with no way to collect it)', async () => {
    render(<EventFeedbackTab eventId="e1" />, { wrapper: ({ children }: any) => <QueryClientProvider client={queryClient}><ToastProvider>{children}</ToastProvider></QueryClientProvider> });
    await screen.findByText('DJ Snake');

    fireEvent.change(screen.getByLabelText('Feedback target'), { target: { value: 'Catering' } });
    fireEvent.change(screen.getByLabelText('Feedback rating'), { target: { value: '4' } });
    fireEvent.change(screen.getByLabelText('Feedback comments'), { target: { value: 'Great service' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add feedback' }));

    await waitFor(() => {
      expect(sdk.feedback.submitFeedback).toHaveBeenCalledWith(
        'e1',
        expect.objectContaining({ target: 'Catering', rating: 4, comments: 'Great service', submittedBy: 'Venue team' }),
      );
    });
  });

  it('does not submit without a target', async () => {
    render(<EventFeedbackTab eventId="e1" />, { wrapper: ({ children }: any) => <QueryClientProvider client={queryClient}><ToastProvider>{children}</ToastProvider></QueryClientProvider> });
    await screen.findByText('DJ Snake');
    fireEvent.click(screen.getByRole('button', { name: 'Add feedback' }));
    expect(sdk.feedback.submitFeedback).not.toHaveBeenCalled();
  });
});
