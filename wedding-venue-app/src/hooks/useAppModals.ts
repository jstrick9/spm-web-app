import { useCallback, useEffect, useState } from 'react';
import { on } from '../utils/appEvents';

/**
 * Names of every top-level modal/panel that {@link AuthenticatedApp} renders.
 *
 * Centralizing them in one place — instead of scattering ~10 `useState` flags
 * across `App.tsx` — is what made it possible to reliably wire up the
 * `spm_open_decor_designer` event after the original regression.
 */
export type ModalName =
  | 'guests'
  | 'admin'
  | 'templates'
  | 'print'
  | 'operations'
  | 'messages'
  | 'submission'
  | 'eventQuestions'
  | 'decorDesigner'
  | 'vendors'
  | 'timeline'
  | 'properties';

/**
 * `useAppModals` owns the open/close state for every modal in `App.tsx` and,
 * crucially, owns the subscriptions to the typed `spm_open_*` event bus.
 *
 * Splitting this concern out of `App.tsx`:
 *  - shrinks App.tsx by ~50 LOC of state-management glue,
 *  - co-locates the dispatcher (`appEvents.ts`) with its handlers, so the next
 *    person who adds a Sidebar button can grep one file to find the wiring,
 *  - and makes the wiring itself unit-testable (see `useAppModals.test.ts`).
 *
 * Behavior is intentionally a 1:1 replacement for the original inline
 * `useState` + `useEffect` blocks; nothing else in App.tsx needs to change
 * besides destructuring this hook.
 */
export interface UseAppModalsResult {
  /** Map of `ModalName -> isOpen`. */
  modals: Record<ModalName, boolean>;
  /** Convenience: imperative open. */
  open: (name: ModalName) => void;
  /** Convenience: imperative close. Also clears any per-modal payload. */
  close: (name: ModalName) => void;
  /** Toggle helper for menu buttons. */
  toggle: (name: ModalName) => void;
  /**
   * The arrangement to preload into the Decor Designer when it opens via the
   * `spm_open_decor_designer` event. `undefined` means "start blank".
   */
  editingArrangementId: string | undefined;
  /** Manually set the editing arrangement id (e.g. from a different code path). */
  setEditingArrangementId: (id: string | undefined) => void;
}

const INITIAL_MODAL_STATE: Record<ModalName, boolean> = {
  guests: false,
  admin: false,
  templates: false,
  print: false,
  operations: false,
  messages: false,
  submission: false,
  eventQuestions: false,
  decorDesigner: false,
  vendors: false,
  timeline: false,
  properties: false,
};

export function useAppModals(): UseAppModalsResult {
  const [modals, setModals] = useState<Record<ModalName, boolean>>(INITIAL_MODAL_STATE);
  const [editingArrangementId, setEditingArrangementId] = useState<string | undefined>(undefined);

  const open = useCallback((name: ModalName) => {
    setModals((prev) => (prev[name] ? prev : { ...prev, [name]: true }));
  }, []);

  const close = useCallback((name: ModalName) => {
    setModals((prev) => (prev[name] ? { ...prev, [name]: false } : prev));
    // Reset per-modal payload state on close so re-opening starts clean.
    if (name === 'decorDesigner') setEditingArrangementId(undefined);
  }, []);

  const toggle = useCallback((name: ModalName) => {
    setModals((prev) => ({ ...prev, [name]: !prev[name] }));
  }, []);

  // ---- Event-bus → modal wiring ---------------------------------------------
  // These three subscriptions used to live as separate `useEffect` blocks in
  // `App.tsx`. Centralizing them here means any new `spm_open_*` event can be
  // added in one place rather than two.
  useEffect(() => on('spm_open_vendors', () => open('vendors')), [open]);
  useEffect(() => on('spm_open_timeline', () => open('timeline')), [open]);
  useEffect(
    () =>
      on('spm_open_decor_designer', (detail) => {
        setEditingArrangementId(detail?.arrangementId);
        open('decorDesigner');
      }),
    [open],
  );

  return { modals, open, close, toggle, editingArrangementId, setEditingArrangementId };
}
