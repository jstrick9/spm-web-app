import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { EventQuestionsStudio } from './EventQuestionsStudio';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ToastProvider } from '../../../ui/Toast';
import { sdk } from '../../../sdk';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } }
});

vi.mock('../../../sdk', () => ({
  sdk: {
    questions: {
      list: vi.fn().mockResolvedValue({ 
        questions: [
          { id: 'q1', group_name: 'Logistics', question: 'Do you need early load-in?', answer_type: 'boolean', required: 1, sort_order: 0 },
          { id: 'q2', group_name: 'Catering', question: 'Any dietary restrictions?', answer_type: 'multiselect', required: 0, sort_order: 1, options: '["None", "Vegan", "Gluten-Free"]' }
        ] 
      }),
      delete: vi.fn()
    }
  }
}));

describe('EventQuestionsStudio', () => {
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

  it('renders question groupings', async () => {
    render(<EventQuestionsStudio orgId="org-1" />, { wrapper: TestWrapper });
    
    // Check Groups Rendered
    expect(await screen.findByText('Logistics')).toBeInTheDocument();
    expect(screen.getByText('Catering')).toBeInTheDocument();
    
    // Check questions rendered
    expect(screen.getByText('Do you need early load-in?')).toBeInTheDocument();
    expect(screen.getByText('Any dietary restrictions?')).toBeInTheDocument();
    
    // Check badges
    expect(screen.getByText('boolean')).toBeInTheDocument();
    expect(screen.getByText('multiselect')).toBeInTheDocument();
  });
});
