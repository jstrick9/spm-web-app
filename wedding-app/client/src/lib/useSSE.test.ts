import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSSE } from './useSSE';

// Mock the SSE module
const mockOn = vi.fn();
const mockOff = vi.fn();
const mockClose = vi.fn();
const mockConnect = vi.fn();

vi.mock('../sdk/sse', () => ({
  createSSEStream: vi.fn(() => ({
    on: mockOn,
    off: mockOff,
    close: mockClose,
    connect: mockConnect,
  })),
}));

describe('useSSE', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not connect when orgId is null', () => {
    renderHook(() => useSSE(null));
    expect(mockOn).not.toHaveBeenCalled();
  });

  it('connects and registers wildcard handler when orgId provided', () => {
    renderHook(() => useSSE('org-1', {}));
    expect(mockOn).toHaveBeenCalledWith('*', expect.any(Function));
  });

  it('cleans up on unmount', () => {
    const { unmount } = renderHook(() => useSSE('org-1'));
    unmount();
    expect(mockOff).toHaveBeenCalledWith('*', expect.any(Function));
    expect(mockClose).toHaveBeenCalled();
  });

  it('dispatches to specific event handler', () => {
    const handler = vi.fn();
    renderHook(() => useSSE('org-1', { 'guest.created': handler }));

    // Simulate an SSE event by calling the registered wildcard handler
    const wildcardHandler = mockOn.mock.calls[0][1];
    const fakeEvent = {
      id: 1,
      type: 'guest.created',
      payload: { guestId: 'g1' },
      actorUserId: 'u1',
      timestamp: '2026-01-01T00:00:00Z',
    };

    act(() => {
      wildcardHandler(fakeEvent);
    });

    expect(handler).toHaveBeenCalledWith(fakeEvent);
  });

  it('returns lastEvent after receiving an event', () => {
    const { result } = renderHook(() => useSSE('org-1'));

    const wildcardHandler = mockOn.mock.calls[0][1];
    const fakeEvent = {
      id: 42,
      type: 'event.updated',
      payload: { eventId: 'e1' },
      actorUserId: null,
      timestamp: '2026-06-01T12:00:00Z',
    };

    act(() => {
      wildcardHandler(fakeEvent);
    });

    expect(result.current.lastEvent).toEqual(fakeEvent);
    expect(result.current.isConnected).toBe(true);
  });
});
