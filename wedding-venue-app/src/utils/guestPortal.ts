import type {
  GuestPortalConfig,
  GuestPortalGuestRecord,
  RSVPSubmission,
  Venue,
} from '../types';
import { getSavedLayouts, getVenues } from '../hooks/useLayoutState';
import { STORAGE_KEYS } from '../constants/storageKeys';
import { STORAGE_VERSIONS } from '../constants/storageVersions';
import { loadVersionedStorage, saveVersionedStorage } from './storage';

export const GUEST_PORTAL_STORAGE_KEYS = {
  CONFIG: STORAGE_KEYS.PORTAL_CONFIG,
  AUTH: STORAGE_KEYS.PORTAL_AUTH,
  RSVP_SUBMISSIONS: STORAGE_KEYS.RSVP_SUBMISSIONS,
  GUESTS: STORAGE_KEYS.PORTAL_GUESTS,
} as const;

const GUEST_PORTAL_STORAGE_VERSIONS = {
  CONFIG: STORAGE_VERSIONS.PORTAL_CONFIG,
  RSVP_SUBMISSIONS: STORAGE_VERSIONS.RSVP_SUBMISSIONS,
  GUESTS: STORAGE_VERSIONS.PORTAL_GUESTS,
} as const;

interface GuestPortalSession {
  v: 1;
  authedAt: string;
  expiresAt: string;
  guestToken?: string;
  guestId?: string;
  eventKey?: string;
  portalFingerprint: string;
}

const GUEST_PORTAL_SESSION_TTL_MS = 4 * 60 * 60 * 1000;

export function normalizeEventKey(eventName: string): string {
  return eventName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Returns the UTC timestamp after which the guest portal should be considered
 * inaccessible.
 *
 * Default: midnight UTC at end of the event day PLUS a grace period so that
 * venues in time-zones behind UTC (e.g. EST = UTC-5) don't lose portal access
 * hours before their event physically ends.
 *
 * The grace period defaults to 36 hours but is overridable via
 * `config.accessGracePeriodHours` (set in the Admin → Guest Portal tab).
 */
export function getGuestPortalAccessEnd(
  config: GuestPortalConfig,
): Date | null {
  const rawDate = config.eventEndDate || config.eventStartDate;
  if (!rawDate) return null;

  // Grace period in hours (default 36 h = event day + next full day buffer)
  const gracePeriodHours = (config as any).accessGracePeriodHours ?? 36;

  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(rawDate.trim());

  if (dateOnlyMatch) {
    const year = Number(dateOnlyMatch[1]);
    const monthIndex = Number(dateOnlyMatch[2]) - 1;
    const day = Number(dateOnlyMatch[3]);
    // Start of the event date in UTC, then add grace period
    const baseMs = Date.UTC(year, monthIndex, day, 0, 0, 0, 0);
    return new Date(baseMs + gracePeriodHours * 60 * 60 * 1000);
  }

  const eventDate = new Date(rawDate);
  if (Number.isNaN(eventDate.getTime())) return null;

  const baseMs = Date.UTC(
    eventDate.getUTCFullYear(),
    eventDate.getUTCMonth(),
    eventDate.getUTCDate(),
    0,
    0,
    0,
    0,
  );
  return new Date(baseMs + gracePeriodHours * 60 * 60 * 1000);
}

export function isGuestPortalEventActive(
  config: GuestPortalConfig | null,
  now: Date = new Date(),
): boolean {
  if (!config) return false;

  const accessEnd = getGuestPortalAccessEnd(config);
  if (!accessEnd) return true;

  return now.getTime() < accessEnd.getTime();
}

function getPortalFingerprint(config: GuestPortalConfig | null): string {
  if (!config) return 'guest-portal:none';

  return [
    config.eventTitle || '',
    config.eventStartDate || '',
    config.eventEndDate || '',
    config.portalPasswordHash || '',
    config.portalPassword || '',
  ].join('::');
}

export function getGuestPortalConfig(): GuestPortalConfig | null {
  return loadVersionedStorage<GuestPortalConfig | null>({
    key: GUEST_PORTAL_STORAGE_KEYS.CONFIG,
    defaultValue: null,
    currentVersion: GUEST_PORTAL_STORAGE_VERSIONS.CONFIG,
    migrations: {
      0: (input) => (input as GuestPortalConfig) || null,
    },
  });
}

export function setGuestPortalConfig(config: GuestPortalConfig): void {
  saveVersionedStorage(
    GUEST_PORTAL_STORAGE_KEYS.CONFIG,
    GUEST_PORTAL_STORAGE_VERSIONS.CONFIG,
    config,
  );
}

export function getPortalVenues(): Venue[] {
  return getVenues();
}

export function getPortalGuests(): GuestPortalGuestRecord[] {
  const explicitGuests = loadVersionedStorage<GuestPortalGuestRecord[]>({
    key: GUEST_PORTAL_STORAGE_KEYS.GUESTS,
    defaultValue: [],
    currentVersion: GUEST_PORTAL_STORAGE_VERSIONS.GUESTS,
    migrations: {
      0: (input) =>
        Array.isArray(input) ? (input as GuestPortalGuestRecord[]) : [],
    },
    normalize: (value) => (Array.isArray(value) ? value : []),
  });

  if (explicitGuests.length > 0) {
    return explicitGuests;
  }

  const savedLayouts = getSavedLayouts();
  const merged = new Map<string, GuestPortalGuestRecord>();

  savedLayouts.forEach((layout) => {
    (layout.guests || []).forEach((guest) => {
      merged.set(guest.id, {
        ...merged.get(guest.id),
        ...guest,
      });
    });
  });

  return Array.from(merged.values());
}

export function getPortalGuestsForEvent(eventName: string): GuestPortalGuestRecord[] {
  const eventKey = normalizeEventKey(eventName);
  const guests = getPortalGuests();

  const hasScopedGuests = guests.some((g) => g.eventKey || g.eventName);

  if (!hasScopedGuests) {
    return guests;
  }

  return guests.filter((guest) => {
    const guestEventKey =
      guest.eventKey || (guest.eventName ? normalizeEventKey(guest.eventName) : '');

    return guestEventKey === eventKey;
  });
}

export function setPortalGuests(guests: GuestPortalGuestRecord[]): void {
  saveVersionedStorage(
    GUEST_PORTAL_STORAGE_KEYS.GUESTS,
    GUEST_PORTAL_STORAGE_VERSIONS.GUESTS,
    guests,
  );
}

export function getPortalRSVPSubmissions(): RSVPSubmission[] {
  return loadVersionedStorage<RSVPSubmission[]>({
    key: GUEST_PORTAL_STORAGE_KEYS.RSVP_SUBMISSIONS,
    defaultValue: [],
    currentVersion: GUEST_PORTAL_STORAGE_VERSIONS.RSVP_SUBMISSIONS,
    migrations: {
      0: (input) => (Array.isArray(input) ? (input as RSVPSubmission[]) : []),
    },
    normalize: (value) => (Array.isArray(value) ? value : []),
  });
}

export function getPortalRSVPSubmissionsForEvent(eventName: string): RSVPSubmission[] {
  const eventKey = normalizeEventKey(eventName);
  const submissions = getPortalRSVPSubmissions();

  const hasScopedSubmissions = submissions.some((s) => s.eventKey || s.eventName);

  if (!hasScopedSubmissions) {
    return submissions;
  }

  return submissions.filter((submission) => {
    const submissionEventKey =
      submission.eventKey ||
      (submission.eventName ? normalizeEventKey(submission.eventName) : '');

    return submissionEventKey === eventKey;
  });
}

export function setPortalRSVPSubmissions(
  submissions: RSVPSubmission[],
): void {
  saveVersionedStorage(
    GUEST_PORTAL_STORAGE_KEYS.RSVP_SUBMISSIONS,
    GUEST_PORTAL_STORAGE_VERSIONS.RSVP_SUBMISSIONS,
    submissions,
  );
}

export function findGuestInEvent(
  eventName: string,
  identifier: string,
): GuestPortalGuestRecord | undefined {
  const normalizedIdentifier = identifier.trim().toLowerCase();
  const guests = getPortalGuestsForEvent(eventName);

  return guests.find((guest) => {
    const matchesEmail = guest.email?.trim().toLowerCase() === normalizedIdentifier;
    const matchesName = guest.name.trim().toLowerCase() === normalizedIdentifier;
    const matchesToken = guest.token?.trim().toLowerCase() === normalizedIdentifier;

    return matchesEmail || matchesName || matchesToken;
  });
}

export function createGuestPortalSession(
  config: GuestPortalConfig | null,
  guestToken?: string,
  eventName?: string,
  guestId?: string,
): GuestPortalSession {
  const now = Date.now();
  const accessEnd = config ? getGuestPortalAccessEnd(config) : null;

  const naturalExpiry = new Date(now + GUEST_PORTAL_SESSION_TTL_MS);
  const expiresAt =
    accessEnd && accessEnd.getTime() > now && accessEnd.getTime() < naturalExpiry.getTime()
      ? accessEnd
      : naturalExpiry;

  return {
    v: 1,
    authedAt: new Date(now).toISOString(),
    expiresAt: expiresAt.toISOString(),
    guestToken,
    guestId,
    eventKey: eventName ? normalizeEventKey(eventName) : undefined,
    portalFingerprint: getPortalFingerprint(config),
  };
}

export function saveGuestPortalSession(
  config: GuestPortalConfig | null,
  guestToken?: string,
  eventName?: string,
  guestId?: string,
): void {
  sessionStorage.setItem(
    GUEST_PORTAL_STORAGE_KEYS.AUTH,
    JSON.stringify(createGuestPortalSession(config, guestToken, eventName, guestId)),
  );
}

export function clearGuestPortalSession(): void {
  sessionStorage.removeItem(GUEST_PORTAL_STORAGE_KEYS.AUTH);
}

export function loadGuestPortalSession(
  config: GuestPortalConfig | null,
  eventName?: string,
): GuestPortalSession | null {
  const raw = sessionStorage.getItem(GUEST_PORTAL_STORAGE_KEYS.AUTH);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as GuestPortalSession;
    if (!parsed?.expiresAt) return null;
    if (new Date(parsed.expiresAt).getTime() <= Date.now()) return null;
    if (parsed.portalFingerprint !== getPortalFingerprint(config)) return null;
    if (eventName) {
      const expectedEventKey = normalizeEventKey(eventName);
      if (parsed.eventKey && parsed.eventKey !== expectedEventKey) {
        return null;
      }
    }

    return parsed;
  } catch {
    return null;
  }
}

export function getGuestPortalTokenFromLocation(
  location: Location = window.location,
): string | undefined {
  // Extract token from URL and immediately clear it from history
  const searchParams = new URLSearchParams(location.search);
  const directSearchToken = searchParams.get('token');
  
  if (directSearchToken) {
    // Clear token from URL to prevent it from being logged in browser history
    clearTokenFromUrl(location);
    return directSearchToken;
  }

  const hash = location.hash || '';
  const hashQueryIndex = hash.indexOf('?');

  if (hashQueryIndex >= 0) {
    const hashQuery = hash.slice(hashQueryIndex + 1);
    const hashParams = new URLSearchParams(hashQuery);
    const hashToken = hashParams.get('token');
    
    if (hashToken) {
      clearTokenFromUrl(location);
      return hashToken;
    }
  }

  return undefined;
}

function clearTokenFromUrl(location: Location): void {
  try {
    // Remove token from URL without page reload
    const url = new URL(location.href);
    url.searchParams.delete('token');
    
    // Also remove from hash if present
    if (url.hash.includes('token=')) {
      const hashParts = url.hash.split('?');
      if (hashParts.length > 1) {
        const hashParams = new URLSearchParams(hashParts[1]);
        hashParams.delete('token');
        url.hash = hashParams.toString() ? `${hashParts[0]}?${hashParams.toString()}` : hashParts[0];
      }
    }
    
    // Replace current history entry to remove token
    window.history.replaceState({}, '', url.toString());
  } catch {
    // Silently fail if URL manipulation is not possible
  }
}