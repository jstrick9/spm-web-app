/**
 * iCalendar (RFC 5545) TEXT-value escaping + line-injection guard.
 *
 * ICS is a line-oriented format: a user-controlled title containing a
 * newline (or lone CR) would terminate the current line and let the
 * author inject arbitrary VEVENT properties ("SUMMARY:EVIL"). TEXT
 * values must also escape `\`, `,`, and `;` to survive round-trips in
 * real calendar clients.
 */
export function icsText(value: unknown): string {
  return String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, ' ');
}
