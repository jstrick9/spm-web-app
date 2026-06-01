import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { EventGalleryTab } from './EventGalleryTab';

vi.mock('../../../sdk', () => ({
  sdk: {
    gallery: {
      list: vi.fn().mockResolvedValue({
        images: [
          { id: 'g1', filename: 'rose.jpg', url: 'data:image/jpeg;base64,abc', category: 'florals', caption: 'Pink roses', sort_order: 0, created_at: '2026-01-01' },
          { id: 'g2', filename: 'lights.jpg', url: 'data:image/jpeg;base64,def', category: 'lighting', caption: null, sort_order: 1, created_at: '2026-01-02' },
        ],
        counts: { florals: 1, lighting: 1 },
      }),
      upload: vi.fn().mockResolvedValue({ image: { id: 'g3' } }),
      update: vi.fn().mockResolvedValue({ image: {} }),
      delete: vi.fn().mockResolvedValue(undefined),
    },
  },
}));
vi.mock('../../../ui/Toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('../../../lib/usePermission', () => ({ usePermission: () => true }));

function wrap() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe('EventGalleryTab', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('renders gallery images from server', async () => {
    render(<EventGalleryTab eventId="e1" />, { wrapper: wrap() });
    await waitFor(() => {
      const images = screen.getAllByRole('img');
      expect(images.length).toBeGreaterThanOrEqual(2);
    });
  });

  it('renders category filter chips with counts', async () => {
    render(<EventGalleryTab eventId="e1" />, { wrapper: wrap() });
    await waitFor(() => {
      expect(screen.getByText(/florals \(1\)/i)).toBeTruthy();
      expect(screen.getByText(/lighting \(1\)/i)).toBeTruthy();
    });
  });

  it('shows upload button when user has gallery.manage', async () => {
    render(<EventGalleryTab eventId="e1" />, { wrapper: wrap() });
    await waitFor(() => {
      expect(screen.getByText('Upload')).toBeTruthy();
    });
  });
});
