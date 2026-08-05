import { describe, it, expect, afterEach, vi } from 'vitest';
import { appPublicBaseUrl } from './appBaseUrl.js';

const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

afterEach(() => {
  delete process.env.PUBLIC_APP_URL;
  delete process.env.BASE_URL;
  delete process.env.NODE_ENV;
  warn.mockClear();
});

describe('appPublicBaseUrl', () => {
  it('prefers PUBLIC_APP_URL over BASE_URL over localhost fallback', () => {
    process.env.PUBLIC_APP_URL = 'https://public.example.com/';
    process.env.BASE_URL = 'https://base.example.com';
    expect(appPublicBaseUrl()).toBe('https://public.example.com');

    delete process.env.PUBLIC_APP_URL;
    process.env.BASE_URL = 'https://base.example.com/';
    expect(appPublicBaseUrl()).toBe('https://base.example.com');

    delete process.env.PUBLIC_APP_URL;
    delete process.env.BASE_URL;
    expect(appPublicBaseUrl()).toBe('http://localhost:5173');
  });

  it('ignores non-http values and falls back', () => {
    process.env.BASE_URL = 'not-a-url';
    expect(appPublicBaseUrl()).toBe('http://localhost:5173');
  });

  it('warns once in production when the origin is localhost', () => {
    process.env.NODE_ENV = 'production';
    process.env.BASE_URL = 'http://localhost:3000';
    appPublicBaseUrl();
    appPublicBaseUrl(); // second call: no second warning
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('WARNING');
  });

  it('does not warn in development for localhost', () => {
    process.env.BASE_URL = 'http://localhost:3000';
    appPublicBaseUrl();
    expect(warn).not.toHaveBeenCalled();
  });
});
