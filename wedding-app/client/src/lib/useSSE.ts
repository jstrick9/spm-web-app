/**
 * useSSE — React hook for subscribing to Server-Sent Events.
 *
 * Usage:
 *   const { lastEvent, isConnected } = useSSE(orgId, {
 *     'guest.created': (e) => { queryClient.invalidateQueries(['guests']); },
 *     'rsvp.submitted': (e) => { queryClient.invalidateQueries(['guests']); },
 *   });
 *
 * The hook manages the SSE connection lifecycle:
 *   - Connects when the component mounts
 *   - Reconnects automatically on disconnect (EventSource built-in)
 *   - Cleans up on unmount
 *   - Deduplicates connections per orgId
 */
import { useEffect, useRef, useState } from 'react';
import { createSSEStream, type SSEEvent, type SSEEventHandler, type SSEConnectionStatus } from '../sdk/sse';

type EventHandlerMap = Record<string, SSEEventHandler>;

interface UseSSEResult {
  lastEvent: SSEEvent | null;
  isConnected: boolean;
}

export function useSSE(
  orgId: string | null,
  handlers: EventHandlerMap = {}
): UseSSEResult {
  const [lastEvent, setLastEvent] = useState<SSEEvent | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const streamRef = useRef<ReturnType<typeof createSSEStream> | null>(null);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!orgId) return;

    const stream = createSSEStream(orgId);
    streamRef.current = stream;
    const offStatus = stream.onStatus((status: SSEConnectionStatus) => {
      setIsConnected(status === 'open');
    });

    // Register all handlers
    const wildcard: SSEEventHandler = (event) => {
      setLastEvent(event);
      setIsConnected(true);

      // Dispatch to specific handler if registered
      const handler = handlersRef.current[event.type];
      if (handler) handler(event);

      // Also check wildcard
      const star = handlersRef.current['*'];
      if (star) star(event);
    };

    stream.on('*', wildcard);

    return () => {
      offStatus();
      stream.off('*', wildcard);
      stream.close();
      streamRef.current = null;
      setIsConnected(false);
    };
  }, [orgId]);

  return { lastEvent, isConnected };
}
