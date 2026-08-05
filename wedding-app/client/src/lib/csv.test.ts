import { describe, it, expect } from 'vitest';
import { csvCell, toCsv, parseCsv } from './csv';

describe('csvCell (formula-injection guard)', () => {
  it('neutralizes leading = + - @ with a single quote', () => {
    expect(csvCell('=HYPERLINK("https://evil.example","x")')).toBe(`"'=HYPERLINK(""https://evil.example"",""x"")"`);
    expect(csvCell('+SUM(A1:A9)')).toBe(`"'+SUM(A1:A9)"`);
    expect(csvCell('-1+1')).toBe(`"'-1+1"`);
    expect(csvCell('@cmd')).toBe(`"'@cmd"`);
  });

  it('leaves normal values untouched (still quoted, inner quotes doubled)', () => {
    expect(csvCell('Alice')).toBe('"Alice"');
    expect(csvCell('O\'Brien')).toBe('"O\'Brien"');
    expect(csvCell('Say "hi"')).toBe('"Say ""hi"""');
    expect(csvCell(null)).toBe('""');
    expect(csvCell(42)).toBe('"42"');
  });

  it('toCsv builds a document row by row', () => {
    const csv = toCsv([['Name', 'Notes'], ['DJ', '=cmd'], ['Caterer', 'Great']]);
    expect(csv).toBe('"Name","Notes"\n"DJ","\'=cmd"\n"Caterer","Great"');
  });
});

describe('parseCsv (existing importer untouched)', () => {
  it('round-trips quoted cells and escaped quotes', () => {
    const rows = parseCsv('"a","b,c"\n"say ""hi""","d"');
    expect(rows).toEqual([['a', 'b,c'], ['say "hi"', 'd']]);
  });
});
