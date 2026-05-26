import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, beforeEach } from 'vitest';
import { server } from './server.js';
import { setToken } from '../sdk/client.js';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// JSDOM doesn't ship ResizeObserver; recharts needs one. Trivial polyfill
// is sufficient because tests assert text content, not chart geometry.
class FakeResizeObserver {
  observe() {} unobserve() {} disconnect() {}
}
(globalThis as { ResizeObserver?: typeof ResizeObserver }).ResizeObserver =
  FakeResizeObserver as unknown as typeof ResizeObserver;


beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' });
});

beforeEach(() => {
  setToken(null);
});

afterEach(() => {
  cleanup();                 // unmount React trees so screen.* doesn't see stale roots
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});
