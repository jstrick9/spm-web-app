import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../utils/guestPortal', () => {
  return {
    clearGuestPortalSession: vi.fn(),
    getGuestPortalConfig: vi.fn(),
    getPortalGuests: vi.fn(() => []),
    getPortalGuestsForEvent: vi.fn(() => []),
    getPortalRSVPSubmissions: vi.fn(() => []),
    getPortalRSVPSubmissionsForEvent: vi.fn(() => []),
    getPortalVenues: vi.fn(() => []),
    loadGuestPortalSession: vi.fn(() => null),
    saveGuestPortalSession: vi.fn(),
    setPortalRSVPSubmissions: vi.fn(),
    findGuestInEvent: vi.fn(),
    isGuestPortalEventActive: vi.fn(),
    normalizeEventKey: (value: string) =>
      value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, ''),
  };
});

vi.mock('../utils/auth', () => ({
  verifySecret: vi.fn(),
}));

import GuestPortal from './GuestPortal';
import * as guestPortalHelpers from '../utils/guestPortal';

describe('GuestPortal event expiry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows event unavailable banner when portal access has expired', () => {
    vi.mocked(guestPortalHelpers.getGuestPortalConfig).mockReturnValue({
      eventTitle: 'Spring Wedding',
      eventStartDate: '2026-05-12',
      eventEndDate: '2026-05-13',
      showMap: false,
      showSchedule: false,
      showWayfinding: false,
      showRSVP: false,
      showLodging: false,
    } as any);

    vi.mocked(guestPortalHelpers.getPortalVenues).mockReturnValue([]);
    vi.mocked(guestPortalHelpers.getPortalGuests).mockReturnValue([]);
    vi.mocked(guestPortalHelpers.getPortalRSVPSubmissions).mockReturnValue([]);
    vi.mocked(guestPortalHelpers.isGuestPortalEventActive).mockReturnValue(false);

    render(<GuestPortal onExitPortal={() => undefined} />);

    // The sign-in gate now always shows first; the expiry notice appears as an
    // inline banner above the form rather than replacing the form entirely.
    expect(
      screen.getByText(/guest access has closed/i),
    ).toBeInTheDocument();
  });

  it('still shows the sign-in form when the event has expired (banner + form)', () => {
    vi.mocked(guestPortalHelpers.getGuestPortalConfig).mockReturnValue({
      eventTitle: 'Spring Wedding',
      eventStartDate: '2026-05-12',
      eventEndDate: '2026-05-13',
      portalPassword: 'secret123',
      showMap: false,
      showSchedule: false,
      showWayfinding: false,
      showRSVP: false,
      showLodging: false,
    } as any);

    vi.mocked(guestPortalHelpers.getPortalVenues).mockReturnValue([]);
    vi.mocked(guestPortalHelpers.getPortalGuests).mockReturnValue([]);
    vi.mocked(guestPortalHelpers.getPortalRSVPSubmissions).mockReturnValue([]);
    vi.mocked(guestPortalHelpers.isGuestPortalEventActive).mockReturnValue(false);

    render(<GuestPortal onExitPortal={() => undefined} />);

    // Sign-in form fields ARE visible (sign-in gate always renders first)
    expect(screen.getByLabelText(/event name or code/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/guest email or name/i)).toBeInTheDocument();

    // AND the expiry banner is shown inline
    expect(screen.getByText(/guest access has closed/i)).toBeInTheDocument();
  });

  it('clears any existing guest portal session when the event is expired', () => {
    vi.mocked(guestPortalHelpers.getGuestPortalConfig).mockReturnValue({
      eventTitle: 'Spring Wedding',
      eventStartDate: '2026-05-12',
      eventEndDate: '2026-05-13',
      showMap: false,
      showSchedule: false,
      showWayfinding: false,
      showRSVP: false,
      showLodging: false,
    } as any);

    vi.mocked(guestPortalHelpers.getPortalVenues).mockReturnValue([]);
    vi.mocked(guestPortalHelpers.getPortalGuests).mockReturnValue([]);
    vi.mocked(guestPortalHelpers.getPortalRSVPSubmissions).mockReturnValue([]);
    vi.mocked(guestPortalHelpers.isGuestPortalEventActive).mockReturnValue(false);

    render(<GuestPortal onExitPortal={() => undefined} />);

    expect(guestPortalHelpers.clearGuestPortalSession).toHaveBeenCalled();
  });
});
