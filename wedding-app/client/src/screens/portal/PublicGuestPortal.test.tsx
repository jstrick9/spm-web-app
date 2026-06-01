import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { PublicGuestPortal } from './PublicGuestPortal';

// Mock react-konva since it needs canvas
vi.mock('react-konva', () => ({
  Stage: ({ children }: any) => <div data-testid="konva-stage">{children}</div>,
  Layer: ({ children }: any) => <div>{children}</div>,
  Rect: () => null, Circle: () => null, Text: () => null, Group: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('../../sdk', () => ({
  sdk: {
    portal: {
      info: vi.fn().mockResolvedValue({
        event: { id: 'e1', title: 'Smith & Jones Wedding', startDate: '2026-09-12', endDate: '2026-09-12' },
        portalEnabled: true,
        requiresPassword: false,
        guests: [
          { id: 'g1', fullName: 'Aunt Mary', tableAssignment: 'Table 1', seatAssignment: null },
          { id: 'g2', fullName: 'Uncle Bob', tableAssignment: 'Table 1', seatAssignment: null },
        ],
        layout: null,
        theme: null,
      }),
      submitRsvp: vi.fn().mockResolvedValue({ ok: true, rsvpId: 'r1' }),
    },
    events: { get: vi.fn().mockResolvedValue({ event: { id: 'e1', organization_id: 'org1' } }) },
    platformConfig: { getOrg: vi.fn().mockResolvedValue({ config: {} }) },
    feedback: {
      getPolls: vi.fn().mockResolvedValue({ polls: [] }),
      votePoll: vi.fn().mockResolvedValue({}),
    },
  },
  ApiError: class extends Error { code = 'unknown'; kind = 'http'; },
}));

describe('PublicGuestPortal', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('renders the event title', async () => {
    render(<PublicGuestPortal eventId="e1" />);
    await waitFor(() => {
      expect(screen.getByText('Smith & Jones Wedding')).toBeTruthy();
    });
  });

  it('renders the event date', async () => {
    render(<PublicGuestPortal eventId="e1" />);
    await waitFor(() => {
      // Date should be formatted — look for "September" or "2026"
      expect(screen.getByText(/2026/)).toBeTruthy();
    });
  });

  it('renders bottom navigation with Home, Map, RSVP', async () => {
    render(<PublicGuestPortal eventId="e1" />);
    await waitFor(() => {
      expect(screen.getByText('Home')).toBeTruthy();
      expect(screen.getByText('Map')).toBeTruthy();
      expect(screen.getByText('RSVP')).toBeTruthy();
    });
  });

  it('shows hero banner on home tab', async () => {
    render(<PublicGuestPortal eventId="e1" />);
    await waitFor(() => {
      expect(screen.getByText(/celebrate with you/i)).toBeTruthy();
    });
  });

  it('switches to RSVP tab and shows form', async () => {
    render(<PublicGuestPortal eventId="e1" />);
    await waitFor(() => screen.getByText('Home'));

    // Click RSVP tab
    const rsvpBtn = screen.getAllByText('RSVP');
    fireEvent.click(rsvpBtn[rsvpBtn.length - 1]); // Bottom nav button

    await waitFor(() => {
      const nameLabels = screen.getAllByText(/Your Name/i); expect(nameLabels.length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText(/Find your name/i).length).toBeGreaterThanOrEqual(1);
    });
  });

  it('shows guest options in RSVP dropdown', async () => {
    render(<PublicGuestPortal eventId="e1" />);
    await waitFor(() => screen.getByText('Home'));

    const rsvpBtn = screen.getAllByText('RSVP');
    fireEvent.click(rsvpBtn[rsvpBtn.length - 1]);

    await waitFor(() => {
      const select = screen.getByRole('combobox') as HTMLSelectElement;
      const options = Array.from(select.options).map(o => o.text);
      expect(options).toContain('Aunt Mary');
      expect(options).toContain('Uncle Bob');
    });
  });


  it('shows wedding countdown', async () => {
    render(<PublicGuestPortal eventId="e1" />);
    await waitFor(() => {
      expect(screen.getByText(/days until the wedding/i)).toBeTruthy();
    });
  });
});