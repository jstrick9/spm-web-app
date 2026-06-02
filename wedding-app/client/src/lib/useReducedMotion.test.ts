/**
 * useReducedMotion tests — Phase 35b
 *
 * Tests the hook's behaviour in jsdom (Vitest environment).
 *
 * Covers:
 *   ✅ Returns false when matchMedia reports no preference
 *   ✅ Returns true when matchMedia reports reduce preference
 *   ✅ Updates reactively when the OS preference changes
 *   ✅ Cleans up the event listener on unmount (no memory leak)
 *   ✅ Handles window being undefined gracefully (SSR safety)
 *   ✅ Initial value is synchronous (no useEffect flash)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useReducedMotion } from './useReducedMotion';

// ── matchMedia mock ────────────────────────────────────────────────────────
// jsdom does not implement matchMedia. We provide a complete mock that
// supports addEventListener / removeEventListener and lets tests
// programmatically fire change events.

type ChangeHandler = (e: MediaQueryListEvent) => void;

function createMatchMediaMock(initialMatches: boolean) {
  const listeners = new Set<ChangeHandler>();

  const mql = {
    matches: initialMatches,
    media:   '(prefers-reduced-motion: reduce)',
    addEventListener:    vi.fn((_: string, fn: ChangeHandler) => { listeners.add(fn); }),
    removeEventListener: vi.fn((_: string, fn: ChangeHandler) => { listeners.delete(fn); }),
    // Fire a change event programmatically from tests
    _fire: (matches: boolean) => {
      mql.matches = matches;
      const event = { matches } as MediaQueryListEvent;
      listeners.forEach((fn) => fn(event));
    },
    dispatchEvent: vi.fn(),
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
  };

  return mql;
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('useReducedMotion', () => {
  let mockMql: ReturnType<typeof createMatchMediaMock>;

  beforeEach(() => {
    mockMql = createMatchMediaMock(false);
    vi.stubGlobal('window', {
      ...window,
      matchMedia: vi.fn().mockReturnValue(mockMql),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  // ── Initial value ────────────────────────────────────────────────────────
  it('returns false when matchMedia reports no reduced-motion preference', () => {
    mockMql = createMatchMediaMock(false);
    vi.mocked(window.matchMedia).mockReturnValue(mockMql as unknown as MediaQueryList);

    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(false);
  });

  it('returns true when matchMedia reports prefers-reduced-motion: reduce', () => {
    mockMql = createMatchMediaMock(true);
    vi.mocked(window.matchMedia).mockReturnValue(mockMql as unknown as MediaQueryList);

    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(true);
  });

  // ── Reactive update ──────────────────────────────────────────────────────
  it('updates to true when the OS preference changes to reduce', () => {
    mockMql = createMatchMediaMock(false);
    vi.mocked(window.matchMedia).mockReturnValue(mockMql as unknown as MediaQueryList);

    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(false);

    act(() => { mockMql._fire(true); });
    expect(result.current).toBe(true);
  });

  it('updates to false when the OS preference changes back to no preference', () => {
    mockMql = createMatchMediaMock(true);
    vi.mocked(window.matchMedia).mockReturnValue(mockMql as unknown as MediaQueryList);

    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(true);

    act(() => { mockMql._fire(false); });
    expect(result.current).toBe(false);
  });

  // ── Listener registration ────────────────────────────────────────────────
  it('registers a change listener on mount', () => {
    const { result } = renderHook(() => useReducedMotion());
    expect(mockMql.addEventListener).toHaveBeenCalledWith(
      'change',
      expect.any(Function),
    );
  });

  // ── Cleanup ──────────────────────────────────────────────────────────────
  it('removes the change listener on unmount (no memory leak)', () => {
    const { unmount } = renderHook(() => useReducedMotion());
    unmount();
    expect(mockMql.removeEventListener).toHaveBeenCalledWith(
      'change',
      expect.any(Function),
    );
  });

  it('removes the same function reference that was added', () => {
    let addedFn: ChangeHandler | undefined;
    let removedFn: ChangeHandler | undefined;

    mockMql.addEventListener.mockImplementation((_: string, fn: ChangeHandler) => {
      addedFn = fn;
    });
    mockMql.removeEventListener.mockImplementation((_: string, fn: ChangeHandler) => {
      removedFn = fn;
    });

    const { unmount } = renderHook(() => useReducedMotion());
    unmount();

    expect(addedFn).toBeDefined();
    expect(removedFn).toBeDefined();
    expect(addedFn).toBe(removedFn);
  });

  // ── matchMedia query string ──────────────────────────────────────────────
  it('queries the correct media feature string', () => {
    renderHook(() => useReducedMotion());
    expect(window.matchMedia).toHaveBeenCalledWith(
      '(prefers-reduced-motion: reduce)',
    );
  });

  // ── Multiple renders ─────────────────────────────────────────────────────
  it('returns a stable value across multiple re-renders', () => {
    mockMql = createMatchMediaMock(false);
    vi.mocked(window.matchMedia).mockReturnValue(mockMql as unknown as Media