import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TimelineItemFormDialog } from './TimelineItemFormDialog';
import { timelineSdk } from '../../../sdk/timeline';

vi.mock('../../../sdk/timeline', () => ({
  timelineSdk: {
    create: vi.fn().mockResolvedValue({ item: { id: 'ti1' } }),
    update: vi.fn().mockResolvedValue({ item: { id: 'ti1' } }),
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

  it('anchors new items to the EVENT date, not the creation date', async () => {
    const tz = process.env.TZ;
    process.env.TZ = 'America/New_York';
    try {
      // Title + time inputs (time input located by type — Radix label
      // association is unreliable in jsdom).
      const { container } = render(
        <TimelineItemFormDialog open={true} onOpenChange={vi.fn()} eventId="e1" item={null} eventStartDate="2026-09-12" />,
        { wrapper: wrap() },
      );
const titleInput = document.querySelector('input[placeholder="e.g., Cocktail Hour"]') as HTMLInputElement;
      fireEvent.change(titleInput, { target: { value: 'Ceremony' } });
      const timeInput = document.querySelector('input[type="time"]') as HTMLInputElement;
      fireEvent.change(timeInput, { target: { value: '16:30' } });
      fireEvent.click(screen.getByRole('button', { name: 'Add Item' }));
      await waitFor(() => expect(timelineSdk.create).toHaveBeenCalledTimes(1));
      const payload = (timelineSdk.create as ReturnType<typeof vi.fn>).mock.calls[0][1] as { startsAt: string };
      // The instant must be ON the wedding day: Sep 12 16:30 NY = 20:30Z.
      expect(payload.startsAt).toBe('2026-09-12T20:30:00.000Z');
    } finally {
      if (tz === undefined) delete process.env.TZ; else process.env.TZ = tz;
    }
  });
});
