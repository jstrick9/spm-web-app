import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { I18nProvider } from '../../i18n/I18nContext';
import React from 'react';
import { GuestRsvpWizard } from './GuestRsvpWizard';
import { sdk } from '../../sdk';

vi.mock('../../sdk', () => ({
  sdk: { portal: { submitRsvp: vi.fn().mockResolvedValue({ ok: true, rsvpId: 'r-1' }) } },
}));

const PALETTE = {
  bg: '#fff', surface: '#fff', border: '#ddd', fg: '#222', fgMuted: '#666',
  fgSubtle: '#888', primary: '#4a1942', primaryFg: '#fff', primaryHover: '#3a0f34',
  accent: '#c9a560', accentSoft: '#f5edda',
};

const GUESTS = [
  { id: 'g-1', fullName: 'Jane Smith', tableAssignment: null, seatAssignment: null, roomAssignment: null },
] as any;

function renderWizard(overrides: Record<string, unknown> = {}) {
  return render(
    <I18nProvider><GuestRsvpWizard
      eventId="e-1"
      info={{ id: 'e-1', title: 'Smith Wedding', startDate: '2026-09-12', endDate: null } as any}
      guests={GUESTS}
      subEvents={[]}
      palette={PALETTE as any}
      selectedGuestId="g-1"
      setSelectedGuestId={() => {}}
      guestToken="tok"
      config={{}}
      guestPrivacy={null}
      onReturnHome={() => {}}
      onFindSeat={() => {}}
      {...overrides}
    /></I18nProvider>,
  );
}

async function walkToReview() {
  // identify → attendance (guest preselected by id)
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
  // attendance → party (attending preselected)
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
  // party → meal
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
  // meal → review
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
  await screen.findByText('Review before submitting');
}

describe('GuestRsvpWizard — late-submission receipt', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('shows the RSVP-saved receipt WITHOUT a late notice when on time', async () => {
    vi.mocked(sdk.portal.submitRsvp).mockResolvedValue({ ok: true, rsvpId: 'r-1' } as never);
    renderWizard();
    await walkToReview();
    fireEvent.click(screen.getByText(/i understand who can see my rsvp/i));
    fireEvent.click(screen.getByRole('button', { name: 'Submit RSVP' }));
    await screen.findByText('RSVP saved');
    expect(screen.queryByText(/submitted after the rsvp deadline/i)).not.toBeInTheDocument();
  });

  it('warns the guest when the server flags their submission as after the deadline', async () => {
    vi.mocked(sdk.portal.submitRsvp).mockResolvedValue({ ok: true, rsvpId: 'r-1', lateSubmission: true } as never);
    renderWizard();
    await walkToReview();
    fireEvent.click(screen.getByText(/i understand who can see my rsvp/i));
    fireEvent.click(screen.getByRole('button', { name: 'Submit RSVP' }));
    await screen.findByText('RSVP saved');
    expect(screen.getByText(/submitted after the rsvp deadline/i)).toBeInTheDocument();
    expect(screen.getByText(/may already be finalizing catering and seating/i)).toBeInTheDocument();
    // the server was told the truth about late-ness
    await waitFor(() => {
      expect(sdk.portal.submitRsvp).toHaveBeenCalledWith(
        'e-1',
        expect.objectContaining({ guestId: 'g-1' }),
      );
    });
  });
});
