import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { QuestionFormDialog } from './QuestionFormDialog';

vi.mock('../../../sdk', () => ({
  sdk: {
    questions: {
      create: vi.fn().mockResolvedValue({ question: { id: 'q1' } }),
      update: vi.fn().mockResolvedValue({ question: { id: 'q1' } }),
    },
  },
}));
vi.mock('../../../ui/Toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));

function wrap() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

describe('QuestionFormDialog', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('renders form fields when open', () => {
    render(<QuestionFormDialog open={true} onOpenChange={vi.fn()} orgId="org1" question={null} existingGroups={["General"]} />, { wrapper: wrap() });
    expect(screen.getAllByText(/question/i).length).toBeGreaterThanOrEqual(1);
  });

  it('does not render when closed', () => {
    const { container } = render(<QuestionFormDialog open={false} onOpenChange={vi.fn()} orgId="org1" question={null} existingGroups={["General"]} />, { wrapper: wrap() });
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it('has a submit button', () => {
    render(<QuestionFormDialog open={true} onOpenChange={vi.fn()} orgId="org1" question={null} existingGroups={["General"]} />, { wrapper: wrap() });
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThanOrEqual(1);
  });
});
