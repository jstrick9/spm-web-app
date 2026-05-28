export type GuestField = 
  | 'fullName'
  | 'email'
  | 'phone'
  | 'partyName'
  | 'rsvpStatus'
  | 'tableAssignment'
  | 'dietaryRestrictions'
  | 'accessibilityNotes';

export const GUEST_FIELDS: Array<{ id: GuestField; label: string; aliases: string[] }> = [
  { id: 'fullName', label: 'Full Name', aliases: ['name', 'full name', 'guest name', 'first name', 'last name'] },
  { id: 'email', label: 'Email Address', aliases: ['email', 'e-mail', 'email address'] },
  { id: 'phone', label: 'Phone Number', aliases: ['phone', 'phone number', 'cell', 'mobile'] },
  { id: 'partyName', label: 'Party Name', aliases: ['party', 'party name', 'group', 'family'] },
  { id: 'rsvpStatus', label: 'RSVP Status', aliases: ['rsvp', 'status', 'rsvp status', 'attending'] },
  { id: 'tableAssignment', label: 'Table Assignment', aliases: ['table', 'table assignment', 'table number'] },
  { id: 'dietaryRestrictions', label: 'Dietary Restrictions', aliases: ['dietary', 'diet', 'dietary restrictions', 'food allergies', 'allergies'] },
  { id: 'accessibilityNotes', label: 'Accessibility Notes', aliases: ['accessibility', 'accessibility notes', 'special needs'] },
];

export function guessMapping(header: string): { field: GuestField | null; confidence: number } {
  const normalized = header.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
  
  let bestMatch: GuestField | null = null;
  let highestConfidence = 0;

  for (const field of GUEST_FIELDS) {
    for (const alias of field.aliases) {
      if (alias === normalized) {
        return { field: field.id, confidence: 1 };
      }
      
      // Partial match
      if (normalized.includes(alias) || alias.includes(normalized)) {
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
