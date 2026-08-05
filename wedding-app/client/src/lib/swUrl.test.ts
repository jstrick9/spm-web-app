import { describe, it, expect } from 'vitest';
import { sanitizeNotificationUrl } from './swUrl';

const ORIGIN = 'https://venue.example';

describe('sanitizeNotificationUrl', () => {
  it('keeps same-origin paths', () => {
    expect(sanitizeNotificationUrl('/events/e1', ORIGIN)).toBe('/events/e1');
    expect(sanitizeNotificationUrl('https://venue.example/events/e1', ORIGIN)).toBe('/events/e1');
    expect(sanitizeNotificationUrl('https://venue.example/#/events/e1', ORIGIN)).toBe('/#/events/e1');
  });

  it('keeps in-app hash routes', () => {
    expect(sanitizeNotificationUrl('#/events/e1?tab=staff', ORIGIN)).toBe('#/events/e1?tab=staff');
  });

  it('rejects cross-origin URLs (open-redirect guard)', () => {
    expect(sanitizeNotificationUrl('https://evil.example/phish', ORIGIN)).toBe('/');
    expect(sanitizeNotificationUrl('https://venue.example.evil.test/', ORIGIN)).toBe('/');
  });

  it('rejects non-http schemes', () => {
    expect(sanitizeNotificationUrl('javascript:alert(1)', ORIGIN)).toBe('/');
    expect(sanitizeNotificationUrl('data:text/html,<h1>x</h1>', ORIGIN)).toBe('/');
  });

  it('falls back to root for missing/garbage input', () => {
    expect(sanitizeNotificationUrl(undefined, ORIGIN)).toBe('/');
    expect(sanitizeNotificationUrl(null, ORIGIN)).toBe('/');
    expect(sanitizeNotificationUrl('', ORIGIN)).toBe('/');
    expect(sanitizeNotificationUrl(42, ORIGIN)).toBe('/');
    expect(sanitizeNotificationUrl('http://', ORIGIN)).toBe('/');
  });
});
