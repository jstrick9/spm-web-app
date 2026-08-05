export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let inQuotes = false;

  // Remove BOM if present
  if (text.charCodeAt(0) === 0xfeff) {
    text = text.slice(1);
  }

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        currentCell += '"';
        i++; // skip next char
      } else if (char === '"') {
        inQuotes = false;
      } else {
        currentCell += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        currentRow.push(currentCell);
        currentCell = '';
      } else if (char === '\r' && nextChar === '\n') {
        currentRow.push(currentCell);
        rows.push(currentRow);
        currentRow = [];
        currentCell = '';
        i++; // skip next char
      } else if (char === '\n' || char === '\r') {
        currentRow.push(currentCell);
        rows.push(currentRow);
        currentRow = [];
        currentCell = '';
      } else {
        currentCell += char;
      }
    }
  }

  if (currentCell !== '' || text[text.length - 1] === ',') {
    currentRow.push(currentCell);
  }
  
  if (currentRow.length > 0) {
    rows.push(currentRow);
  }

  return rows;
}

/**
 * CSV cell / document builders with spreadsheet-formula injection
 * protection (OWASP "CSV Injection").
 *
 * Names and notes exported from the app are user-controlled; a cell
 * starting with `=`, `+`, `-`, or `@` would be evaluated as a formula
 * when the CSV is opened in Excel/Sheets. Prefixing with a single quote
 * keeps it inert text. Mirrors server/src/lib/csv.ts.
 */
export function csvCell(value: unknown): string {
  let s = String(value ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

export function toCsv(rows: Array<Array<unknown>>): string {
  return rows.map((row) => row.map(csvCell).join(',')).join('\n');
}
