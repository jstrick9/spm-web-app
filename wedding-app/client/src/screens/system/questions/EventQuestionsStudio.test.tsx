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
      delete: vi.fn(),
      create: vi.fn().mockResolvedValue({ question: {} })
    }
  }
}));

describe('EventQuestionsStudio', () => {
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

  it('renders question groupings', async () => {
    render(<EventQuestionsStudio orgId="org-1" />, { wrapper: TestWrapper });
    
    // Check Groups Rendered as Headings
    expect(await screen.findByRole('heading', { level: 3, name: /Logistics/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: /Catering/i })).toBeInTheDocument();
    
    // Check questions rendered
    expect(screen.getByText('Do you need early load-in?')).toBeInTheDocument();
    expect(screen.getByText('Any dietary restrictions?')).toBeInTheDocument();
    
    // Check badges
    expect(screen.getByText('boolean')).toBeInTheDocument();
    expect(screen.getByText('multiselect')).toBeInTheDocument();
  });

  it('supports defaults loading and quick adding of event questions', async () => {
    render(<EventQuestionsStudio orgId="org-1" />, { wrapper: TestWrapper });

    // Verify quick adding Logistics & Access preset
    const quickAddLogisticsBtn = await screen.findByRole('button', { name: /📦 Logistics & Access/i });
    fireEvent.click(quickAddLogisticsBtn);
    expect(sdk.questions.create).toHaveBeenCalledWith('org-1', expect.objectContaining({
       question: 'Do you require overnight storage of decor?',
       groupName: 'Logistics & Access'
    }));

    // Verify quick adding Music preset
    const quickAddMusicBtn = screen.getByRole('button', { name: /🎵 Music & First Dance/i });
    fireEvent.click(quickAddMusicBtn);
    expect(sdk.questions.create).toHaveBeenCalledWith('org-1', expect.objectContaining({
       question: 'What is your primary song choice for the first dance?',
       groupName: 'Music & Entertainment'
    }));

    // Verify loading Defaults
    const loadDefaultsBtn = screen.getByRole('button', { name: /💾 Load Question Defaults/i });
    fireEvent.click(loadDefaultsBtn);
    expect(sdk.questions.create).toHaveBeenCalled();
  });
});
