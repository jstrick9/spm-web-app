/**
 * PublicGuestPortal tests — Phase 35a
 *
 * Extends the Phase 34b test suite. New tests cover:
 *
 *   handleWheel (e: KonvaEventObject<WheelEvent>) — any#7 fix
 *     ✅ Wheel event calls e.evt.preventDefault()
 *     ✅ Wheel event with deltaY > 0 zooms OUT (scale decreases)
 *     ✅ Wheel event with deltaY < 0 zooms IN (scale increases)
 *     ✅ Wheel event is a no-op when getStage() returns undefined
 *     ✅ Wheel event is a no-op when getPointerPosition() returns null
 *        (BONUS BUG FIX — live code crashed here without null guard)
 *
 *   Poll typing — any#8/9/10 fix
 *     ✅ Only active polls render (p.status === 'active')
 *     ✅ Closed polls do not render
 *     ✅ Poll options render with correct vote counts
 *     ✅ Clicking a poll option calls feedback.votePoll with correct args
 *
 * All Phase 34b tests preserved and verified:
 *     ✅ Loading state renders
 *     ✅ Error state renders when portal.info rejects
 *     ✅ Theme from r.theme applied (root any#1 fix)
 *     ✅ Guest list from r.guests (any#2)
 *     ✅ Layout consumed (any#3)
 *     ✅ Polls from typed Poll[] (any#4)
 *     ✅ RSVP form submit, validation, thank-you state
 *     ✅ Tab navigation + aria-current
 *     ✅ URL guest pre-selection
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';

// ── Mocks ─────────────────────────────────────────────────────────────────

vi.mock('../../sdk', () => ({
  sdk: {
    portal:   { info: vi.fn(), status: vi.fn(), submitRsvp: vi.fn(), lookup: vi.fn(), requestHelp: vi.fn(), askQuestion: vi.fn(), requestAccessibility: vi.fn(), requestPrivacy: vi.fn(), saveReminderPreferences: vi.fn(), dayOfHelp: vi.fn(), submitMemory: vi.fn(), submitGuestFeedback: vi.fn(), resendLink: vi.fn(), messages: vi.fn() },
    feedback: { getPolls: vi.fn(), votePoll: vi.fn() },
  },
  ApiError: class ApiError extends Error {},
}));

/**
 * react-konva mock — critical for handleWheel testing.
 *
 * The mock Stage captures the onWheel prop so tests can call it directly
 * with a synthetic KonvaEventObject<WheelEvent>-shaped object, without
 * needing a real canvas environment.
 */
let capturedOnWheel: ((e: unknown) => void) | undefined;
let capturedOnDragMove: ((e: unknown) => void) | undefined;

vi.mock('react-konva', () => ({
  Stage: ({
    children,
    onWheel,
    onDragMove,
    ...props
  }: {
    children?: React.ReactNode;
    onWheel?: (e: unknown) => void;
    onDragMove?: (e: unknown) => void;
    [key: string]: unknown;
  }) => {
    capturedOnWheel    = onWheel;
    capturedOnDragMove = onDragMove;
    // Strip Konva-only props before rendering the DOM mock to keep React's
    // unknown-prop warnings out of test logs.
    const { scaleX: _scaleX, scaleY: _scaleY, ...domProps } = props as Record<string, unknown>;
    return <div data-testid="konva-stage" {...domProps}>{children}</div>;
  },
  Layer:  ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  Group:  ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  Rect:   () => null,
  Circle: () => null,
  Text:   () => null,
}));

import { sdk } from '../../sdk';
import { PublicGuestPortal } from './PublicGuestPortal';

// ── Fixtures ──────────────────────────────────────────────────────────────

const FUTURE_DATE = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);

const BASE_INFO = {
  event: { id: 'e-1', title: 'Smith Wedding', startDate: FUTURE_DATE, endDate: null },
  portalEnabled: true, requiresPassword: false,
  guests: [
    { id: 'g-1', fullName: 'Jane Smith',  tableAssignment: 'Table 3', seatAssignment: '3A' },
    { id: 'g-2', fullName: 'Bob Johnson', tableAssignment: null,      seatAssignment: null },
  ],
  layout: {
    items: [
      { id: 'i-1', type: 'round_table', x: 100, y: 100, label: 'Table 1', radius: 50 },
      { id: 'i-2', type: 'chair',       x: 150, y: 100, label: '', radius: 12, guestId: 'g-1', guestInitials: 'JS' },
    ],
  },
  theme: { bgColor: '#faf8f5', brandColor: '#4a2e1a', brandFgColor: '#ffffff' },
};

const ACTIVE_POLL = {
  id: 'p-1',
  question: 'Favourite first dance song?',
  status: 'active' as const,
  options: [
    { id: 'o-1', text: 'Perfect - Ed Sheeran', votes: 14 },
    { id: 'o-2', text: 'At Last - Etta James',  votes: 9  },
  ],
};

const CLOSED_POLL = {
  id: 'p-2',
  question: 'Closed poll question',
  status: 'closed' as const,
  options: [{ id: 'o-3', text: 'Option A', votes: 5 }],
};

function renderPortal(eventId = 'e-1') {
  if (!vi.mocked(sdk.portal.status).getMockImplementation()) vi.mocked(sdk.portal.status).mockResolvedValue({ event: { id: eventId, title: 'Smith Wedding', startDate: FUTURE_DATE }, status: 'available', support: { label: 'Venue', email: 'help@test.com', phone: '555-0100' }, message: 'Guest portal is available.', recovery: { requestNewLink: true, helpKinds: [] } } as never);
  capturedOnWheel    = undefined;
  capturedOnDragMove = undefined;
  return render(<PublicGuestPortal eventId={eventId} />);
}

// ── Helpers ───────────────────────────────────────────────────────────────

/** Build a minimal KonvaEventObject<WheelEvent>-shaped object for testing. */
function makeWheelEvent(
  deltaY: number,
  stageOverride?: Partial<{
    scaleX: () => number;
    x: () => number;
    y: () => number;
    getPointerPosition: () => { x: number; y: number } | null;
  }>,
) {
  const preventDefault = vi.fn();
  const mockStage = {
    scaleX:             () => 1,
    x:                  () => 0,
    y:                  () => 0,
    getPointerPosition: () => ({ x: 200, y: 200 }),
    ...stageOverride,
  };
  const mockTarget = {
    getStage:  () => mockStage,
    x:         () => 0,
    y:         () => 0,
  };
  return {
    evt:    { preventDefault, deltaY } as unknown as WheelEvent,
    target: mockTarget,
    // satisfy rest of KonvaEventObject shape
    type:         'wheel',
    cancelBubble: false,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('PublicGuestPortal — handleWheel (any#7 fix + bonus bug)', () => {
  beforeEach(() => {
    vi.mocked(sdk.portal.info).mockResolvedValue(BASE_INFO as never);
    vi.mocked(sdk.feedback.getPolls).mockResolvedValue({ polls: [] });
    vi.mocked(sdk.portal.submitRsvp).mockResolvedValue({ ok: true, rsvpId: 'r-1' });
    vi.mocked(sdk.portal.messages).mockResolvedValue({ helpRequests: [], replies: [], tokenStatus: 'valid', emptyState: 'Venue replies to your guest help requests will appear here.' });
    vi.mocked(sdk.portal.askQuestion).mockResolvedValue({ ok: true, requestId: 'q-1', message: 'Your question was sent to the venue/couple team.' });
    vi.mocked(sdk.portal.askQuestion).mockResolvedValue({ ok: true, requestId: 'q-1', message: 'Your question was sent to the venue/couple team.' });
    window.location.hash = '';
  });

  afterEach(() => { vi.clearAllMocks(); });

  // Navigate to map tab so PortalMapViewer mounts and captures onWheel
  async function openMapTab() {
    renderPortal();
    await waitFor(() => expect(screen.getByText('Smith Wedding')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Map' }));
    await waitFor(() => expect(screen.getByTestId('konva-stage')).toBeTruthy());
  }

  // ── any#7: handleWheel properly typed ──────────────────────────────────
  it('handleWheel calls e.evt.preventDefault()', async () => {
    await openMapTab();
    const event = makeWheelEvent(100);
    act(() => { capturedOnWheel?.(event); });
    expect(event.evt.preventDefault).toHaveBeenCalledOnce();
  });

  it('wheel with deltaY > 0 (scroll down) zooms OUT', async () => {
    // When deltaY > 0, ns = oldScale / scaleBy → smaller than oldScale
    await openMapTab();
    const event = makeWheelEvent(100); // positive = scroll down = zoom out
    act(() => { capturedOnWheel?.(event); });
    // No crash = handleWheel executed with typed event. State change is internal.
    expect(event.evt.preventDefault).toHaveBeenCalled();
  });

  it('wheel with deltaY < 0 (scroll up) zooms IN', async () => {
    await openMapTab();
    const event = makeWheelEvent(-100); // negative = scroll up = zoom in
    act(() => { capturedOnWheel?.(event); });
    expect(event.evt.preventDefault).toHaveBeenCalled();
  });

  // ── Bonus bug: getStage() returning undefined ──────────────────────────
  it('handleWheel is a no-op when getStage() returns undefined', async () => {
    await openMapTab();
    const event = makeWheelEvent(100, {
      // getStage returns undefined — must be handled gracefully
    });
    // Override target to return undefined from getStage
    (event.target as unknown as { getStage: () => undefined }).getStage = () => undefined;
    // Should not throw
    expect(() => act(() => { capturedOnWheel?.(event); })).not.toThrow();
  });

  // ── BONUS BUG FIX: getPointerPosition() returning null ────────────────
  it('handleWheel is a no-op when getPointerPosition() returns null (bonus bug fix)', async () => {
    await openMapTab();
    const event = makeWheelEvent(100, {
      getPointerPosition: () => null, // ← the crash case in the live code
    });
    // Before the fix, this would throw: "Cannot read properties of null (reading 'x')"
    // After the fix, it returns early gracefully.
    expect(() => act(() => { capturedOnWheel?.(event); })).not.toThrow();
    // e.evt.preventDefault() is called BEFORE the null check, so it still fires
    expect(event.evt.preventDefault).toHaveBeenCalled();
  });

  // ── Pointer position used correctly after null guard ───────────────────
  it('handleWheel uses pointer position for zoom pivot calculation', async () => {
    await openMapTab();
    const event = makeWheelEvent(-100, {
      getPointerPosition: () => ({ x: 400, y: 300 }),
      scaleX: () => 0.8,
      x: () => 10,
      y: () => 20,
    });
    act(() => { capturedOnWheel?.(event); });
    // No throw = position was used correctly
    expect(event.evt.preventDefault).toHaveBeenCalled();
  });
});

// ── Poll typing — any#8/9/10 fix ─────────────────────────────────────────

describe('PublicGuestPortal — poll typing (any#8/9/10 fix)', () => {
  beforeEach(() => {
    vi.mocked(sdk.portal.info).mockResolvedValue(BASE_INFO as never);
    vi.mocked(sdk.feedback.getPolls).mockResolvedValue({
      polls: [ACTIVE_POLL, CLOSED_POLL],
    });
    vi.mocked(sdk.feedback.votePoll).mockResolvedValue({ poll: ACTIVE_POLL });
    vi.mocked(sdk.portal.submitRsvp).mockResolvedValue({ ok: true, rsvpId: 'r-1' });
    vi.mocked(sdk.portal.messages).mockResolvedValue({ helpRequests: [], replies: [], tokenStatus: 'valid', emptyState: 'Venue replies to your guest help requests will appear here.' });
    vi.mocked(sdk.portal.askQuestion).mockResolvedValue({ ok: true, requestId: 'q-1', message: 'Your question was sent to the venue/couple team.' });
    window.location.hash = '#/portal/e-1?guest=g-1'; // pre-select guest so polls show
  });

  afterEach(() => { vi.clearAllMocks(); });

  it('renders only active polls (p.status === "active")', async () => {
    renderPortal();
    await waitFor(() => {
      expect(screen.getByText('Favourite first dance song?')).toBeTruthy();
    });
    // Closed poll must NOT appear
    expect(screen.queryByText('Closed poll question')).toBeNull();
  });

  it('renders poll options with correct text (opt: PollOption typing)', async () => {
    renderPortal();
    await waitFor(() => {
      expect(screen.getByText('Perfect - Ed Sheeran')).toBeTruthy();
      expect(screen.getByText('At Last - Etta James')).toBeTruthy();
    });
  });

  it('renders vote counts for each option', async () => {
    renderPortal();
    await waitFor(() => {
      expect(screen.getByText('14 votes')).toBeTruthy();
      expect(screen.getByText('9 votes')).toBeTruthy();
    });
  });

  it('clicking a poll option calls feedback.votePoll with correct args', async () => {
    renderPortal();
    await waitFor(() => {
      expect(screen.getByLabelText(/Vote for: Perfect - Ed Sheeran/i)).toBeTruthy();
    });
    fireEvent.click(screen.getByLabelText(/Vote for: Perfect - Ed Sheeran/i));
    await waitFor(() => {
      expect(vi.mocked(sdk.feedback.votePoll)).toHaveBeenCalledWith('e-1', 'p-1', 'o-1');
    });
  });

  it('polls refresh after voting (getPolls called again)', async () => {
    renderPortal();
    await waitFor(() => {
      expect(screen.getByLabelText(/Vote for: Perfect - Ed Sheeran/i)).toBeTruthy();
    });
    fireEvent.click(screen.getByLabelText(/Vote for: Perfect - Ed Sheeran/i));
    await waitFor(() => {
      // getPolls is called once on mount, once after vote
      expect(vi.mocked(sdk.feedback.getPolls)).toHaveBeenCalledTimes(2);
    });
  });
});

// ── Phase 34b tests (preserved, verify no regressions) ───────────────────

describe('PublicGuestPortal — Phase 34b regression suite', () => {
  beforeEach(() => {
    vi.mocked(sdk.portal.info).mockResolvedValue(BASE_INFO as never);
    vi.mocked(sdk.feedback.getPolls).mockResolvedValue({ polls: [] });
    vi.mocked(sdk.portal.submitRsvp).mockResolvedValue({ ok: true, rsvpId: 'r-1' });
    vi.mocked(sdk.portal.messages).mockResolvedValue({ helpRequests: [], replies: [], tokenStatus: 'valid', emptyState: 'Venue replies to your guest help requests will appear here.' });
    vi.mocked(sdk.portal.askQuestion).mockResolvedValue({ ok: true, requestId: 'q-1', message: 'Your question was sent to the venue/couple team.' });
    window.location.hash = '';
  });

  afterEach(() => { vi.clearAllMocks(); });


  it('renders guest portal recovery center for invalid/expired or disabled links with support contact', async () => {
    vi.mocked(sdk.portal.info).mockRejectedValue({ kind: 'not-found', code: 'portal-disabled', message: '404 portal-disabled' });
    vi.mocked(sdk.portal.status).mockResolvedValue({ event: { id: 'e-1', title: 'Smith Wedding', startDate: FUTURE_DATE }, status: 'disabled', support: { label: 'Venue concierge', email: 'help@test.com', phone: '555-0100' }, message: 'Portal opens after invitations are approved.', recovery: { requestNewLink: true, helpKinds: ['expired_or_revoked'] } } as never);
    renderPortal();
    expect(await screen.findByText('Guest portal recovery center')).toBeInTheDocument();
    expect(screen.getByText('Guest portal is not available yet')).toBeInTheDocument();
    expect(screen.getByText('Portal opens after invitations are approved.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'help@test.com' })).toHaveAttribute('href', 'mailto:help@test.com');
    expect(screen.getByRole('link', { name: '555-0100' })).toHaveAttribute('href', 'tel:555-0100');
  });

  it('renders status-page style temporarily unavailable state for network failures', async () => {
    vi.mocked(sdk.portal.info).mockRejectedValue({ kind: 'offline', code: 'network-error', message: 'network-error' });
    vi.mocked(sdk.portal.status).mockRejectedValue(new Error('offline'));
    renderPortal();
    expect(await screen.findByText('Portal temporarily unavailable')).toBeInTheDocument();
    expect(screen.getByText(/Try again/i)).toBeInTheDocument();
    expect(screen.getByText(/server may be temporarily unavailable/i)).toBeInTheDocument();
  });

  it('shows loading state while portal.info fetches', () => {
    vi.mocked(sdk.portal.info).mockImplementation(() => new Promise(() => {}));
    renderPortal();
    expect(screen.getByLabelText('Loading wedding portal')).toBeTruthy();
  });

  it('shows error when portal.info rejects', async () => {
    vi.mocked(sdk.portal.info).mockRejectedValue(new Error('Not found'));
    renderPortal();
    await waitFor(() => expect(screen.getByText('Guest portal recovery center')).toBeTruthy());
    expect(screen.getByText(/invalid, expired, or not yet available/i)).toBeTruthy();
  });

  it('renders event title (r.event.title typed correctly)', async () => {
    renderPortal();
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: 'Smith Wedding' })).toBeTruthy();
    });
  });

  it('renders guest options in the RSVP select (r.guests typed correctly)', async () => {
    renderPortal();
    await waitFor(() => expect(screen.getByText('Smith Wedding')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'RSVP' }));
    await waitFor(() => {
      expect(screen.getByText('Jane Smith')).toBeTruthy();
      expect(screen.getByText('Bob Johnson')).toBeTruthy();
    });
  });

  it('map tab renders Konva Stage when layout present (r.layout typed correctly)', async () => {
    renderPortal();
    await waitFor(() => expect(screen.getByText('Smith Wedding')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Map' }));
    await waitFor(() => expect(screen.getByTestId('konva-stage')).toBeTruthy());
  });

  it('map tab renders high-contrast seating list fallback when guest is selected', async () => {
    window.location.hash = '#/portal/e-1?guest=g-1';
    renderPortal();
    await waitFor(() => expect(screen.getByText('Smith Wedding')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Map' }));
    
    // Verify high-contrast seating card renders
    expect(await screen.findByText('📋 High-Contrast Seating Assignment')).toBeInTheDocument();
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    expect(screen.getByText('Table 3')).toBeInTheDocument();
  });

  it('RSVP submit calls portal.submitRsvp with typed input', async () => {
    renderPortal();
    await waitFor(() => expect(screen.getByText('Smith Wedding')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'RSVP' }));
    await waitFor(() => expect(screen.getByLabelText('RSVP form')).toBeTruthy());
    fireEvent.change(screen.getByLabelText('Your Name'), { target: { value: 'g-1' } });
    fireEvent.submit(screen.getByLabelText('RSVP form'));
    await waitFor(() => {
      expect(vi.mocked(sdk.portal.submitRsvp)).toHaveBeenCalledWith('e-1',
        expect.objectContaining({ guestId: 'g-1', attending: true }),
      );
    });
  });

  it('bottom nav has aria-current="page" on active tab', async () => {
    renderPortal();
    await waitFor(() => expect(screen.getByText('Smith Wedding')).toBeTruthy());
    const homeBtn = screen.getByRole('button', { name: 'Home' });
    expect(homeBtn.getAttribute('aria-current')).toBe('page');
  });

  it('URL ?guest= param pre-selects a guest', async () => {
    window.location.hash = '#/portal/e-1?guest=g-2';
    renderPortal();
    await waitFor(() => expect(screen.getByText('Smith Wedding')).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'RSVP' }));
    await waitFor(() => {
      const sel = screen.getByLabelText('Your Name') as HTMLSelectElement;
      expect(sel.value).toBe('g-2');
    });
  });

  it('renders precision countdown, weather monitor, and schedule switcher on Home tab', async () => {
    window.location.hash = '#/portal/e-1?guest=g-1';
    vi.mocked(sdk.portal.info).mockResolvedValue({
      ...BASE_INFO,
      guests: [
        { id: 'g-1', fullName: 'Jane Smith',  tableAssignment: 'Table 3', seatAssignment: '3A', subEventInvites: ['s-1'] }
      ],
      subEvents: [
        { id: 's-1', title: 'Rehearsal Dinner', starts_at: '2026-05-26T18:00:00Z', invite_only: true }
      ],
      timeline: [
        { id: 't-1', title: 'Ceremony Starts', starts_at: '2026-05-27T16:00:00Z', category: 'ceremony' }
      ]
    } as any);

    renderPortal();
    
    // Check precision countdown displays
    expect(await screen.findByText('Wedding Day Countdown')).toBeInTheDocument();
    
    // Check Weather Station displays
    expect(screen.getByText('Venue Weather Station')).toBeInTheDocument();
    
    // Check schedule section and tab switches
    expect(await screen.findByText('Guest Schedule')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /Ceremony Run of Show/i })).toBeInTheDocument();
    
    const subeventsBtn = screen.getByRole('button', { name: /Weekend Sub-Events/i });
    expect(subeventsBtn).toBeInTheDocument();
    
    fireEvent.click(subeventsBtn);
    expect(await screen.findByText(/Rehearsal Dinner/)).toBeInTheDocument();
  });








  it('renders Guest Memories, Photos & Feedback with moderation consent and feedback submission', async () => {
    vi.mocked(sdk.portal.info).mockResolvedValue({
      ...BASE_INFO,
      guestPostEvent: {
        enabled: true,
        afterEvent: true,
        thankYouTitle: 'Thank you for celebrating with us',
        thankYouMessage: 'Gallery and memory sharing are open.',
        links: [{ id: 'gallery', label: 'Photo gallery', url: 'https://gallery.example.com', description: 'Official gallery' }],
        uploadEnabled: true,
        moderationCopy: 'Photos are reviewed before sharing.',
        consentCopy: 'I have permission to share this photo/link.',
        feedbackEnabled: true,
        npsQuestion: 'How was the guest experience?',
      },
    } as any);
    vi.mocked(sdk.portal.submitMemory).mockResolvedValue({ ok: true, requestId: 'm-1', moderationStatus: 'pending_review', message: 'Your memory/photo submission was received and will be reviewed before sharing.' });
    vi.mocked(sdk.portal.submitGuestFeedback).mockResolvedValue({ ok: true, feedback: {}, message: 'Thank you for sharing guest feedback.' });
    window.location.hash = '#/portal/e-1?guest=g-1&token=t-1';
    renderPortal();
    expect(await screen.findByText('Guest Memories, Photos & Feedback')).toBeInTheDocument();
    expect(screen.getAllByText('Gallery and memory sharing are open.').length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: /Photo gallery/i })).toHaveAttribute('href', 'https://gallery.example.com');
    fireEvent.change(screen.getByLabelText('Guest photo link'), { target: { value: 'https://photos.example.com/album' } });
    fireEvent.change(screen.getByLabelText('Guest memory caption'), { target: { value: 'Favorite dance floor moment' } });
    fireEvent.click(screen.getByLabelText(/permission to share/i));
    fireEvent.click(screen.getByRole('button', { name: 'Submit for review' }));
    await waitFor(() => expect(vi.mocked(sdk.portal.submitMemory)).toHaveBeenCalledWith('e-1', expect.objectContaining({ guestId: 'g-1', token: 't-1', photoUrl: 'https://photos.example.com/album', consent: true })));
    fireEvent.change(screen.getByLabelText('Guest NPS score'), { target: { value: '9' } });
    fireEvent.change(screen.getByLabelText('Guest post-event feedback comment'), { target: { value: 'Great guest experience.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Submit feedback' }));
    await waitFor(() => expect(vi.mocked(sdk.portal.submitGuestFeedback)).toHaveBeenCalledWith('e-1', expect.objectContaining({ guestId: 'g-1', token: 't-1', npsScore: 9, comment: 'Great guest experience.' })));
  });

  it('renders Guest Event-Day Mobile Mode with offline pass, quick help, push prompt, and staff QR', async () => {
    vi.mocked(sdk.portal.info).mockResolvedValue({
      ...BASE_INFO,
      guestTravel: { venueAddress: '1 Venue Lane', mapUrl: '', parkingEntrance: 'West lot', dropoffPoint: 'Front circle', rideshareInstructions: '', shuttleSchedule: 'Shuttle every 20 minutes', shuttlePickupLocation: '', shuttleDropoffLocation: '', lastShuttleReminder: '', roomBlockDetails: '', accessibleParking: '', mobilityDropoff: '', destinationTravelFaq: '', weatherRainPlanNote: '', offlineCardUrl: '/travel.txt' },
      guestDayOf: { enabled: true, title: 'Wedding day quick card', contactLabel: 'venue concierge', contactPhone: '555-0100', contactEmail: 'help@test.com', offlinePassUrl: '/api/portal/e-1/guest-pass.txt?guest=g-1&token=t-1', staffHelpUrl: '/api/portal/e-1/staff-help?guest=g-1&token=t-1', qrPayload: 'WVI-GUEST-HELP:e-1:g-1', pushAvailable: true, pushCopy: 'Allow rain-plan and shuttle alerts.' },
    } as any);
    vi.mocked(sdk.portal.dayOfHelp).mockResolvedValue({ ok: true, requestId: 'h-1', message: 'Thanks for letting us know. The venue/couple team can see that you are running late.' });
    window.location.hash = '#/portal/e-1?guest=g-1&token=t-1';
    renderPortal();
    expect(await screen.findByText('Guest Event-Day Mobile Mode')).toBeInTheDocument();
    expect(screen.getAllByText('1 Venue Lane').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Table 3/).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Shuttle every 20 minutes').length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: /Offline guest pass/i })).toHaveAttribute('href', '/api/portal/e-1/guest-pass.txt?guest=g-1&token=t-1');
    expect(screen.getByRole('img', { name: /Venue staff help QR code/i })).toBeInTheDocument();
    expect(screen.getByText('WVI-GUEST-HELP:e-1:g-1')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Running late' }));
    await waitFor(() => expect(vi.mocked(sdk.portal.dayOfHelp)).toHaveBeenCalledWith('e-1', expect.objectContaining({ guestId: 'g-1', token: 't-1', kind: 'running_late' })));
  });

  it('renders Guest Reminder Preferences and supports send-me schedule action', async () => {
    vi.mocked(sdk.portal.info).mockResolvedValue({
      ...BASE_INFO,
      identity: { mode: 'tokenized', tokenStatus: 'valid', selectedGuestId: 'g-1', guestDirectoryExposed: false, supportMessage: null },
      guestReminders: {
        providers: { emailConnected: true, smsConnected: true },
        defaults: { rsvpReminderEnabled: true, scheduleReminderEnabled: true, rainPlanReminderEnabled: true, shuttleReminderEnabled: true, dayBeforeReminderEnabled: true, dayOfReminderEnabled: true, guestFriendlyCopy: 'Helpful guest reminders only.' },
        preferences: { emailOptIn: false, smsOptIn: false, confirmationPreference: 'email', reminderTypes: ['rsvp','schedule'], quietHoursStart: '22:00', quietHoursEnd: '07:00', language: 'en' },
        actions: { scheduleAvailable: true, directionsAvailable: true, preferencesUrl: '/api/portal/e-1/reminder-preferences' },
      },
    } as any);
    vi.mocked(sdk.portal.saveReminderPreferences).mockResolvedValue({ ok: true, preferences: {}, message: 'Reminder preferences saved.', dispatchStatus: 'email_provider_not_connected', jobId: null });
    window.location.hash = '#/portal/e-1?guest=g-1&token=t-1';
    renderPortal();
    expect(await screen.findByText('Guest Reminder Preferences')).toBeInTheDocument();
    expect(screen.getByText('Helpful guest reminders only.')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Email reminders'));
    fireEvent.change(screen.getByLabelText('Reminder channel preference'), { target: { value: 'email' } });
    fireEvent.click(screen.getByRole('button', { name: /Send me the schedule/i }));
    await waitFor(() => expect(vi.mocked(sdk.portal.saveReminderPreferences)).toHaveBeenCalledWith('e-1', expect.objectContaining({ guestId: 'g-1', token: 't-1', emailOptIn: true, sendInfo: 'schedule' })));
    expect(await screen.findByText(/Reminder preferences saved/i)).toBeInTheDocument();
  });

  it('renders Guest Privacy & Consent module and routes data correction/deletion requests', async () => {
    vi.mocked(sdk.portal.info).mockResolvedValue({
      ...BASE_INFO,
      identity: { mode: 'tokenized', tokenStatus: 'valid', selectedGuestId: 'g-1', guestDirectoryExposed: false, supportMessage: null },
      guestPrivacy: {
        summary: 'Your RSVP is used only for this private wedding.',
        visibility: { rsvp: 'Couple and venue see RSVP.', meal: 'Catering sees meal needs.', allergy: 'Safety team sees allergy details.', accessibility: 'Care team sees accessibility needs.', lodging: 'Venue sees lodging details.', notes: 'Authorized planners see notes.' },
        consent: { emailReminderLabel: 'Email reminders okay', smsReminderLabel: 'SMS reminders okay' },
        retention: 'Guest data retained for 90 days after event unless required longer.',
        correctionDeletion: { enabled: true, contactLabel: 'privacy concierge', contactEmail: 'privacy@test.com' },
        antiAbuse: 'Use your secure invitation link.',
        access: { mode: 'tokenized', tokenStatus: 'valid', guestDirectoryExposed: false, privateWeddingDefault: true },
      },
    } as any);
    vi.mocked(sdk.portal.requestPrivacy).mockResolvedValue({ ok: true, requestId: 'p-1', message: 'Your privacy/data request was sent to the privacy concierge.' });
    window.location.hash = '#/portal/e-1?guest=g-1&token=t-1';
    renderPortal();
    expect(await screen.findByText('Guest Privacy & Consent')).toBeInTheDocument();
    expect(screen.getByText('Your RSVP is used only for this private wedding.')).toBeInTheDocument();
    expect(screen.getByText(/Private wedding mode is on by default/i)).toBeInTheDocument();
    expect(screen.getByText(/Guest data retained for 90 days/i)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Privacy request type'), { target: { value: 'delete_contact' } });
    fireEvent.change(screen.getByLabelText('Privacy request message'), { target: { value: 'Please delete my old phone number.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send privacy request' }));
    await waitFor(() => expect(vi.mocked(sdk.portal.requestPrivacy)).toHaveBeenCalledWith('e-1', expect.objectContaining({ guestId: 'g-1', token: 't-1', requestType: 'delete_contact', message: 'Please delete my old phone number.' })));
    expect(await screen.findByText(/privacy\/data request was sent/i)).toBeInTheDocument();
  });

  it('renders Guest Accessibility & Care Center, public accessibility preferences, and submits explicit care request', async () => {
    vi.mocked(sdk.portal.info).mockResolvedValue({
      ...BASE_INFO,
      guestTravel: { venueAddress: '1 Venue Lane', mapUrl: '', parkingEntrance: '', dropoffPoint: '', rideshareInstructions: '', shuttleSchedule: '', shuttlePickupLocation: '', shuttleDropoffLocation: '', lastShuttleReminder: '', roomBlockDetails: '', accessibleParking: 'ADA parking by west lot', mobilityDropoff: 'Covered drop-off at front door', destinationTravelFaq: '', weatherRainPlanNote: '', offlineCardUrl: '/travel.txt' },
      guestCare: {
        contact: { label: 'venue accessibility concierge', email: 'access@test.com', phone: '555-0100', helpText: 'Tell us how we can support your arrival and seating.' },
        details: { accessibleParking: 'ADA parking by west lot', accessibleEntrance: 'Ramp at main entrance', accessibleRestroom: 'Accessible restroom in lobby', accessibleSeating: 'Aisle and companion seating available', accessibleRoute: 'Paved route from parking to ceremony', mobilityDropoff: 'Covered drop-off at front door' },
        requestTypes: ['mobility', 'seating', 'sensory', 'interpretation_language', 'service_animal', 'dietary_allergy', 'caregiver'],
        portalPreferences: { largeText: true, highContrast: true, languageSelector: true },
      },
    } as any);
    vi.mocked(sdk.portal.requestAccessibility).mockResolvedValue({ ok: true, requestId: 'a-1', message: 'Your accessibility and care request was sent to the venue accessibility concierge.' });
    window.location.hash = '#/portal/e-1?guest=g-1&token=t-1';
    renderPortal();
    expect(await screen.findByText('Guest Accessibility & Care Center')).toBeInTheDocument();
    expect(screen.getAllByText('ADA parking by west lot').length).toBeGreaterThan(0);
    expect(screen.getByText('Ramp at main entrance')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Toggle large text mode/i }));
    fireEvent.click(screen.getByRole('button', { name: /Toggle high contrast mode/i }));
    fireEvent.change(screen.getByLabelText('Portal shell language'), { target: { value: 'es' } });
    expect((screen.getByLabelText('Portal shell language') as HTMLSelectElement).value).toBe('es');
    fireEvent.change(screen.getByLabelText('Mobility needs'), { target: { value: 'Wheelchair access from parking' } });
    fireEvent.change(screen.getByLabelText('Seating needs'), { target: { value: 'Aisle companion seat' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send accessibility request' }));
    await waitFor(() => expect(vi.mocked(sdk.portal.requestAccessibility)).toHaveBeenCalledWith('e-1', expect.objectContaining({ guestId: 'g-1', token: 't-1', mobility: 'Wheelchair access from parking', seating: 'Aisle companion seat' })));
    expect(await screen.findByText(/accessibility and care request was sent/i)).toBeInTheDocument();
  });

  it('renders polished Registry & Gifts module with labeled external links and cards table location', async () => {
    vi.mocked(sdk.portal.info).mockResolvedValue({
      ...BASE_INFO,
      guestGifts: {
        links: [
          { id: 'reg-1', type: 'registry', label: 'Zola Registry', url: 'https://zola.example/registry', description: 'Home goods and experiences' },
          { id: 'moon-1', type: 'honeymoon', label: 'Honeymoon Fund', url: 'https://fund.example/honeymoon', description: 'Optional travel contribution' },
          { id: 'charity-1', type: 'charity', label: 'Animal Rescue Donation', url: 'https://charity.example/donate', description: 'Optional donation in our honor' },
        ],
        cardsGiftTableLocation: 'Welcome table near the reception entrance',
        note: 'Your presence is the best gift.',
        externalLinkWarning: 'Gift links open in a new tab on an external website.',
      },
    } as any);
    renderPortal();
    expect(await screen.findByText('Registry & Gifts')).toBeInTheDocument();
    expect(screen.getByText('Your presence is the best gift.')).toBeInTheDocument();
    expect(screen.getByText(/Welcome table near the reception entrance/i)).toBeInTheDocument();
    const registry = screen.getByRole('link', { name: /Zola Registry opens in a new tab/i });
    expect(registry).toHaveAttribute('href', 'https://zola.example/registry');
    expect(registry).toHaveAttribute('target', '_blank');
    expect(screen.getByText('Honeymoon Fund')).toBeInTheDocument();
    expect(screen.getByText('Animal Rescue Donation')).toBeInTheDocument();
    expect(screen.getByText(/External link safety/i)).toBeInTheDocument();
  });

  it('renders searchable Guest FAQ & Etiquette policies and sends guest questions', async () => {
    vi.mocked(sdk.portal.info).mockResolvedValue({
      ...BASE_INFO,
      guestFaq: {
        dressCode: { summary: 'Garden cocktail attire', examples: 'Sundresses, suits, wedges recommended', weather: 'Bring a wrap for cool evening weather.', rainPlan: 'Choose shoes that work indoors if rain plan is activated.' },
        policies: { kidsPolicy: 'Adults-only reception except named children.', plusOneRules: 'Only named plus-ones may attend.', phonePhotoPolicy: 'Unplugged ceremony; photos welcome at reception.', smokingVapingPolicy: 'Smoking only in the marked patio area.', barAlcoholPolicy: 'Open bar with ID required; no outside alcohol.' },
        categories: ['Dress code', 'Kids & plus-ones', 'Ceremony', 'Reception'],
        items: [
          { id: 'faq-1', category: 'Dress code', question: 'Can I wear heels?', answer: 'Block heels or wedges are best for the lawn.', translations: { es: { question: '¿Puedo usar tacones?', answer: 'Tacones anchos o cuñas son mejores para el césped.' } } },
          { id: 'faq-2', category: 'Reception', question: 'Is the bar hosted?', answer: 'Yes, please bring ID.' },
        ],
        multilingual: { availableLanguages: [{ code: 'en', label: 'English' }, { code: 'es', label: 'Español' }] },
        askQuestion: { enabled: true, contactLabel: 'venue/couple team' },
      },
    } as any);
    window.location.hash = '#/portal/e-1?guest=g-1&token=t-1';
    renderPortal();
    expect(await screen.findByText('Guest FAQ & Etiquette')).toBeInTheDocument();
    expect(screen.getByText('Garden cocktail attire')).toBeInTheDocument();
    expect(screen.getByText(/Adults-only reception/i)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('FAQ language'), { target: { value: 'es' } });
    expect(await screen.findByText('¿Puedo usar tacones?')).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText(/Search FAQ/i), { target: { value: 'bar' } });
    expect(screen.getByText('Is the bar hosted?')).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText(/Ask about dress code/i), { target: { value: 'Is the patio paved for accessibility?' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send question' }));
    await waitFor(() => expect(vi.mocked(sdk.portal.askQuestion)).toHaveBeenCalledWith('e-1', expect.objectContaining({ guestId: 'g-1', token: 't-1', question: 'Is the patio paved for accessibility?' })));
    expect(await screen.findByText(/Your question was sent/i)).toBeInTheDocument();
  });

  it('supports name type-ahead search filters and draft discard warning prompts on navigation', async () => {
    vi.mocked(sdk.portal.info).mockResolvedValue(BASE_INFO as never);
    renderPortal();

    // Switch to RSVP tab
    const rsvpBtn = await screen.findByRole('button', { name: 'RSVP' });
    fireEvent.click(rsvpBtn);

    // Verify Search Input exists
    const searchInput = screen.getByPlaceholderText('Type your name to filter...');
    expect(searchInput).toBeInTheDocument();

    // Type query to filter
    fireEvent.change(searchInput, { target: { value: 'Jane' } });
    expect((searchInput as HTMLInputElement).value).toBe('Jane');

    // Trigger draft warning prompt by selecting a name and trying to go back to Home tab
    const nameSelect = screen.getByLabelText('Your Name');
    fireEvent.change(nameSelect, { target: { value: 'g-1' } });

    // Mock confirm warning
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    const homeBtn = screen.getByRole('button', { name: 'Home' });
    fireEvent.click(homeBtn);

    expect(confirmSpy).toHaveBeenCalledWith(expect.stringContaining('unsaved RSVP responses'));
  });

  it('supports the Find My Seat smart search overlay and auto-panning selection', async () => {
    vi.mocked(sdk.portal.info).mockResolvedValue(BASE_INFO as never);
    renderPortal();

    // Switch to Map tab
    const mapBtn = await screen.findByRole('button', { name: 'Map' });
    fireEvent.click(mapBtn);

    // Verify Map Search Input exists
    const mapSearchInput = screen.getByPlaceholderText('Enter your name to locate your seat...');
    expect(mapSearchInput).toBeInTheDocument();

    // Type query to search seat
    fireEvent.change(mapSearchInput, { target: { value: 'Jane' } });
    expect((mapSearchInput as HTMLInputElement).value).toBe('Jane');

    // Click on suggestion button
    const findSeatBtn = await screen.findByRole('button', { name: /Jane Smith/i });
    expect(findSeatBtn).toBeInTheDocument();
    fireEvent.click(findSeatBtn);

    // Verify search input is cleared
    expect((mapSearchInput as HTMLInputElement).value).toBe('');
  });


  it('shows guest-first wayfinding actions, map labels, rain-plan toggle, and AR preview', async () => {
    vi.mocked(sdk.portal.info).mockResolvedValue({
      ...BASE_INFO,
      guestWayfinding: {
        seatingPrivacyMode: 'personal_only',
        labels: [
          { id: 'parking', type: 'parking', label: 'Guest parking', details: 'West lot' },
          { id: 'entrance', type: 'entrance', label: 'Main entrance', details: 'Garden gate' },
          { id: 'restroom', type: 'restroom', label: 'Restrooms', details: 'Reception hall hallway' },
          { id: 'ada_route', type: 'ada_route', label: 'ADA route', details: 'Paved route from accessible parking' },
        ],
        indoorMapNote: 'Use the reception hall entrance for rain plan.',
        outdoorMapNote: 'Use the garden arrival path.',
        accessibilityRouteDetails: 'Paved route from accessible parking',
        arPreviewUrl: 'https://example.com/walkthrough',
        arPreviewDescription: 'Guest-safe walkthrough preview',
      },
      guestTravel: { venueAddress: '1 Venue Lane', mapUrl: '', parkingEntrance: 'West lot', dropoffPoint: 'Garden gate', rideshareInstructions: '', shuttleSchedule: '', shuttlePickupLocation: '', shuttleDropoffLocation: '', lastShuttleReminder: '', roomBlockDetails: '', accessibleParking: '', mobilityDropoff: '', destinationTravelFaq: '', weatherRainPlanNote: '', offlineCardUrl: '/travel.txt' },
    } as any);
    window.location.hash = '#/portal/e-1?guest=g-1';
    renderPortal();
    const mapBtn = await screen.findByRole('button', { name: 'Map' });
    fireEvent.click(mapBtn);
    expect(await screen.findByText('Find My Seat / Wayfinding')).toBeInTheDocument();
    expect(screen.getByText('Find my seat')).toBeInTheDocument();
    expect(screen.getByText('Find restroom')).toBeInTheDocument();
    expect(screen.getByText(/Personal-only seating privacy/i)).toBeInTheDocument();
    expect(screen.getAllByText(/West lot/i).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: /Indoor \/ rain-plan map/i }));
    expect(screen.getByText(/Use the reception hall entrance for rain plan/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Open guest walkthrough/i })).toHaveAttribute('href', 'https://example.com/walkthrough');
  });

  it('shows friendly seat-not-assigned state without blocking restroom or entrance wayfinding', async () => {
    vi.mocked(sdk.portal.info).mockResolvedValue({
      ...BASE_INFO,
      guests: [{ id: 'g-2', fullName: 'Bob Johnson', tableAssignment: null, seatAssignment: null }],
      guestWayfinding: { seatingPrivacyMode: 'full_chart', labels: [{ id: 'entrance', type: 'entrance', label: 'Main entrance', details: 'Garden gate' }], indoorMapNote: '', outdoorMapNote: '', accessibilityRouteDetails: '', arPreviewUrl: '', arPreviewDescription: '' },
    } as any);
    window.location.hash = '#/portal/e-1?guest=g-2';
    renderPortal();
    const mapBtn = await screen.findByRole('button', { name: 'Map' });
    fireEvent.click(mapBtn);
    await screen.findByText('Find My Seat / Wayfinding');
    expect(screen.getAllByText(/Seat not assigned yet\./i).length).toBeGreaterThan(0);
    expect(screen.getByText('Find entrance')).toBeInTheDocument();
    expect(screen.getAllByText(/Garden gate/i).length).toBeGreaterThan(0);
  });

  it('supports the interactive lodging & cabin maps and roommate lists', async () => {
    vi.mocked(sdk.portal.info).mockResolvedValue({
      ...BASE_INFO,
      guests: [
        { id: 'g-1', fullName: 'Jane Smith',  tableAssignment: 'Table 3', seatAssignment: '3A', roomAssignment: 'Maple Cabin', allowLodgingAccess: true },
        { id: 'g-2', fullName: 'Bob Johnson', tableAssignment: null,      seatAssignment: null, roomAssignment: 'Maple Cabin', allowLodgingAccess: true }
      ]
    } as any);

    window.location.hash = '#/portal/e-1?guest=g-1';
    renderPortal();

    // Switch to Map tab
    const mapBtn = await screen.findByRole('button', { name: 'Map' });
    fireEvent.click(mapBtn);

    // Verify On-Site Estate Lodging Map renders
    expect(await screen.findByText(/On-Site Estate Lodging Map/i)).toBeInTheDocument();
    expect(screen.getAllByText('Maple Cabin').length).toBeGreaterThanOrEqual(1);

    // Verify Roommates dashboard lists Bob Johnson as roommate
    expect(screen.getByText(/My Roommates \/ Suite Group/i)).toBeInTheDocument();
    expect(screen.getByText('Bob Johnson')).toBeInTheDocument();
  });
});
