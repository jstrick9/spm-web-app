import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useRealtimeInvalidation } from './useRealtimeInvalidation';

// Track what useSSE receives
let capturedHandlers: Record<string, (e: any) => void> = {};

vi.mock('./useSSE', () => ({
  useSSE: (_orgId: string | null, handlers: Record<string, (e: any) => void> = {}) => {
    capturedHandlers = handlers;
    return { lastEvent: null, isConnected: false };
  },
}));

describe('useRealtimeInvalidation', () => {
  let qc: QueryClient;

  beforeEach(() => {
    qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    capturedHandlers = {};
  });

  function renderWithQC() {
    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: qc }, children);
    return renderHook(() => useRealtimeInvalidation('org1'), { wrapper });
  }

  it('registers handlers for guest and event events', () => {
    renderWithQC();
    expect(capturedHandlers['guest.created']).toBeDefined();
    expect(capturedHandlers['guest.updated']).toBeDefined();
    expect(capturedHandlers['rsvp.submitted']).toBeDefined();
    expect(capturedHandlers['event.created']).toBeDefined();
    expect(capturedHandlers['event.updated']).toBeDefined();
  });

  it('guest.created handler invalidates guests queries', () => {
    renderWithQC();
    const spy = vi.spyOn(qc, 'invalidateQueries');
    capturedHandlers['guest.created']({
      id: 1, type: 'guest.created', payload: {}, actorUserId: null, timestamp: '',
    });
    expect(spy).toHaveBeenCalledWith({ queryKey: ['guests'] });
    expect(spy).toHaveBeenCalledWith({ queryKey: ['org-guests'] });
  });

  it('event.updated handler invalidates both events list and specific event', () => {
    renderWithQC();
    const spy = vi.spyOn(qc, 'invalidateQueries');
    capturedHandlers['event.updated']({
      id: 2, type: 'event.updated',
      payload: { eventId: 'e123' },
      actorUserId: 'u1', timestamp: '',
    });
    expect(spy).toHaveBeenCalledWith({ queryKey: ['events'] });
    expect(spy).toHaveBeenCalledWith({ queryKey: ['event', 'e123'] });
  });

  it('does not crash when orgId is null', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: qc }, children);
    expect(() => {
      renderHook(() => useRealtimeInvalidation(null), { wrapper });
    }).not.toThrow();
  });
});
