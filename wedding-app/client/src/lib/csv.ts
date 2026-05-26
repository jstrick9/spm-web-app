/**
 * Minimal RFC 4180 CSV parser. Handles:
 *   - quoted fields with embedded commas
 *   - escaped quotes (`""` → `"`)
 *   - CRLF or LF row endings
 *   - leading UTF-8 BOM
 *   - configurable delimiter (',' or '\t' for TSV)
 *
 * NOT a streaming parser — reads the whole string. For typical wedding
 * guest lists (≤ 500 rows × ≤ 10 cols ≈ 50 KB) this is fine.
 *
 * Returns the raw rows; column mapping + per-cell validation are handled
 * downstream by importers/guests.ts.
 */

export interface ParseOptions {
  delimiter?: string;     // default ',' (or auto-detected when called via parseCsv)
}

export interface ParseResult {
  rows: string[][];
  delimiter: string;
}

/**
 * Auto-detect the most likely delimiter from the first non-empty line.
 * We look at TAB and COMMA, count occurrences, and pick the higher one.
 * Falls back to ','.
 */
export function detectDelimiter(text: string): ',' | '\t' {
  // Skip BOM
  const start = text.charCodeAt(0) === 0xFEFF ? 1 : 0;
  const newline = text.indexOf('\n', start);
  const firstLine = newline === -1 ? text.slice(start) : text.slice(start, newline);
  const tabs = (firstLine.match(/\t/g) ?? []).length;
  const commas = (firstLine.match(/,/g) ?? []).length;
  return tabs > commas ? '\t' : ',';
}

export function parseCsv(text: string, opts: ParseOptions = {}): ParseResult {
  // Strip BOM if present
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);

  const delimiter = opts.delimiter ?? detectDelimiter(text);

  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;
  const n = text.length;

  while (i < n) {
    const c = text[i];

    if (inQuotes) {
      if (c === '"') {
        // Escaped quote `""` → literal `"`
        if (i + 1 < n && text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        // Closing quote
        inQuotes = false;
        i++;
        continue;
      }
      field += c;
      i++;
      continue;
    }

    // Not in quotes
    if (c === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (c === delimiter) {
      row.push(field);
      field = '';
      i++;
      continue;
    }
    if (c === '\r') {
      // CRLF or bare CR — treat as end of row
      row.push(field); field = '';
      rows.push(row); row = [];
      if (i + 1 < n && text[i + 1] === '\n') i += 2; else i++;
      continue;
    }
    if (c === '\n') {
      row.push(field); field = '';
      rows.push(row); row = [];
      i++;
      continue;
    }
    field += c;
    i++;
  }

  // Flush whatever is left
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  // Drop a trailing empty-only row (common when CSVs end with \n)
  if (rows.length > 0) {
    const last = rows[rows.length - 1];
    if (last.length === 1 && last[0] === '') rows.pop();
  }

  return { rows, delimiter };
}

/**
 * Serialize rows back to CSV. Used by the importer to generate the
 * downloadable failures.csv. Quotes any field containing the delimiter,
 * a quote, or a newline.
 */
export function toCsv(rows: ReadonlyArray<ReadonlyArray<string | number | null | undefined>>, delimiter = ','): string {
  const out: string[] = [];
  for (const row of rows) {
    const cells: string[] = [];
    for (const raw of row) {
      const s = raw == null ? '' : String(raw);
      if (s.includes(delimiter) || s.includes('"') || s.includes('\n') || s.includes('\r')) {
        cells.push(`"${s.replace(/"/g, '""')}"`);
      } else {
        cells.push(s);
      }
    }
    out.push(cells.join(delimiter));
  }
  return out.join('\r\n');
}
