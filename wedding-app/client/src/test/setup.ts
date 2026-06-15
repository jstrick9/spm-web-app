import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterAll, afterEach, beforeAll, beforeEach, vi } from 'vitest';
import { server } from './server.js';
import { setToken } from '../sdk/client.js';

declare const process: any;
declare const Buffer: any;

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// JSDOM doesn't ship ResizeObserver; recharts needs one. Trivial polyfill
// is sufficient because tests assert text content, not chart geometry.
class FakeResizeObserver {
  observe() {} unobserve() {} disconnect() {}
}
(globalThis as { ResizeObserver?: typeof ResizeObserver }).ResizeObserver =
  FakeResizeObserver as unknown as typeof ResizeObserver;


let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
let stderrWrite: any;

function isKnownTestNoise(text: string): boolean {
  return [
    'not wrapped in act',
    'useToast must be inside <ToastProvider>',
    'usePlatformConfig must be used inside <ConfigProvider>',
    'Test crash',
    'The above error occurred in the <Naked> component',
    'The above error occurred in the <BuggyComponent> component',
  ].some((needle) => text.includes(needle));
}

beforeAll(() => {
  // Keep CI logs signal-heavy. These messages are intentionally produced by
  // tests that assert provider throws/ErrorBoundary behavior or by third-party
  // async UI primitives in jsdom; unexpected console.error output still passes
  // through.
  stderrWrite = process.stderr.write.bind(process.stderr) as typeof process.stderr.write;
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
    const text = args.map(String).join(' ');
    if (isKnownTestNoise(text)) return;
    stderrWrite.call(process.stderr, `${args.map(String).join(' ')}\n`);
  });
  process.stderr.write = ((chunk: unknown, ...args: unknown[]) => {
    const text = typeof chunk === 'string' ? chunk : Buffer.isBuffer(chunk) ? (chunk as any).toString('utf8') : String(chunk);
    if (isKnownTestNoise(text)) return true;
    return (stderrWrite as any)(chunk, ...args);
  }) as typeof process.stderr.write;
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
  consoleErrorSpy?.mockRestore();
  if (stderrWrite) process.stderr.write = stderrWrite;
});
