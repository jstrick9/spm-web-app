import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { I18nProvider } from '../../i18n/I18nContext';
import { GuestMemoryPhotoSharing, GuestPortalHome } from './GuestPortalHome';

const PALETTE = { surface: '#fff', border: '#ddd', fgMuted: '#666', accentSoft: '#f6f6f6' };

const I18nWrapper = ({ children }: { children: React.ReactNode }) => <I18nProvider>{children}</I18nProvider>;

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
      { wrapper: I18nWrapper },
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
      { wrapper: I18nWrapper },
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
      { wrapper: I18nWrapper },
    );
    expect(screen.getByText(/Guest Memories, Photos & Feedback/)).toBeTruthy();
  });
});

describe('GuestPortalHome — event date tiles', () => {
  type PortalHomeProps = Parameters<typeof GuestPortalHome>[0];
  const PORTAL_PROPS = {
    eventId: 'e1',
    info: { id: 'e1', title: 'Test Wedding', startDate: '2026-09-12', endDate: null },
    guestHome: null,
    palette: PALETTE as never,
    guestToken: '',
    portalAccess: null,
    lookupQuery: '',
    setLookupQuery: () => {},
    lookupEmail: '',
    setLookupEmail: () => {},
    lookupGuest: () => {},
    lookupMessage: '',
    lookupResults: [],
    onSelectLookupGuest: () => {},
    resendSecureLink: () => {},
    requestGuestHelp: () => {},
    venueReplies: [],
    venueMessagesEmpty: '',
    setActiveTab: () => {},
    saveGuestEventDetails: () => {},
    config: {},
    branding: null,
    guestTravel: null,
    guestFaq: null,
    guestGifts: null,
    guestCare: null,
    guestPrivacy: null,
    guestReminders: null,
    guestDayOf: null,
    guestPostEvent: null,
  } as unknown as PortalHomeProps;

  it('renders a date-only start date as a DATE, never a fabricated midnight time', () => {
    render(<GuestPortalHome {...PORTAL_PROPS} />, { wrapper: I18nWrapper });
    // "Date / time" tile label is now honest: the event has no time-of-day data
    expect(screen.getByText('Date')).toBeTruthy();
    // Both the summary tile and the event-day Schedule tile show the date only
    expect(screen.getAllByText('September 12, 2026').length).toBeGreaterThanOrEqual(1);
    // The old behavior rendered "Sep 12, 2026, 12:00 AM" — a time that does not exist
    expect(screen.queryByText(/12:00 AM/i)).toBeNull();
    expect(screen.queryByText(/12:00 PM/i)).toBeNull();
  });

  it('falls back to TBD / pending copy when no start date is set', () => {
    render(
      <GuestPortalHome
        {...PORTAL_PROPS}
        info={{ id: 'e1', title: 'Test Wedding', startDate: null, endDate: null }}
      />,
      { wrapper: I18nWrapper },
    );
    expect(screen.getAllByText('TBD').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Schedule pending')).toBeTruthy();
  });
});
