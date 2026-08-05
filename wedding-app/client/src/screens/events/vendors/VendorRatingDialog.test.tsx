import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { VendorRatingDialog } from './VendorRatingDialog';

const create = vi.fn().mockResolvedValue({ rating: { id: 'r1' } });
const list = vi.fn().mockResolvedValue({
  ratings: [
    { id: 'r-old', vendor_id: 'v1', event_id: 'e-old', rating: 5, quality_score: 5, timeliness_score: 4, communication_score: 5, review: 'Flawless florals.', created_at: '2026-06-01T10:00:00Z' },
  ],
  aggregate: { avgRating: 5, count: 1, avgQuality: 5, avgTimeliness: 4, avgCommunication: 5 },
});

vi.mock('../../../sdk', () => ({
  sdk: {
    intelligence: {
      vendorRatings: { list: () => list(), create: (vendorId: string, input: unknown) => create(vendorId, input) },
    },
  },
}));
vi.mock('../../../ui/Toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));

const VENDOR = { id: 'v1', name: 'Floral Fantasies', organization_id: 'org1', event_id: 'e1', category: 'florist' } as never;

function wrap() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

describe('VendorRatingDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    list.mockClear();
  });

  it('renders the aggregate score across events', async () => {
    render(<VendorRatingDialog open={true} onOpenChange={vi.fn()} eventId="e1" vendor={VENDOR} />, { wrapper: wrap() });
    expect(await screen.findByText(/across 1 event/)).toBeTruthy();
    expect(screen.getAllByText(/5\.0/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Floral Fantasies/)).toBeTruthy();
  });

  it('shows past reviews', async () => {
    render(<VendorRatingDialog open={true} onOpenChange={vi.fn()} eventId="e1" vendor={VENDOR} />, { wrapper: wrap() });
    expect(await screen.findByText('Flawless florals.')).toBeTruthy();
  });

  it('requires an overall rating before saving', async () => {
    render(<VendorRatingDialog open={true} onOpenChange={vi.fn()} eventId="e1" vendor={VENDOR} />, { wrapper: wrap() });
    await screen.findByText(/across 1 event/);
    const save = screen.getByRole('button', { name: /save rating/i });
    expect((save as HTMLButtonElement).disabled).toBe(true);
  });

  it('submits the selected rating with scores and review', async () => {
    const onClose = vi.fn();
    render(<VendorRatingDialog open={true} onOpenChange={onClose} eventId="e1" vendor={VENDOR} />, { wrapper: wrap() });
    await screen.findByText(/across 1 event/);

    fireEvent.click(screen.getByRole('radio', { name: /overall rating: 4 out of 5/i }));
    fireEvent.change(screen.getByLabelText(/Quality/), { target: { value: '5' } });
    fireEvent.change(screen.getByLabelText(/Review \(optional\)/), { target: { value: 'Stunning centerpieces!' } });

    fireEvent.click(screen.getByRole('button', { name: /save rating/i }));
    await waitFor(() => expect(create).toHaveBeenCalledTimes(1));
    const [vendorId, input] = create.mock.calls[0];
    expect(vendorId).toBe('v1');
    expect(input).toEqual({
      eventId: 'e1',
      rating: 4,
      qualityScore: 5,
      timelinessScore: undefined,
      communicationScore: undefined,
      review: 'Stunning centerpieces!',
    });
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('pre-fills the existing rating for this event and offers update', async () => {
    list.mockResolvedValueOnce({
      ratings: [
        { id: 'r1', vendor_id: 'v1', event_id: 'e1', rating: 3, quality_score: 2, timeliness_score: null, communication_score: null, review: 'OK.', created_at: '2026-07-01T10:00:00Z' },
      ],
      aggregate: { avgRating: 3, count: 1, avgQuality: 2, avgTimeliness: 0, avgCommunication: 0 },
    });
    render(<VendorRatingDialog open={true} onOpenChange={vi.fn()} eventId="e1" vendor={VENDOR} />, { wrapper: wrap() });
    await waitFor(() => expect(screen.getByRole('button', { name: /update rating/i })).toBeTruthy());
    expect(screen.getByRole('radio', { name: /overall rating: 3 out of 5/i }).getAttribute('aria-checked')).toBe('true');
  });
});
