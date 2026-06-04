import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
    isGuestPortalEventActive: vi.fn(() => true),
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

describe('GuestPortal RSVP event scoping', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(guestPortalHelpers.getGuestPortalConfig).mockReturnValue({
      eventTitle: 'Spring Wedding',
      eventStartDate: '2026-05-12',
      eventEndDate: '2026-05-13',
      showMap: false,
      showSchedule: false,
      showWayfinding: false,
      showRSVP: true,
      showLodging: false,
    } as any);

    vi.mocked(guestPortalHelpers.getPortalVenues).mockReturnValue([]);
    vi.mocked(guestPortalHelpers.getPortalGuests).mockReturnValue([
      {
        id: 'g1',
        name: 'Jane Guest',
        email: 'jane@example.com',
        eventName: 'Spring Wedding',
        allowPortalAccess: true,
      },
    ] as any);

    vi.mocked(guestPortalHelpers.getPortalGuestsForEvent).mockReturnValue([
      {
        id: 'g1',
        name: 'Jane Guest',
        email: 'jane@example.com',
        eventName: 'Spring Wedding',
        allowPortalAccess: true,
      },
    ] as any);

    vi.mocked(guestPortalHelpers.getPortalRSVPSubmissions).mockReturnValue([]);
    vi.mocked(guestPortalHelpers.getPortalRSVPSubmissionsForEvent).mockReturnValue([]);
    vi.mocked(guestPortalHelpers.loadGuestPortalSession).mockReturnValue({
      v: 1,
      guestId: 'g1',
      eventKey: 'spring-wedding',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      portalFingerprint: 'test',
    } as any);
    vi.mocked(guestPortalHelpers.isGuestPortalEventActive).mockReturnValue(true);
  });

  it('stores RSVP submissions with eventName and eventKey', async () => {
    const user = userEvent.setup();

    render(<GuestPortal onExitPortal={() => undefined} />);

    await user.click(screen.getByRole('button', { name: /rsvp now/i }));

    expect(screen.getByDisplayValue('Jane Guest')).toBeInTheDocument();
    expect(screen.getByDisplayValue('jane@example.com')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /submit rsvp/i }));

    await waitFor(() => {
      expect(guestPortalHelpers.setPortalRSVPSubmissions).toHaveBeenCalled();
    });

    const submissionsArg = vi.mocked(
      guestPortalHelpers.setPortalRSVPSubmissions,
    ).mock.calls[0][0];

    expect(Array.isArray(submissionsArg)).toBe(true);
    expect(submissionsArg[0].eventName).toBe('Spring Wedding');
    expect(submissionsArg[0].eventKey).toBe('spring-wedding');
    expect(submissionsArg[0].guestId).toBe('g1');
  });
});