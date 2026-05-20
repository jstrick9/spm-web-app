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

describe('GuestPortal lodging access', () => {
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
      showLodging: true,
    } as any);

    vi.mocked(guestPortalHelpers.getPortalVenues).mockReturnValue([
      {
        id: 'venue-1',
        name: 'Onsite Lodge',
        width: 40,
        height: 30,
        capacity: 10,
        category: 'lodging',
        floors: [],
      },
    ] as any);

    vi.mocked(guestPortalHelpers.getPortalRSVPSubmissions).mockReturnValue([]);
    vi.mocked(guestPortalHelpers.getPortalRSVPSubmissionsForEvent).mockReturnValue([]);
    vi.mocked(guestPortalHelpers.isGuestPortalEventActive).mockReturnValue(true);
  });

  it('hides the Lodging tab when the guest does not have lodging access', () => {
    vi.mocked(guestPortalHelpers.loadGuestPortalSession).mockReturnValue({
      v: 1,
      guestId: 'g1',
      eventKey: 'spring-wedding',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      portalFingerprint: 'test',
    } as any);

    vi.mocked(guestPortalHelpers.getPortalGuests).mockReturnValue([
      {
        id: 'g1',
        name: 'Jane Guest',
        email: 'jane@example.com',
        eventName: 'Spring Wedding',
        allowPortalAccess: true,
        allowLodgingAccess: false,
      },
    ] as any);

    vi.mocked(guestPortalHelpers.getPortalGuestsForEvent).mockReturnValue([
      {
        id: 'g1',
        name: 'Jane Guest',
        email: 'jane@example.com',
        eventName: 'Spring Wedding',
        allowPortalAccess: true,
        allowLodgingAccess: false,
      },
    ] as any);

    render(<GuestPortal onExitPortal={() => undefined} />);

    expect(screen.queryAllByRole('button', { name: /lodging/i })).toHaveLength(0);
  });

  it('shows the Lodging tab when the guest has lodging access', () => {
    vi.mocked(guestPortalHelpers.loadGuestPortalSession).mockReturnValue({
      v: 1,
      guestId: 'g1',
      eventKey: 'spring-wedding',
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      portalFingerprint: 'test',
    } as any);

    vi.mocked(guestPortalHelpers.getPortalGuests).mockReturnValue([
      {
        id: 'g1',
        name: 'Jane Guest',
        email: 'jane@example.com',
        eventName: 'Spring Wedding',
        allowPortalAccess: true,
        allowLodgingAccess: true,
      },
    ] as any);

    vi.mocked(guestPortalHelpers.getPortalGuestsForEvent).mockReturnValue([
      {
        id: 'g1',
        name: 'Jane Guest',
        email: 'jane@example.com',
        eventName: 'Spring Wedding',
        allowPortalAccess: true,
        allowLodgingAccess: true,
      },
    ] as any);

    render(<GuestPortal onExitPortal={() => undefined} />);

    expect(screen.getAllByRole('button', { name: /lodging/i }).length).toBeGreaterThan(0);
  });
});