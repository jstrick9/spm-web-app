import type { GuestPortalGuestRecord } from '../types';
import { normalizeEventKey } from './guestPortal';

export function guestBelongsToEvent(
  guest: GuestPortalGuestRecord,
  eventName: string,
): boolean {
  const eventKey = normalizeEventKey(eventName);
  const guestEventKey =
    guest.eventKey || (guest.eventName ? normalizeEventKey(guest.eventName) : '');

  if (!guestEventKey) {
    return true;
  }

  return guestEventKey === eventKey;
}

export function guestCanAccessPortal(
  guest: GuestPortalGuestRecord | undefined,
  eventName: string,
): boolean {
  if (!guest) return false;
  if (guest.allowPortalAccess === false) return false;

  return guestBelongsToEvent(guest, eventName);
}

export function guestCanAccessLodging(
  guest: GuestPortalGuestRecord | undefined,
  eventName: string,
): boolean {
  if (!guest) return false;
  if (!guestCanAccessPortal(guest, eventName)) return false;
  if (guest.allowLodgingAccess === false) return false;

  return true;
}

export function guestCanSubmitRSVP(
  guest: GuestPortalGuestRecord | undefined,
  eventName: string,
): boolean {
  if (!guest) return false;
  return guestCanAccessPortal(guest, eventName);
}

export function guestCanViewSchedule(
  guest: GuestPortalGuestRecord | undefined,
  eventName: string,
): boolean {
  if (!guest) return false;
  return guestCanAccessPortal(guest, eventName);
}

export function guestCanViewMap(
  guest: GuestPortalGuestRecord | undefined,
  eventName: string,
): boolean {
  if (!guest) return false;
  return guestCanAccessPortal(guest, eventName);
}