import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GuestMemoryPhotoSharing } from './GuestPortalHome';

const PALETTE = { surface: '#fff', border: '#ddd', fgMuted: '#666', accentSoft: '#f6f6f6' };

const BASE_POST = {
  enabled: true,
  afterEvent: true,
  thankYouTitle: 'Thank you',
  thankYouMessage: 'Grateful.',
  links: [],
  uploadEnabled: true,
  moderationCopy: 'mod',
  consentCopy: 'consent',
  feedbackEnabled: true,
  npsQuestion: 'NPS?',
};

describe('GuestMemoryPhotoSharing — guest-visible gallery documents', () => {
  it('renders approved guest-visible gallery documents with shareable links', () => {
    render(
      <GuestMemoryPhotoSharing
        eventId="e1"
        activeGuest={undefined}
        guestToken=""
        palette={PALETTE as never}
        guestPostEvent={{
          ...BASE_POST,
          galleryDocuments: [
            { id: 'd1', filename: 'ceremony-photos.pdf', mimeType: 'application/pdf', url: '/api/portal/e1/post-event-gallery/d1', notes: 'Approved by the couple' },
          ],
        }}
      />,
    );
    expect(screen.getByText('Photos from your day')).toBeTruthy();
    const link = screen.getByRole('link', { name: /ceremony-photos\.pdf/ });
    expect(link.getAttribute('href')).toBe('/api/portal/e1/post-event-gallery/d1');
    expect(screen.getByText('Approved by the couple')).toBeTruthy();
  });

  it('hides the gallery section when no documents are shared', () => {
    render(
      <GuestMemoryPhotoSharing
        eventId="e1"
        activeGuest={undefined}
        guestToken=""
        palette={PALETTE as never}
        guestPostEvent={{ ...BASE_POST, galleryDocuments: [] }}
      />,
    );
    expect(screen.queryByText('Photos from your day')).toBeNull();
  });

  it('still renders when guestPostEvent is missing entirely (defensive default)', () => {
    render(
      <GuestMemoryPhotoSharing
        eventId="e1"
        activeGuest={undefined}
        guestToken=""
        palette={PALETTE as never}
        guestPostEvent={null}
      />,
    );
    expect(screen.getByText(/Guest Memories, Photos & Feedback/)).toBeTruthy();
  });
});
