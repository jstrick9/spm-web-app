import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSessionGuard } from './useSessionGuard';

// We need to mock the subscribe function
const mockUnsub = vi.fn();
let capturedListener: ((e: any) => void) | null = null;

vi.mock('../sdk/client', () => ({
  subscribe: vi.fn((fn) => {
    capturedListener = fn;
    return mockUnsub;
  }),
  setToken: vi.fn(),
}));

describe('useSessionGuard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    capturedListener = null;
    vi.useFakeTimers();
  });

  it('subscribes to client events on mount', () => {
    const toast = vi.fn();
    renderHook(() => useSessionGuard(toast));
    expect(capturedListener).toBeTruthy();
  });

  it('unsubscribes on unmount', () => {
    const toast = vi.fn();
    const { unmount } = renderHook(() => useSessionGuard(toast));
    unmount();
    expect(mockUnsub).toHaveBeenCalled();
  });

  it('shows toast on unauthorized error', () => {
    const toast = vi.fn();
    renderHook(() => useSessionGuard(toast));

    act(() => {
      capturedListener?.({
        kind: 'request-error',
        error: { kind: 'unauthorized', status: 401, code: 'unauthenticated' },
        method: 'GET',
        path: '/api/auth/me',
        ms: 50,
      });
    });

    expect(toast).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Session expired',
    }));
  });

  it('ignores non-unauthorized errors', () => {
    const toast = vi.fn();
    renderHook(() => useSessionGuard(toast));

    act(() => {
      capturedListener?.({
        kind: 'request-error',
        error: { kind: 'server', status: 500, code: 'internal' },
        method: 'GET',
        path: '/api/events',
        ms: 100,
      });
    });

    expect(toast).not.toHaveBeenCalled();
  });

  it('only fires once per session (no spam)', () => {
    const toast = vi.fn();
    renderHook(() => useSessionGuard(toast));

    act(() => {
      capturedListener?.({ kind: 'request-error', error: { kind: 'unauthorized' }, method: 'GET', path: '/a', ms: 1 });
      capturedListener?.({ kind: 'request-error', error: { kind: 'unauthorized' }, method: 'GET', path: '/b', ms: 2 });
      capturedListener?.({ kind: 'request-error', error: { kind: 'unauthorized' }, method: 'GET', path: '/c', ms: 3 });
    });

    expect(toast).toHaveBeenCalledTimes(1);
  });
});
