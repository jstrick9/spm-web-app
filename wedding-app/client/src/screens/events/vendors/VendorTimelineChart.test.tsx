import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { VendorTimelineChart } from './VendorTimelineChart';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { sdk } from '../../../sdk';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } }
});

vi.mock('../../../sdk', () => ({
  sdk: {
    events: {
      get: vi.fn().mockResolvedValue({ event: { organization_id: 'org-1' } })
    },
    timeline: {
      list: vi.fn().mockResolvedValue({ 
        items: [
          { id: 'i1', vendor_id: 'v1', title: 'Load In', starts_at: '2026-05-27T10:00:00.000Z', duration_min: 120, category: 'vendor_arrival' },
          { id: 'i2', vendor_id: 'v2', title: 'Arrival', starts_at: '2026-05-27T10:30:00.000Z', duration_min: 60, category: 'vendor_arrival' }
        ] 
      })
    },
    vendors: {
      list: vi.fn().mockResolvedValue({ 
        vendors: [
          { id: 'v1', name: 'Acme Catering', category: 'Catering' },
          { id: 'v2', name: 'Snap Pics', category: 'Photography' }
        ] 
      })
    }
  }
}));

describe('VendorTimelineChart', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const TestWrapper = ({ children }: any) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  it('renders timeline spans and detects conflicts', async () => {
    render(<VendorTimelineChart eventId="evt-1" />, { wrapper: TestWrapper });
    
    // Check titles
    expect(await screen.findByText('Vendor Timeline Chart')).toBeInTheDocument();
    
    // Check vendors listed
    expect(screen.getByText('Acme Catering')).toBeInTheDocument();
    expect(screen.getByText('Snap Pics')).toBeInTheDocument();
    
    // Check conflict detected
    expect(screen.getByText(/1 Overlap Conflicts Detected/i)).toBeInTheDocument();
    expect(screen.getByText(/Acme Catering and Snap Pics are scheduled to arrive\/prep simultaneously/i)).toBeInTheDocument();
  });
});
