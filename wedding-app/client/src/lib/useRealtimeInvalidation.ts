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
    'layout.updated': (e: SSEEvent) => {
      qc.invalidateQueries({ queryKey: ['layouts'] });
      const eventId = (e.payload as any)?.eventId;
      if (eventId) qc.invalidateQueries({ queryKey: ['layouts', eventId] });
      qc.invalidateQueries({ queryKey: ['layout-approval-queue'] });
    },
    'layout.comment.resolved': (e: SSEEvent) => { qc.invalidateQueries({ queryKey: ['layout-collaboration'] }); const eventId = (e.payload as any)?.eventId; if (eventId) qc.invalidateQueries({ queryKey: ['layouts', eventId] }); },
    'layout.review.decided': (e: SSEEvent) => { qc.invalidateQueries({ queryKey: ['layout-collaboration'] }); qc.invalidateQueries({ queryKey: ['layout-approval-queue'] }); const eventId = (e.payload as any)?.eventId; if (eventId) qc.invalidateQueries({ queryKey: ['layouts', eventId] }); },
    'budget.updated': (e: SSEEvent) => {
      const eventId = (e.payload as any)?.eventId;
      if (eventId) {
        qc.invalidateQueries({ queryKey: ['budget', eventId] });
      }
    },
    // ── Staff & timeline (MODULE-05 ST-14) ──────────────────────────
    'staff.task_created': () => {
      qc.invalidateQueries({ queryKey: ['staffTasks'] });
      qc.invalidateQueries({ queryKey: ['setupChecklist'] });
    },
    'staff.task_updated': () => {
      qc.invalidateQueries({ queryKey: ['staffTasks'] });
      qc.invalidateQueries({ queryKey: ['setupChecklist'] });
      qc.invalidateQueries({ queryKey: ['staff-coverage'] });
    },
    'staff.task_deleted': () => {
      qc.invalidateQueries({ queryKey: ['staffTasks'] });
      qc.invalidateQueries({ queryKey: ['setupChecklist'] });
      qc.invalidateQueries({ queryKey: ['staff-coverage'] });
    },
    'staff.shift_created': () => {
      qc.invalidateQueries({ queryKey: ['staffShifts'] });
      qc.invalidateQueries({ queryKey: ['staff-calendar'] });
      qc.invalidateQueries({ queryKey: ['staff-coverage'] });
    },
    'staff.shift_updated': () => {
      qc.invalidateQueries({ queryKey: ['staffShifts'] });
      qc.invalidateQueries({ queryKey: ['staff-calendar'] });
      qc.invalidateQueries({ queryKey: ['staff-coverage'] });
    },
    'staff.shift_deleted': () => {
      qc.invalidateQueries({ queryKey: ['staffShifts'] });
      qc.invalidateQueries({ queryKey: ['staff-calendar'] });
      qc.invalidateQueries({ queryKey: ['staff-coverage'] });
    },
    'staff.clock_in': () => {
      qc.invalidateQueries({ queryKey: ['staffShifts'] });
      qc.invalidateQueries({ queryKey: ['staff-coverage'] });
    },
    'staff.clock_out': () => {
      qc.invalidateQueries({ queryKey: ['staffShifts'] });
      qc.invalidateQueries({ queryKey: ['staff-coverage'] });
    },
    'staff.availability.created': () => {
      qc.invalidateQueries({ queryKey: ['staffAvailability'] });
    },
    'staff.availability.deleted': () => {
      qc.invalidateQueries({ queryKey: ['staffAvailability'] });
    },
    'timeline.created': (e: SSEEvent) => {
      qc.invalidateQueries({ queryKey: ['timeline'] });
      const eventId = (e.payload as any)?.eventId;
      if (eventId) {
        qc.invalidateQueries({ queryKey: ['event-readiness', eventId] });
        qc.invalidateQueries({ queryKey: ['timeline-ops', eventId] });
      }
    },
    'timeline.updated': (e: SSEEvent) => {
      qc.invalidateQueries({ queryKey: ['timeline'] });
      const eventId = (e.payload as any)?.eventId;
      if (eventId) {
        qc.invalidateQueries({ queryKey: ['event-readiness', eventId] });
        qc.invalidateQueries({ queryKey: ['timeline-ops', eventId] });
      }
    },
    'timeline.deleted': (e: SSEEvent) => {
      qc.invalidateQueries({ queryKey: ['timeline'] });
      const eventId = (e.payload as any)?.eventId;
      if (eventId) {
        qc.invalidateQueries({ queryKey: ['event-readiness', eventId] });
        qc.invalidateQueries({ queryKey: ['timeline-ops', eventId] });
      }
    },
    'timeline.reminder': (e: SSEEvent) => {
      const eventId = (e.payload as any)?.eventId;
      if (eventId) qc.invalidateQueries({ queryKey: ['timeline-ops', eventId] });
    },
    'event.emergency_broadcast': (e: SSEEvent) => {
      const eventId = (e.payload as any)?.eventId;
      if (eventId) qc.invalidateQueries({ queryKey: ['event', eventId] });
    },
    // ── Finance & contracts (MODULE-06 FI-07) ─────────────────────────
    'contract.created': (e: SSEEvent) => {
      const eventId = (e.payload as any)?.eventId;
      if (eventId) {
        qc.invalidateQueries({ queryKey: ['contracts', eventId] });
        qc.invalidateQueries({ queryKey: ['financial-legal', eventId] });
      }
    },
    'contract.updated': (e: SSEEvent) => {
      const eventId = (e.payload as any)?.eventId;
      if (eventId) {
        qc.invalidateQueries({ queryKey: ['contracts', eventId] });
        qc.invalidateQueries({ queryKey: ['financial-legal', eventId] });
      }
    },
    'contract.deleted': (e: SSEEvent) => {
      const eventId = (e.payload as any)?.eventId;
      if (eventId) {
        qc.invalidateQueries({ queryKey: ['contracts', eventId] });
        qc.invalidateQueries({ queryKey: ['financial-legal', eventId] });
      }
    },
    'contract.signed': (e: SSEEvent) => {
      const eventId = (e.payload as any)?.eventId;
      if (eventId) {
        qc.invalidateQueries({ queryKey: ['contracts', eventId] });
        qc.invalidateQueries({ queryKey: ['financial-legal', eventId] });
      }
    },
    'payment.created': (e: SSEEvent) => {
      const eventId = (e.payload as any)?.eventId;
      if (eventId) {
        qc.invalidateQueries({ queryKey: ['payment-links', eventId] });
        qc.invalidateQueries({ queryKey: ['financial-legal', eventId] });
      }
    },
    'payment.updated': (e: SSEEvent) => {
      const eventId = (e.payload as any)?.eventId;
      if (eventId) {
        qc.invalidateQueries({ queryKey: ['payment-links', eventId] });
        qc.invalidateQueries({ queryKey: ['financial-legal', eventId] });
      }
    },
    'financial_legal.updated': (e: SSEEvent) => {
      const eventId = (e.payload as any)?.eventId;
      if (eventId) qc.invalidateQueries({ queryKey: ['financial-legal', eventId] });
    },
  });
}
