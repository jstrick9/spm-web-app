/**
 * unhandledErrorBus — tiny pub/sub for errors that no component chose to
 * handle itself.
 *
 * Why this exists: TanStack Query mutations that omit `onError` fail
 * *silently* (the promise rejects, React logs a console error, and the user
 * sees nothing). A global safety net in `QueryProvider` catches those and
 * routes them here; `ToastProvider` subscribes and shows a destructive
 * toast. Components that DO handle their own errors are skipped entirely
 * (no double toasts), and "offline" / "unauthorized" errors are excluded
 * because the offline write-queue and the auth flow own those.
 *
 * This is intentionally framework-free so it can be wired in either
 * direction without provider-ordering constraints.
 */
import { ApiError } from '../sdk/client.js';

type Listener = (error: unknown) => void;

const listeners = new Set<Listener>();

/** Emit an error to every subscriber (no-op when nobody is listening). */
export function emitUnhandledError(error: unknown): void {
  for (const fn of listeners) fn(error);
}

/** Subscribe; returns an unsubscribe function. */
export function subscribeUnhandledErrors(fn: Listener): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

/**
 * Human-friendly copy for the safety-net toast. Branching on the ApiError
 * kinds gives users actionable wording ("you don't have permission")
 * instead of a raw HTTP code.
 */
export function describeUnhandledError(err: unknown): { title: string; description?: string } {
  const fallback = err instanceof Error ? err.message : undefined;
  if (err instanceof ApiError) {
    switch (err.kind) {
      case 'forbidden':
        return { title: 'Permission needed', description: 'You do not have permission to do that. Ask an owner or admin if you think this is wrong.' };
      case 'not-found':
        return { title: 'Not found', description: 'That item no longer exists — it may have been removed by someone else.' };
      case 'conflict':
        return { title: 'Could not save', description: err.message || 'The record changed since you loaded it. Refresh and try again.' };
      case 'validation':
        return { title: 'Check your input', description: err.message };
      case 'server':
        return { title: 'Server error', description: err.message || 'The server hit an unexpected error. Please try again.' };
      case 'unauthorized':
        return { title: 'Session expired', description: 'Please sign in again.' };
      case 'offline':
        return { title: 'You are offline', description: "This change wasn't saved. Reconnect and try again." };
      default:
        break;
    }
  }
  return { title: 'Something went wrong', description: fallback };
}
