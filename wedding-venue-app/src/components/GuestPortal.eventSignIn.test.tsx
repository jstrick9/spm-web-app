import { render, screen } from '@testing-library/react';
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

describe('GuestPortal event-scoped sign-in', () => {
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

    vi.mocked(guestPortalHelpers.getPortalVenues).mockReturnValue([]);
    vi.mocked(guestPortalHelpers.getPortalGuests).mockReturnValue([]);
    vi.mocked(guestPortalHelpers.getPortalGuestsForEvent).mockReturnValue([]);
    vi.mocked(guestPortalHelpers.getPortalRSVPSubmissions).mockReturnValue([]);
    vi.mocked(guestPortalHelpers.getPortalRSVPSubmissionsForEvent).mockReturnValue([]);
    vi.mocked(guestPortalHelpers.loadGuestPortalSession).mockReturnValue(null);
    vi.mocked(guestPortalHelpers.isGuestPortalEventActive).mockReturnValue(true);
  });

  it('renders the event-scoped guest sign-in fields', () => {
    render(<GuestPortal onExitPortal={() => undefined} />);

    expect(screen.getByLabelText(/event name or code/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/guest email or name/i)).toBeInTheDocument();
    expect(
      screen.getByText(
        /enter your event name and the email or name your venue has on file/i,
      ),
    ).toBeInTheDocument();
  });

  it('shows an error when the event name does not match the configured event', async () => {
    const user = userEvent.setup();

    render(<GuestPortal onExitPortal={() => undefined} />);

    await user.type(screen.getByLabelText(/event name or code/i), 'Wrong Wedding');
    await user.type(screen.getByLabelText(/guest email or name/i), 'jane@example.com');
    await user.click(screen.getByRole('button', { name: /access my portal/i }));

    expect(
      await screen.findByText(/event not found or not available/i),
    ).toBeInTheDocument();
  });

  it('shows an error when the guest is not found for the correct event', async () => {
    const user = userEvent.setup();

    vi.mocked(guestPortalHelpers.findGuestInEvent).mockReturnValue(undefined);

    render(<GuestPortal onExitPortal={() => undefined} />);

    await user.type(screen.getByLabelText(/event name or code/i), 'Spring Wedding');
    await user.type(screen.getByLabelText(/guest email or name/i), 'unknown@example.com');
    await user.click(screen.getByRole('button', { name: /access my portal/i }));

    expect(
      await screen.findByText(/guest not found for this event/i),
    ).toBeInTheDocument();
  });

  it('distinguishes between a wrong event and an unknown guest', async () => {
    const user = userEvent.setup();

    vi.mocked(guestPortalHelpers.findGuestInEvent).mockReturnValue(undefined);

    render(<GuestPortal onExitPortal={() => undefined} />);

    // Wrong event → event error
    await user.type(screen.getByLabelText(/event name or code/i), 'Wrong Wedding');
    await user.type(screen.getByLabelText(/guest email or name/i), 'unknown@example.com');
    await user.click(screen.getByRole('button', { name: /access my portal/i }));

    expect(
      await screen.findByText(/event not found or not available/i),
    ).toBeInTheDocument();

    // Correct event but wrong guest → guest error
    await user.clear(screen.getByLabelText(/event name or code/i));
    await user.type(screen.getByLabelText(/event name or code/i), 'Spring Wedding');
    await user.click(screen.getByRole('button', { name: /access my portal/i }));

    expect(
      await screen.findByText(/guest not found for this event/i),
    ).toBeInTheDocument();
  });
});