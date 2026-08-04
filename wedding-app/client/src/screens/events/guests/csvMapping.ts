export type GuestField = 
  | 'fullName'
  | 'email'
  | 'phone'
  | 'partyName'
  | 'rsvpStatus'
  | 'tableAssignment'
  | 'dietaryRestrictions'
  | 'accessibilityNotes'
  | 'plusOneAllowed'
  | 'allowPortalAccess';

export const GUEST_FIELDS: Array<{ id: GuestField; label: string; aliases: string[] }> = [
  { id: 'fullName', label: 'Full Name', aliases: ['name', 'full name', 'guest name', 'first name', 'last name'] },
  { id: 'email', label: 'Email Address', aliases: ['email', 'e-mail', 'email address'] },
  { id: 'phone', label: 'Phone Number', aliases: ['phone', 'phone number', 'cell', 'mobile'] },
  { id: 'partyName', label: 'Party Name', aliases: ['party', 'party name', 'group', 'family'] },
  { id: 'rsvpStatus', label: 'RSVP Status', aliases: ['rsvp', 'status', 'rsvp status', 'attending'] },
  { id: 'tableAssignment', label: 'Table Assignment', aliases: ['table', 'table assignment', 'table number'] },
  { id: 'dietaryRestrictions', label: 'Dietary Restrictions', aliases: ['dietary', 'diet', 'dietary restrictions', 'food allergies', 'allergies'] },
  { id: 'accessibilityNotes', label: 'Accessibility Notes', aliases: ['accessibility', 'accessibility notes', 'special needs'] },
  { id: 'plusOneAllowed', label: 'Plus-One Allowed', aliases: ['plus one', '+1', 'plus-one', 'plus 1', 'plus one allowed'] },
  { id: 'allowPortalAccess', label: 'Allow Portal Access', aliases: ['portal', 'portal access', 'allow portal', 'secure link', 'invited'] },
];

/** Truthy/falsy values for boolean import columns (plus-one, portal access). */
const TRUTHY = new Set(['1', 'true', 'yes', 'y', 't']);
const FALSY = new Set(['0', 'false', 'no', 'n', 'f', '']);

/** Parse a CSV cell into a boolean for boolean-typed fields. */
export function parseBooleanCell(value: string): boolean {
  const v = value.trim().toLowerCase();
  if (TRUTHY.has(v)) return true;
  if (FALSY.has(v)) return false;
  // Unrecognized values default to the field's natural state (portal on, plus-one off).
  return false;
}

/**
 * Normalize a header/alias for comparison: lowercase, punctuation becomes a
 * space so hyphenated forms ("plus-one", "+1") match their spaced aliases.
 */
function normalizeHeader(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export function guessMapping(header: string): { field: GuestField | null; confidence: number } {
  const normalized = normalizeHeader(header);
  
  let bestMatch: GuestField | null = null;
  let highestConfidence = 0;

  for (const field of GUEST_FIELDS) {
    for (const alias of field.aliases) {
      const a = normalizeHeader(alias);
      if (a === normalized) {
        return { field: field.id, confidence: 1 };
      }
      
      // Partial match
      if (normalized.includes(a) || a.includes(normalized)) {
        const conf = 0.8;
        if (conf > highestConfidence) {
          highestConfidence = conf;
          bestMatch = field.id;
        }
      }
    }
  }

  return { field: bestMatch, confidence: highestConfidence };
}
