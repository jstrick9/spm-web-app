import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TimelineItemFormDialog } from './TimelineItemFormDialog';

vi.mock('../../../sdk', () => ({
  sdk: {
    timeline: {
      create: vi.fn().mockResolvedValue({ item: { id: 'ti1' } }),
      update: vi.fn().mockResolvedValue({ item: { id: 'ti1' } }),
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

describe('TimelineItemFormDialog', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('renders form fields when open', () => {
    render(<TimelineItemFormDialog open={true} onOpenChange={vi.fn()} eventId="e1" item={null} />, { wrapper: wrap() });
    expect(screen.getByText(/title/i)).toBeTruthy();
  });

  it('does not render when closed', () => {
    const { container } = render(<TimelineItemFormDialog open={false} onOpenChange={vi.fn()} eventId="e1" item={null} />, { wrapper: wrap() });
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it('has time and duration fields', () => {
    render(<TimelineItemFormDialog open={true} onOpenChange={vi.fn()} eventId="e1" item={null} />, { wrapper: wrap() });
    expect(screen.getAllByText(/time/i).length).toBeGreaterThanOrEqual(1);
  });
});
