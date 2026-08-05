/**
 * CSV cell + row builders with spreadsheet-formula injection protection
 * (OWASP "CSV Injection").
 *
 * Guest/vendor names, notes, and metadata are user-controlled. A cell
 * starting with `=`, `+`, `-`, or `@` is interpreted as a FORMULA by
 * Excel/Sheets when the exported file is opened — e.g. a guest named
 * `=HYPERLINK("https://evil.example","click")` would run the link, and
 * `=2+5` would evaluate. Prefixing those cells with a single quote keeps
 * them inert text (the quote is visible in some editors but never
 * executes).
 */
export function csvCell(value: unknown): string {
  let s = String(value ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

/** Build a full CSV document from rows of raw values (safe cells). */
export function toCsv(rows: Array<Array<unknown>>): string {
  return rows.map((row) => row.map(csvCell).join(',')).join('\n');
}
