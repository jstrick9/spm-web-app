import { getToken } from './client.js';

export interface SSEEvent {
  id: number;
  type: string;
  payload: Record<string, unknown>;
  actorUserId: string | null;
  timestamp: string;
}

export type SSEEventHandler = (event: SSEEvent) => void;

/**
 * Create a managed SSE connection to the org event stream.
 * Returns an object with subscribe/unsubscribe/close methods.
 *
 * Usage:
 *   const stream = createSSEStream(orgId);
 *   stream.on('guest.created', (e) => { ... });
 *   stream.on('*', (e) => { ... }); // wildcard
 *   // later:
 *   stream.close();
 */
export function createSSEStream(orgId: string) {
  let eventSource: EventSource | null = null;
  let lastId = 0;
  let connectedAt = 0;
  let refreshTimer: ReturnType<typeof setTimeout> | null = null;
  const handlers = new Map<string, Set<SSEEventHandler>>();

  async function connect() {
    const mainToken = getToken();
    if (!mainToken) return;

    // Fetch a short-lived SSE token (5 min) instead of exposing the main 12h JWT in URLs
    try {
      const res = await fetch(`/api/orgs/${orgId}/sse-token`, {
        headers: { authorization: `Bearer ${mainToken}` },
      });
      if (!res.ok) return;
      const { token: sseToken } = await res.json();
      if (!sseToken) return;

      const url = `/api/orgs/${orgId}/events/stream?token=${encodeURIComponent(sseToken)}&lastId=${lastId}`;
      eventSource = new EventSource(url);
      // SSE tokens are short-lived (5 min) so the main JWT never appears in
      // URLs. Refresh the token BEFORE it expires: on expiry the server
      // closes the stream and EventSource would otherwise retry the SAME
      // dead token forever, silently killing real-time updates.
      connectedAt = Date.now();
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => {
        close();
        connect();
      }, 4 * 60 * 1000);
    } catch {
      return; // SSE not available — degrade gracefully
    }

    eventSource.onmessage = (e) => {
      try {
        const data: SSEEvent = JSON.parse(e.data);
        lastId = Math.max(lastId, data.id);

        // Fire type-specific handlers
        const typeHandlers = handlers.get(data.type);
        if (typeHandlers) {
          for (const h of typeHandlers) h(data);
        }

        // Fire wildcard handlers
        const wildcardHandlers = handlers.get('*');
        if (wildcardHandlers) {
          for (const h of wildcardHandlers) h(data);
        }
      } catch {
        // Ignore malformed events
      }
    };

    eventSource.onerror = () => {
      // EventSource will automatically reconnect
      // We don't need to do anything special
    };
  }

  function on(eventType: string, handler: SSEEventHandler) {
    if (!handlers.has(eventType)) {
      handlers.set(eventType, new Set());
    }
    handlers.get(eventType)!.add(handler);

    // Auto-connect on first handler
    if (!eventSource) {
      connect();
    }
  }

  function off(eventType: string, handler: SSEEventHandler) {
    const set = handlers.get(eventType);
    if (set) {
      set.delete(handler);
      if (set.size === 0) handlers.delete(eventType);
    }

    // Auto-disconnect when no handlers left
    if (handlers.size === 0) {
      close();
    }
  }

  function close() {
    if (refreshTimer) { clearTimeout(refreshTimer); refreshTimer = null; }
    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }
  }

  return { on, off, close, connect };
}
