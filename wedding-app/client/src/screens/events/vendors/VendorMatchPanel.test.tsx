import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { VendorMatchPanel } from './VendorMatchPanel';

const matchesMock = vi.fn();
vi.mock('../../../sdk', () => ({
  sdk: { vendorScoring: { matches: (...a: unknown[]) => matchesMock(...a) } },
}));

function wrap() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  matchesMock.mockResolvedValue({
    matches: [
      { vendorId: 'v1', name: 'Ace DJ', category: 'dj', isPreferred: true, ratingCount: 6, avgRating: 5,
        avgQuality: 5, avgTimeliness: 5, avgCommunication: 5, reliabilityScore: 96, tier: 'top_rated',
        typicalContractCents: 300000, fitScore: 100, budgetFit: 'within', matchReasons: ['Preferred vendor', 'Top rated (5★, 6 reviews)', 'Fits the budget band'] },
      { vendorId: 'v2', name: 'Budget Blooms', category: 'florist', isPreferred: false, ratingCount: 0,
        avgRating: 0, avgQuality: 0, avgTimeliness: 0, avgCommunication: 0, reliabilityScore: 0, tier: 'unrated',
        typicalContractCents: null, fitScore: 40, budgetFit: 'unknown', matchReasons: ['No reviews yet'] },
    ],
  });
});

describe('VendorMatchPanel', () => {
  it('renders ranked recommendations with reasons and fit scores', async () => {
    render(<VendorMatchPanel eventId="e1" />, { wrapper: wrap() });
    expect(await screen.findByText('Ace DJ')).toBeInTheDocument();
    expect(screen.getByText('Budget Blooms')).toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument();          // fit score of #1
    // The tier badge renders 'Top Rated' (with a space); reasons text uses
    // 'Top rated' — assert the badge label specifically.
    expect(screen.getByText('Top Rated')).toBeInTheDocument();
    expect(screen.getByText(/Fits the budget band/)).toBeInTheDocument();
  });

  it('shows an empty-state when no vendors can be recommended', async () => {
    matchesMock.mockResolvedValue({ matches: [] });
    render(<VendorMatchPanel eventId="e1" />, { wrapper: wrap() });
    await waitFor(() => expect(screen.getByText(/No vendors to recommend yet/i)).toBeInTheDocument());
  });
});
