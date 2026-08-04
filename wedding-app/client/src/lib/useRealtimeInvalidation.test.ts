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

  // MODULE-05 ST-14: staff + timeline SSE events must invalidate caches.
  it('registers handlers for every staff and timeline event', () => {
    renderWithQC();
    for (const type of [
      'staff.task_created', 'staff.task_updated', 'staff.task_deleted',
      'staff.shift_created', 'staff.shift_updated', 'staff.shift_deleted',
      'staff.clock_in', 'staff.clock_out',
      'staff.availability.created', 'staff.availability.deleted',
      'timeline.created', 'timeline.updated', 'timeline.deleted',
      'timeline.reminder', 'event.emergency_broadcast',
    ]) {
      expect(capturedHandlers[type], type).toBeDefined();
    }
  });

  it('timeline.created invalidates timeline, readiness, and ops for the event', () => {
    renderWithQC();
    const spy = vi.spyOn(qc, 'invalidateQueries');
    capturedHandlers['timeline.created']({
      id: 3, type: 'timeline.created', payload: { eventId: 'evt-9' }, actorUserId: null, timestamp: '',
    });
    expect(spy).toHaveBeenCalledWith({ queryKey: ['timeline'] });
    expect(spy).toHaveBeenCalledWith({ queryKey: ['event-readiness', 'evt-9'] });
    expect(spy).toHaveBeenCalledWith({ queryKey: ['timeline-ops', 'evt-9'] });
  });

  it('staff.shift_created invalidates shifts, calendar, and coverage caches', () => {
    renderWithQC();
    const spy = vi.spyOn(qc, 'invalidateQueries');
    capturedHandlers['staff.shift_created']({
      id: 4, type: 'staff.shift_created', payload: {}, actorUserId: null, timestamp: '',
    });
    expect(spy).toHaveBeenCalledWith({ queryKey: ['staffShifts'] });
    expect(spy).toHaveBeenCalledWith({ queryKey: ['staff-calendar'] });
    expect(spy).toHaveBeenCalledWith({ queryKey: ['staff-coverage'] });
  });

  // MODULE-06 FI-07: contract + payment events must invalidate finance caches.
  it('registers handlers for every contract and payment event', () => {
    renderWithQC();
    for (const type of ['contract.created', 'contract.updated', 'contract.deleted', 'contract.signed', 'payment.created', 'payment.updated', 'financial_legal.updated']) {
      expect(capturedHandlers[type], type).toBeDefined();
    }
  });

  it('contract.signed invalidates contracts + financial-legal for the event', () => {
    renderWithQC();
    const spy = vi.spyOn(qc, 'invalidateQueries');
    capturedHandlers['contract.signed']({
      id: 5, type: 'contract.signed', payload: { eventId: 'evt-7' }, actorUserId: null, timestamp: '',
    });
    expect(spy).toHaveBeenCalledWith({ queryKey: ['contracts', 'evt-7'] });
    expect(spy).toHaveBeenCalledWith({ queryKey: ['financial-legal', 'evt-7'] });
  });

  it('payment.updated invalidates payment-links + financial-legal for the event', () => {
    renderWithQC();
    const spy = vi.spyOn(qc, 'invalidateQueries');
    capturedHandlers['payment.updated']({
      id: 6, type: 'payment.updated', payload: { eventId: 'evt-7' }, actorUserId: null, timestamp: '',
    });
    expect(spy).toHaveBeenCalledWith({ queryKey: ['payment-links', 'evt-7'] });
    expect(spy).toHaveBeenCalledWith({ queryKey: ['financial-legal', 'evt-7'] });
  });
});
