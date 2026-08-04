import { describe, it, expect } from 'vitest';
import { GUEST_FIELDS, guessMapping, parseBooleanCell } from './csvMapping';

describe('csvMapping', () => {
  it('auto-detects the new boolean columns (plus-one, portal access)', () => {
    expect(guessMapping('Plus One').field).toBe('plusOneAllowed');
    expect(guessMapping('+1').field).toBe('plusOneAllowed');
    expect(guessMapping('Plus-One Allowed').field).toBe('plusOneAllowed');
    expect(guessMapping('Portal Access').field).toBe('allowPortalAccess');
    expect(guessMapping('Allow Portal').field).toBe('allowPortalAccess');
    expect(guessMapping('Invited').field).toBe('allowPortalAccess');
  });

  it('keeps the original 8 core fields', () => {
    for (const header of ['Name', 'Email', 'Phone', 'Party', 'RSVP', 'Table', 'Dietary', 'Accessibility']) {
      expect(guessMapping(header).field).not.toBeNull();
    }
  });

  it('exposes all 10 fields for the mapping UI', () => {
    const ids = GUEST_FIELDS.map((f) => f.id);
    expect(ids).toEqual([
      'fullName', 'email', 'phone', 'partyName', 'rsvpStatus', 'tableAssignment',
      'dietaryRestrictions', 'accessibilityNotes', 'plusOneAllowed', 'allowPortalAccess',
    ]);
  });

  it('parses boolean cells with common truthy/falsy synonyms', () => {
    for (const t of ['1', 'true', 'yes', 'y', 't']) expect(parseBooleanCell(t)).toBe(true);
    for (const f of ['0', 'false', 'no', 'n', 'f', '']) expect(parseBooleanCell(f)).toBe(false);
  });
});
