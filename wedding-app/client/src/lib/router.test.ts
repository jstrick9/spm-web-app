import { describe, expect, it } from 'vitest';
import { matchPath, matchPrefix } from './router';

describe('matchPath', () => {
  it('matches exact paths with no params', () => {
    expect(matchPath('/events', '/events')).toEqual({});
  });

  it('extracts a single :param', () => {
    expect(matchPath('/events/:id', '/events/abc-123')).toEqual({ id: 'abc-123' });
  });

  it('extracts multiple :params', () => {
    expect(matchPath('/events/:eventId/guests/:guestId', '/events/E1/guests/G1'))
      .toEqual({ eventId: 'E1', guestId: 'G1' });
  });

  it('returns null when segment count differs', () => {
    expect(matchPath('/events', '/events/abc')).toBeNull();
    expect(matchPath('/events/:id', '/events')).toBeNull();
  });

  it('returns null when literal segments differ', () => {
    expect(matchPath('/events/:id', '/users/abc')).toBeNull();
  });

  it('URL-decodes param values', () => {
    expect(matchPath('/events/:slug', '/events/smith%20%26%20jones'))
      .toEqual({ slug: 'smith & jones' });
  });
});

describe('matchPrefix', () => {
  it('matches exact equality', () => {
    expect(matchPrefix('/events', '/events')).toBe(true);
  });

  it('matches sub-paths', () => {
    expect(matchPrefix('/events', '/events/abc')).toBe(true);
    expect(matchPrefix('/events', '/events/abc/guests')).toBe(true);
  });

  it('rejects partial-word matches', () => {
    expect(matchPrefix('/event', '/events/abc')).toBe(false);
  });

  it('handles trailing slashes', () => {
    expect(matchPrefix('/events/', '/events/abc')).toBe(true);
  });
});
