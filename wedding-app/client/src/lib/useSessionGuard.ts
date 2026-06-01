/**
 * useSessionGuard — Watches for 401 "unauthorized" API errors globally.
 *
 * When a JWT expires mid-session (e.g. user leaves the tab open overnight),
 * the next API call returns 401. This hook:
 *   1. Listens for 'request-error' events with kind='unauthorized'
 *   2. Shows a toast explaining the session expired
 *   3. Clears the token
 *   4. The PlatformApp component will detect the missing token and show the login screen
 *
 * This prevents the confusing UX of silent 401 failures with no feedback.
 */
import { useEffect, useRef } from 'react';
import { subscribe, setToken, type ClientEvent } from '../sdk/client';

export function useSessionGuard(
  toast: (opts: { title: string; description?: string; variant?: string }) => void,
  onSessionExpired?: () => void,
) {
  const handledRef = useRef(false);

  useEffect(() => {
    const unsub = subscribe((event: ClientEvent) => {
      if (event.kind !== 'request-error') return;
      if (event.error.kind !== 'unauthorized') return;

      // Only handle once per session to avoid toast spam
      if (handledRef.current) return;
      handledRef.current = true;

      toast({
        title: 'Session expired',
        description: 'Please sign in again to continue.',
        variant: 'destructive',
      });

      // Clear the token — PlatformApp will detect this and show login
      setTimeout(() => {
        setToken(null);
        onSessionExpired?.();
      }, 1500);
    });

    return unsub;
  }, [toast, onSessionExpired]);
}
