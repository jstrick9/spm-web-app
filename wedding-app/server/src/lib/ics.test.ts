import { describe, it, expect } from 'vitest';
import { icsText } from './ics.js';

describe('icsText (RFC 5545 + line-injection guard)', () => {
  it('neutralizes newlines and lone CRs so titles cannot inject VEVENT lines', () => {
    expect(icsText('Rehearsal\nEND:VEVENT')).toBe('Rehearsal END:VEVENT');
    expect(icsText('A\r\nB')).toBe('A B');
    expect(icsText('A\rB')).toBe('A B');
    expect(icsText('Fine\r\nBEGIN:VEVENT\r\nSUMMARY:EVIL')).toBe('Fine BEGIN:VEVENT SUMMARY:EVIL');
  });

  it('escapes backslash, semicolon and comma per RFC 5545 TEXT values', () => {
    expect(icsText('a\\b')).toBe('a\\\\b');
    expect(icsText('a;b')).toBe('a\\;b');
    expect(icsText('a,b')).toBe('a\\,b');
  });

  it('handles null/undefined as empty', () => {
    expect(icsText(null)).toBe('');
    expect(icsText(undefined)).toBe('');
  });
});
