import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../hooks/useLayoutState', () => ({
  getVenues: () => [
    {
      id: 'v1',
      name: 'Reception Hall',
      width: 50,
      height: 40,
      capacity: 100,
      category: 'reception',
    },
  ],
  getSavedLayouts: () => [
    {
      id: 'layout-1',
      name: 'Layout 1',
      venueId: 'v1',
      tables: [],
      fixtures: [],
      decor: [],
      guests: [
        {
          id: 'g1',
          name: 'Jane Guest',
          email: 'jane@example.com',
        },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ],
}));

import {
  clearGuestPortalSession,
  createGuestPortalSession,
  findGuestInEvent,
  getGuestPortalAccessEnd,
  getGuestPortalConfig,
  getGuestPortalTokenFromLocation,
  getPortalGuests,
  getPortalGuestsForEvent,
  getPortalRSVPSubmissions,
  getPortalRSVPSubmissionsForEvent,
  getPortalVenues,
  isGuestPortalEventActive,
  loadGuestPortalSession,
  normalizeEventKey,
  saveGuestPortalSession,
  setGuestPortalConfig,
  setPortalGuests,
  setPortalRSVPSubmissions,
} from './guestPortal';

const sampleConfig = {
  eventTitle: 'Spring Wedding',
  eventStartDate: '2026-05-12',
  eventEndDate: '2026-05-13',
  portalPasswordHash: 'hash123',
  portalPasswordSalt: 'salt123',
};

describe('guest portal helpers', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('normalizes event keys', () => {
    expect(normalizeEventKey('Smith Wedding 2026')).toBe('smith-wedding-2026');
    expect(normalizeEventKey('  Spring   Wedding  ')).toBe('spring-wedding');
  });

  it('stores and loads guest portal config', () => {
    setGuestPortalConfig(sampleConfig as any);

    const loaded = getGuestPortalConfig();
    expect(loaded).toEqual(sampleConfig);

    const stored = JSON.parse(localStorage.getItem('spm_portal_config') || 'null');
    expect(stored.version).toBe(2);
  });

  it('calculates event access end as event-end date plus the grace period (default 36 h)', () => {
    // sampleConfig.eventEndDate = '2026-05-13'
    // default grace = 36 h  →  2026-05-13T00:00:00Z + 36 h = 2026-05-14T12:00:00Z
    const end = getGuestPortalAccessEnd(sampleConfig as any);
    expect(end).not.toBeNull();
    expect(end?.toISOString()).toBe('2026-05-14T12:00:00.000Z');
  });

  it('treats guest portal as active until the grace period expires (36 h after event-end date)', () => {
    // Portal stays open through 2026-05-14T11:59:59Z (inside the 36 h grace)
    expect(
      isGuestPortalEventActive(sampleConfig as any, new Date('2026-05-14T11:59:59Z')),
    ).toBe(true);

    // Portal closes at 2026-05-14T12:00:00Z (exactly 36 h after midnight UTC of eventEndDate)
    expect(
      isGuestPortalEventActive(sampleConfig as any, new Date('2026-05-14T12:00:00Z')),
    ).toBe(false);
  });

  it('falls back to saved-layout guests when explicit portal guests are absent', () => {
    const guests = getPortalGuests();
    expect(guests).toHaveLength(1);
    expect(guests[0].name).toBe('Jane Guest');
  });

  it('uses explicit portal guests when present', () => {
    setPortalGuests([
      {
        id: 'g2',
        name: 'Explicit Guest',
        token: 'guest-token-1',
      },
    ] as any);

    const guests = getPortalGuests();
    expect(guests).toHaveLength(1);
    expect(guests[0].name).toBe('Explicit Guest');
  });

  it('filters portal guests by event when scoped guest records exist', () => {
    setPortalGuests([
      {
        id: 'g1',
        name: 'Jane Guest',
        email: 'jane@example.com',
        eventName: 'Smith Wedding',
      },
      {
        id: 'g2',
        name: 'Mark Guest',
        email: 'mark@example.com',
        eventName: 'Other Wedding',
      },
    ] as any);

    const guests = getPortalGuestsForEvent('Smith Wedding');
    expect(guests).toHaveLength(1);
    expect(guests[0].name).toBe('Jane Guest');
  });

  it('finds a guest in a given event by email', () => {
    setPortalGuests([
      {
        id: 'g1',
        name: 'Jane Guest',
        email: 'jane@example.com',
        eventName: 'Smith Wedding',
      },
    ] as any);

    const guest = findGuestInEvent('Smith Wedding', 'jane@example.com');
    expect(guest?.id).toBe('g1');
  });

  it('stores and loads RSVP submissions', () => {
    setPortalRSVPSubmissions([
      {
        id: 'r1',
        guestId: 'g1',
        fullName: 'Jane Guest',
        email: 'jane@example.com',
        attending: true,
        submittedAt: new Date().toISOString(),
      },
    ]);

    const loaded = getPortalRSVPSubmissions();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].id).toBe('r1');
  });

  it('filters RSVP submissions by event when scoped records exist', () => {
    setPortalRSVPSubmissions([
      {
        id: 'r1',
        guestId: 'g1',
        eventName: 'Smith Wedding',
        eventKey: 'smith-wedding',
        fullName: 'Jane Guest',
        email: 'jane@example.com',
        attending: true,
        submittedAt: new Date().toISOString(),
      },
      {
        id: 'r2',
        guestId: 'g2',
        eventName: 'Other Wedding',
        eventKey: 'other-wedding',
        fullName: 'Mark Guest',
        email: 'mark@example.com',
        attending: true,
        submittedAt: new Date().toISOString(),
      },
    ] as any);

    const submissions = getPortalRSVPSubmissionsForEvent('Smith Wedding');
    expect(submissions).toHaveLength(1);
    expect(submissions[0].id).toBe('r1');
  });

  it('returns portal venues from layout state', () => {
    const venues = getPortalVenues();
    expect(venues).toHaveLength(1);
    expect(venues[0].name).toBe('Reception Hall');
  });

  it('parses guest token from normal query string', () => {
    const location = {
      search: '?token=abc123',
      hash: '#/guest-portal',
    } as Location;

    expect(getGuestPortalTokenFromLocation(location)).toBe('abc123');
  });

  it('parses guest token from hash-route query string', () => {
    const location = {
      search: '',
      hash: '#/guest-portal?token=hashToken42',
    } as Location;

    expect(getGuestPortalTokenFromLocation(location)).toBe('hashToken42');
  });

  it('returns undefined when no guest token is present', () => {
    const location = {
      search: '',
      hash: '#/guest-portal',
    } as Location;

    expect(getGuestPortalTokenFromLocation(location)).toBeUndefined();
  });

  it('creates a scoped guest portal session', () => {
    const session = createGuestPortalSession(
      sampleConfig as any,
      'guest-token-1',
      'Smith Wedding',
      'guest-1',
    );

    expect(session.v).toBe(1);
    expect(session.guestToken).toBe('guest-token-1');
    expect(session.guestId).toBe('guest-1');
    expect(session.eventKey).toBe('smith-wedding');
    expect(session.portalFingerprint).toContain('Spring Wedding');
    expect(session.expiresAt).toBeTruthy();
  });

  it('loads a valid guest portal session for the same config and event', () => {
    saveGuestPortalSession(sampleConfig as any, 'guest-token-2', 'Smith Wedding', 'g1');
    const loaded = loadGuestPortalSession(sampleConfig as any, 'Smith Wedding');

    expect(loaded).not.toBeNull();
    expect(loaded?.guestToken).toBe('guest-token-2');
    expect(loaded?.eventKey).toBe('smith-wedding');
  });

  it('rejects a guest portal session when the config fingerprint changes', () => {
    saveGuestPortalSession(sampleConfig as any, 'guest-token-2', 'Smith Wedding', 'g1');

    const loaded = loadGuestPortalSession(
      {
        ...sampleConfig,
        eventTitle: 'Different Event',
      } as any,
      'Smith Wedding',
    );

    expect(loaded).toBeNull();
  });

  it('rejects a guest portal session when the event changes', () => {
    saveGuestPortalSession(sampleConfig as any, 'guest-token-2', 'Smith Wedding', 'g1');

    const loaded = loadGuestPortalSession(sampleConfig as any, 'Other Wedding');
    expect(loaded).toBeNull();
  });

  it('rejects expired guest portal sessions', () => {
    const session = createGuestPortalSession(
      sampleConfig as any,
      'guest-token-3',
      'Smith Wedding',
      'g1',
    );

    sessionStorage.setItem(
      'spm_portal_auth',
      JSON.stringify({
        ...session,
        expiresAt: new Date(Date.now() - 1000).toISOString(),
      }),
    );

    const loaded = loadGuestPortalSession(sampleConfig as any, 'Smith Wedding');
    expect(loaded).toBeNull();
  });

  it('rejects sessions for inactive events', () => {
    saveGuestPortalSession(sampleConfig as any, 'guest-token-4', 'Smith Wedding', 'g1');

    const loaded = loadGuestPortalSession(
      sampleConfig as any,
      'Smith Wedding',
    );

    expect(loaded).not.toBeNull();

    const inactiveLoaded = loadGuestPortalSession(
      {
        ...sampleConfig,
        eventEndDate: '2020-01-01',
      } as any,
      'Smith Wedding',
    );

    expect(inactiveLoaded).toBeNull();
  });

  it('clears guest portal session', () => {
    saveGuestPortalSession(sampleConfig as any, 'guest-token-4', 'Smith Wedding', 'g1');
    expect(sessionStorage.getItem('spm_portal_auth')).toBeTruthy();

    clearGuestPortalSession();

    expect(sessionStorage.getItem('spm_portal_auth')).toBeNull();
  });
});