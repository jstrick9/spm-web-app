import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
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
    couple: {
      documents: vi.fn().mockResolvedValue({
        documents: [
          { id: 'cd1', filename: 'menu.pdf', url: '/api/events/e1/couple-documents/cd1/content', mimeType: 'application/pdf', category: 'menu', visibility: 'couple_venue', approvalStatus: 'approved', version: 1, notes: 'Final menu', extractedSummary: null, history: [], reviewedBy: null, reviewedAt: null, createdAt: '', updatedAt: '' },
          { id: 'cd2', filename: 'private.pdf', url: '/api/events/e1/couple-documents/cd2/content', mimeType: 'application/pdf', category: 'insurance', visibility: 'couple', approvalStatus: 'pending', version: 1, notes: null, extractedSummary: null, history: [], reviewedBy: null, reviewedAt: null, createdAt: '', updatedAt: '' },
        ],
        counts: {},
        reviewQueue: [],
        postEventGallery: [],
        allowedTypes: ['application/pdf'],
        maxBytes: 1,
        categories: [],
        visibilityOptions: [],
      }),
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

  it('navigates the lightbox with arrow keys and prev/next buttons (UX-09)', async () => {
    render(<EventGalleryTab eventId="e1" />, { wrapper: wrap() });
    await waitFor(() => {
      expect(screen.getAllByRole('img').length).toBeGreaterThanOrEqual(2);
    });
    // Open the lightbox on the first image
    fireEvent.click(screen.getAllByRole('img')[0]);
    await waitFor(() => expect(screen.getByLabelText(/close image preview/i)).toBeTruthy());

    // First image: "Previous" hidden, "Next" visible
    expect(screen.queryByLabelText(/previous image/i)).toBeNull();
    expect(screen.getByLabelText(/next image/i)).toBeTruthy();

    // ArrowRight advances to the last image -> Next disappears, Previous appears
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    await waitFor(() => {
      expect(screen.getByLabelText(/previous image/i)).toBeTruthy();
    });
    expect(screen.queryByLabelText(/next image/i)).toBeNull();

    // ArrowLeft returns to the first image
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    await waitFor(() => {
      expect(screen.getByLabelText(/next image/i)).toBeTruthy();
    });
    expect(screen.queryByLabelText(/previous image/i)).toBeNull();

    // Escape closes the lightbox
    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => {
      expect(screen.queryByLabelText(/close image preview/i)).toBeNull();
    });
  });

  it('swipes left/right to navigate the lightbox on touch (UX-13)', async () => {
    render(<EventGalleryTab eventId="e1" />, { wrapper: wrap() });
    await waitFor(() => {
      expect(screen.getAllByRole('img').length).toBeGreaterThanOrEqual(2);
    });
    fireEvent.click(screen.getAllByRole('img')[0]);
    await waitFor(() => expect(screen.getByLabelText(/next image/i)).toBeTruthy());

    // Swipe left (dx < -40) advances to the next image
    const overlay = screen.getByLabelText(/close image preview/i).parentElement!;
    fireEvent.touchStart(overlay, { touches: [{ clientX: 300, clientY: 100 }] });
    fireEvent.touchEnd(overlay, { changedTouches: [{ clientX: 100, clientY: 100 }] });
    await waitFor(() => expect(screen.getByLabelText(/previous image/i)).toBeTruthy());
    expect(screen.queryByLabelText(/next image/i)).toBeNull();

    // Swipe right (dx > 40) returns to the first image
    fireEvent.touchStart(overlay, { touches: [{ clientX: 100, clientY: 100 }] });
    fireEvent.touchEnd(overlay, { changedTouches: [{ clientX: 300, clientY: 100 }] });
    await waitFor(() => expect(screen.getByLabelText(/next image/i)).toBeTruthy());
    expect(screen.queryByLabelText(/previous image/i)).toBeNull();
  });

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

  it('lists couple-shared documents but hides couple-private ones', async () => {
    render(<EventGalleryTab eventId="e1" />, { wrapper: wrap() });
    await waitFor(() => {
      expect(screen.getByText('Couple-shared documents')).toBeTruthy();
    });
    expect(screen.getByText('menu.pdf')).toBeTruthy();
    expect(screen.queryByText('private.pdf')).toBeNull();
    const viewLink = screen.getByRole('link', { name: /View/ });
    expect(viewLink.getAttribute('href')).toBe('/api/events/e1/couple-documents/cd1/content');
  });
});
