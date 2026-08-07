import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CoupleIntakePanel } from './CoupleIntakePanel';
import { sdk } from '../../sdk';

vi.mock('../../sdk', () => ({
  sdk: {
    questions: {
      listForEvent: vi.fn(),
      listAnswers: vi.fn(),
      upsertAnswer: vi.fn().mockResolvedValue({ answer: {} }),
    },
  },
}));

vi.mock('../../ui/Toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));

const QUESTIONS = {
  questions: [
    { id: 'q1', question: 'Ceremony style?', group_name: 'Ceremony', answer_type: 'text', options: '[]', required: 1, sort_order: 0 },
    { id: 'q2', question: 'Guest count?', group_name: 'Guests', answer_type: 'integer', options: '[]', required: 0, sort_order: 0 },
    { id: 'q3', question: 'Centerpiece?', group_name: 'Ceremony', answer_type: 'dropdown', options: '["Floral","Candle","None"]', required: 0, sort_order: 1 },
  ],
};

function wrap() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

describe('CoupleIntakePanel — couples answer the venue intake forms (was dead-ended)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (sdk.questions.listForEvent as any).mockResolvedValue(QUESTIONS);
    (sdk.questions.listAnswers as any).mockResolvedValue({ answers: [{ question_id: 'q1', answer: 'Garden arbor' }] });
  });

  it('renders questions grouped with the right controls and saved state', async () => {
    render(<CoupleIntakePanel eventId="e1" />, { wrapper: wrap() });
    expect(await screen.findByText('Couple Intake & Questionnaire')).toBeInTheDocument();
    expect(await screen.findByText('Ceremony')).toBeInTheDocument();
    expect(screen.getByText('Guests')).toBeInTheDocument();
    // saved answer for q1 is prefilled
    const q1Input = screen.getByLabelText('Ceremony style?') as HTMLInputElement;
    expect(q1Input.value).toBe('Garden arbor');
    // dropdown renders with parsed options
    const dropdown = screen.getByLabelText('Centerpiece?') as HTMLSelectElement;
    expect(Array.from(dropdown.options).map((o) => o.value)).toContain('Floral');
    // per-group progress
    expect(screen.getByText('1/2 answered')).toBeInTheDocument();
  });

  it('blocks saving a group with unanswered required questions', async () => {
    (sdk.questions.listAnswers as any).mockResolvedValue({ answers: [] });
    render(<CoupleIntakePanel eventId="e1" />, { wrapper: wrap() });
    await screen.findByText('Couple Intake & Questionnaire');
    await screen.findByText('Ceremony');
    const saveButtons = screen.getAllByRole('button', { name: 'Save group' });
    fireEvent.click(saveButtons[0]); // Ceremony group has required q1 unanswered
    expect(sdk.questions.upsertAnswer).not.toHaveBeenCalled();
  });

  it('saves all answers in a group when required ones are filled', async () => {
    (sdk.questions.listAnswers as any).mockResolvedValue({ answers: [] });
    render(<CoupleIntakePanel eventId="e1" />, { wrapper: wrap() });
    await screen.findByText('Couple Intake & Questionnaire');
    await screen.findByText('Ceremony');
    fireEvent.change(screen.getByLabelText('Ceremony style?'), { target: { value: 'Garden ceremony' } });
    const saveButtons = screen.getAllByRole('button', { name: 'Save group' });
    fireEvent.click(saveButtons[0]);
    await waitFor(() => {
      expect(sdk.questions.upsertAnswer).toHaveBeenCalledWith('e1', 'q1', 'Garden ceremony');
      expect(sdk.questions.upsertAnswer).toHaveBeenCalledWith('e1', 'q3', '');
    });
  });
});
