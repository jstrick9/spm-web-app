import { describe, it, expect } from 'vitest';
import { parseCsv } from './csv';

describe('parseCsv', () => {
  it('parses basic comma separated values', () => {
    const csv = 'a,b,c\n1,2,3';
    expect(parseCsv(csv)).toEqual([['a', 'b', 'c'], ['1', '2', '3']]);
  });

  it('handles quotes and escaped quotes', () => {
    const csv = 'a,"b,c",d\n1,"2""3",4';
    expect(parseCsv(csv)).toEqual([['a', 'b,c', 'd'], ['1', '2"3', '4']]);
  });

  it('handles CRLF', () => {
    const csv = 'a,b\r\n1,2';
    expect(parseCsv(csv)).toEqual([['a', 'b'], ['1', '2']]);
  });

  it('handles empty cells', () => {
    const csv = 'a,,c\n1,,3';
    expect(parseCsv(csv)).toEqual([['a', '', 'c'], ['1', '', '3']]);
  });

  it('removes BOM', () => {
    const csv = '\uFEFFa,b\n1,2';
    expect(parseCsv(csv)).toEqual([['a', 'b'], ['1', '2']]);
  });
});
