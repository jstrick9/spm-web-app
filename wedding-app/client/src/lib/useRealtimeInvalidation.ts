/**
 * useRealtimeInvalidation — Auto-invalidates React Query caches
 * when real-time SSE events arrive from the server.
 *
 * Also dispatches a custom DOM event ('wvi:sse-event') that the
 * NotificationCenter listens to for real-time notification display.
 *
 * Event-to-query mapping:
 *   guest.created   → ['guests', *], ['org-guests', *]
 *   guest.updated   → ['guests', *], ['org-guests', *]
 *   rsvp.submitted  → ['guests', *], ['org-guests', *]
 *   event.created   → ['events', *]
 *   event.updated   → ['events', *], ['event', eventId]
 *   budget.updated  → ['budget', eventId]
 */
import { useQueryClient } from '@tanstack/react-query';
import { useSSE } from './useSSE';
import type { SSEEvent } from '../sdk/sse';

function notifyUI(e: SSEEvent) {
  // Dispatch a CustomEvent so the NotificationCenter can pick it up
  // without being tightly coupled to this hook
  window.dispatchEvent(new CustomEvent('wvi:sse-event', { detail: e }));
}

export function useRealtimeInvalidation(orgId: string | null) {
  const qc = useQueryClient();

  useSSE(orgId, {
    '*': (e: SSEEvent) => {
      // Forward every SSE event to the notification system
      notifyUI(e);
    },
    'guest.created': () => {
      qc.invalidateQueries({ queryKey: ['guests'] });
      qc.invalidateQueries({ queryKey: ['org-guests'] });
    },
    'guest.updated': () => {
      qc.invalidateQueries({ queryKey: ['guests'] });
      qc.invalidateQueries({ queryKey: ['org-guests'] });
    },
    'rsvp.submitted': () => {
      qc.invalidateQueries({ queryKey: ['guests'] });
      qc.invalidateQueries({ queryKey: ['org-guests'] });
    },
    'event.created': () => {
      qc.invalidateQueries({ queryKey: ['events'] });
    },
    'event.updated': (e: SSEEvent) => {
      qc.invalidateQueries({ queryKey: ['events'] });
      const eventId = (e.payload as any)?.eventId;
      if (eventId) {
        qc.invalidateQueries({ queryKey: ['event', eventId] });
      }
    },
    'budget.updated': (e: SSEEvent) => {
      const eventId = (e.payload as any)?.eventId;
      if (eventId) {
        qc.invalidateQueries({ queryKey: ['budget', eventId] });
      }
    },
  });
}
