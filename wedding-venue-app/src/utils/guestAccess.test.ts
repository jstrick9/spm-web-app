import { describe, expect, it } from 'vitest';
import {
  guestBelongsToEvent,
  guestCanAccessLodging,
  guestCanAccessPortal,
  guestCanSubmitRSVP,
  guestCanViewMap,
  guestCanViewSchedule,
} from './guestAccess';

describe('guest access helpers', () => {
  it('treats guests with matching event as belonging to that event', () => {
    const guest = {
      id: 'g1',
      name: 'Jane Guest',
      eventName: 'Smith Wedding',
    } as any;

    expect(guestBelongsToEvent(guest, 'Smith Wedding')).toBe(true);
    expect(guestBelongsToEvent(guest, 'Other Wedding')).toBe(false);
  });

  it('treats guests with matching eventKey as belonging to that event', () => {
    const guest = {
      id: 'g1',
      name: 'Jane Guest',
      eventKey: 'smith-wedding',
    } as any;

    expect(guestBelongsToEvent(guest, 'Smith Wedding')).toBe(true);
    expect(guestBelongsToEvent(guest, 'Other Wedding')).toBe(false);
  });

  it('allows legacy unscoped guests by default', () => {
    const guest = {
      id: 'g1',
      name: 'Legacy Guest',
    } as any;

    expect(guestBelongsToEvent(guest, 'Smith Wedding')).toBe(true);
  });

  it('blocks guests with allowPortalAccess false', () => {
    const guest = {
      id: 'g1',
      name: 'Blocked Guest',
      eventName: 'Smith Wedding',
      allowPortalAccess: false,
    } as any;

    expect(guestCanAccessPortal(guest, 'Smith Wedding')).toBe(false);
  });

  it('allows guests with matching event and portal access', () => {
    const guest = {
      id: 'g1',
      name: 'Allowed Guest',
      eventName: 'Smith Wedding',
      allowPortalAccess: true,
    } as any;

    expect(guestCanAccessPortal(guest, 'Smith Wedding')).toBe(true);
  });

  it('blocks lodging when allowLodgingAccess is false', () => {
    const guest = {
      id: 'g1',
      name: 'No Lodging Guest',
      eventName: 'Smith Wedding',
      allowPortalAccess: true,
      allowLodgingAccess: false,
    } as any;

    expect(guestCanAccessLodging(guest, 'Smith Wedding')).toBe(false);
  });

  it('allows lodging when guest belongs to event and is lodging-enabled', () => {
    const guest = {
      id: 'g1',
      name: 'Lodging Guest',
      eventName: 'Smith Wedding',
      allowPortalAccess: true,
      allowLodgingAccess: true,
    } as any;

    expect(guestCanAccessLodging(guest, 'Smith Wedding')).toBe(true);
  });

  it('blocks access when guest is undefined', () => {
    expect(guestCanAccessPortal(undefined, 'Smith Wedding')).toBe(false);
    expect(guestCanAccessLodging(undefined, 'Smith Wedding')).toBe(false);
    expect(guestCanSubmitRSVP(undefined, 'Smith Wedding')).toBe(false);
    expect(guestCanViewSchedule(undefined, 'Smith Wedding')).toBe(false);
    expect(guestCanViewMap(undefined, 'Smith Wedding')).toBe(false);
  });

  it('allows RSVP when guest can access the portal', () => {
    const guest = {
      id: 'g1',
      name: 'RSVP Guest',
      eventName: 'Smith Wedding',
      allowPortalAccess: true,
    } as any;

    expect(guestCanSubmitRSVP(guest, 'Smith Wedding')).toBe(true);
  });

  it('allows schedule and map when guest can access the portal', () => {
    const guest = {
      id: 'g1',
      name: 'View Guest',
      eventName: 'Smith Wedding',
      allowPortalAccess: true,
    } as any;

    expect(guestCanViewSchedule(guest, 'Smith Wedding')).toBe(true);
    expect(guestCanViewMap(guest, 'Smith Wedding')).toBe(true);
  });
});