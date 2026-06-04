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
import { verifySecret } from '../utils/auth';

describe('GuestPortal password gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(guestPortalHelpers.getPortalVenues).mockReturnValue([]);
    vi.mocked(guestPortalHelpers.getPortalGuests).mockReturnValue([]);
    vi.mocked(guestPortalHelpers.getPortalRSVPSubmissions).mockReturnValue([]);
    vi.mocked(guestPortalHelpers.getPortalGuestsForEvent).mockReturnValue([]);
    vi.mocked(guestPortalHelpers.getPortalRSVPSubmissionsForEvent).mockReturnValue([]);
    vi.mocked(guestPortalHelpers.loadGuestPortalSession).mockReturnValue(null);
    vi.mocked(guestPortalHelpers.isGuestPortalEventActive).mockReturnValue(true);
  });

  it('allows access with legacy plaintext portalPassword', async () => {
    const user = userEvent.setup();

    const config = {
      eventTitle: 'Spring Wedding',
      eventStartDate: '2026-05-12',
      portalPassword: 'secret123',
      showMap: false,
      showSchedule: false,
      showWayfinding: false,
      showRSVP: false,
      showLodging: false,
    };

    vi.mocked(guestPortalHelpers.getGuestPortalConfig).mockReturnValue(config as any);
    vi.mocked(guestPortalHelpers.findGuestInEvent).mockReturnValue({
      id: 'g1',
      name: 'Jane Guest',
      email: 'jane@example.com',
      token: 'guest-token-1',
      allowPortalAccess: true,
    } as any);

    render(<GuestPortal onExitPortal={() => undefined} />);

    await user.type(screen.getByLabelText(/event name or code/i), 'Spring Wedding');
    await user.type(screen.getByLabelText(/guest email or name/i), 'jane@example.com');
    await user.type(screen.getByLabelText(/portal password/i), 'secret123');
    await user.click(screen.getByRole('button', { name: /access my portal/i }));

    await waitFor(() => {
      expect(guestPortalHelpers.saveGuestPortalSession).toHaveBeenCalledWith(
        config,
        'guest-token-1',
        'Spring Wedding',
        'g1',
      );
    });
  });

  it('allows access with hashed portal password', async () => {
    const user = userEvent.setup();

    const config = {
      eventTitle: 'Spring Wedding',
      eventStartDate: '2026-05-12',
      portalPasswordHash: 'hash123',
      portalPasswordSalt: 'salt123',
      showMap: false,
      showSchedule: false,
      showWayfinding: false,
      showRSVP: false,
      showLodging: false,
    };

    vi.mocked(guestPortalHelpers.getGuestPortalConfig).mockReturnValue(config as any);
    vi.mocked(guestPortalHelpers.findGuestInEvent).mockReturnValue({
      id: 'g1',
      name: 'Jane Guest',
      email: 'jane@example.com',
      token: 'guest-token-1',
      allowPortalAccess: true,
    } as any);
    vi.mocked(verifySecret).mockResolvedValue(true as any);

    render(<GuestPortal onExitPortal={() => undefined} />);

    await user.type(screen.getByLabelText(/event name or code/i), 'Spring Wedding');
    await user.type(screen.getByLabelText(/guest email or name/i), 'jane@example.com');
    await user.type(screen.getByLabelText(/portal password/i), 'secret123');
    await user.click(screen.getByRole('button', { name: /access my portal/i }));

    await waitFor(() => {
      expect(verifySecret).toHaveBeenCalledWith('secret123', {
        hash: 'hash123',
        salt: 'salt123',
      });
    });

    expect(guestPortalHelpers.saveGuestPortalSession).toHaveBeenCalledWith(
      config,
      'guest-token-1',
      'Spring Wedding',
      'g1',
    );
  });

  it('shows an error for invalid hashed portal password', async () => {
    const user = userEvent.setup();

    const config = {
      eventTitle: 'Spring Wedding',
      eventStartDate: '2026-05-12',
      portalPasswordHash: 'hash123',
      portalPasswordSalt: 'salt123',
      showMap: false,
      showSchedule: false,
      showWayfinding: false,
      showRSVP: false,
      showLodging: false,
    };

    vi.mocked(guestPortalHelpers.getGuestPortalConfig).mockReturnValue(config as any);
    vi.mocked(guestPortalHelpers.findGuestInEvent).mockReturnValue({
      id: 'g1',
      name: 'Jane Guest',
      email: 'jane@example.com',
      token: 'guest-token-1',
      allowPortalAccess: true,
    } as any);
    vi.mocked(verifySecret).mockResolvedValue(false as any);

    render(<GuestPortal onExitPortal={() => undefined} />);

    await user.type(screen.getByLabelText(/event name or code/i), 'Spring Wedding');
    await user.type(screen.getByLabelText(/guest email or name/i), 'jane@example.com');
    await user.type(screen.getByLabelText(/portal password/i), 'wrong-password');
    await user.click(screen.getByRole('button', { name: /access my portal/i }));

    expect(
      await screen.findByText(/incorrect password\. please try again\./i),
    ).toBeInTheDocument();
  });

  it('shows an event unavailable banner when the event has ended', () => {
    const config = {
      eventTitle: 'Spring Wedding',
      eventStartDate: '2026-05-12',
      eventEndDate: '2026-05-13',
      showMap: false,
      showSchedule: false,
      showWayfinding: false,
      showRSVP: false,
      showLodging: false,
    };

    vi.mocked(guestPortalHelpers.getGuestPortalConfig).mockReturnValue(config as any);
    vi.mocked(guestPortalHelpers.isGuestPortalEventActive).mockReturnValue(false);

    render(<GuestPortal onExitPortal={() => undefined} />);

    // The sign-in gate now renders first with an inline "access closed" banner.
    expect(
      screen.getByText(/guest access has closed/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/contact the venue coordinator/i),
    ).toBeInTheDocument();
  });
});