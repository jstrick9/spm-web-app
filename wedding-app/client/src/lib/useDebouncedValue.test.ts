import { renderHook, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDebouncedValue } from './useDebouncedValue';

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

describe('useDebouncedValue', () => {
  it('returns the initial value immediately', () => {
    const { result } = renderHook(() => useDebouncedValue('hi', 100));
    expect(result.current).toBe('hi');
  });

  it('debounces updates by the configured delay', () => {
    const { result, rerender } = renderHook(
      ({ v }: { v: string }) => useDebouncedValue(v, 200),
      { initialProps: { v: 'a' } },
    );
    rerender({ v: 'b' });
    expect(result.current).toBe('a');
    act(() => { vi.advanceTimersByTime(199); });
    expect(result.current).toBe('a');
    act(() => { vi.advanceTimersByTime(2); });
    expect(result.current).toBe('b');
  });

  it('resets the timer on rapid changes (last write wins)', () => {
    const { result, rerender } = renderHook(
      ({ v }: { v: string }) => useDebouncedValue(v, 100),
      { initialProps: { v: 'a' } },
    );
    rerender({ v: 'b' });
    act(() => { vi.advanceTimersByTime(50); });
    rerender({ v: 'c' });
    act(() => { vi.advanceTimersByTime(50); });
    expect(result.current).toBe('a');     // still old because 100ms hasn't elapsed since 'c'
    act(() => { vi.advanceTimersByTime(60); });
    expect(result.current).toBe('c');
  });
});
