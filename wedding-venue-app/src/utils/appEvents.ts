/**
 * Centralized, typed application event bus.
 *
 * Why this exists
 * ---------------
 * Components used to call `window.dispatchEvent(new CustomEvent('spm_*'))` directly
 * and other components subscribed via raw `window.addEventListener('spm_*', ...)`.
 * Because both sides were stringly typed, it was impossible for the compiler to
 * tell us when a dispatcher had no listener — that gap caused the
 * "Open Decor Designer" button to silently do nothing for an entire release.
 *
 * Rules
 * -----
 *  - Add every cross-component `window` event to {@link AppEventMap}.
 *  - Use {@link emit} to dispatch and {@link on} to subscribe — never raw
 *    `window.dispatchEvent` / `window.addEventListener` for `spm_*` events.
 *  - Detail payloads are typed; `void` means "no payload".
 *
 * The runtime behavior is intentionally unchanged from the previous raw
 * `CustomEvent` approach so that legacy listeners (in tests, third-party
 * extensions, etc.) keep working during incremental migration.
 */

/** Reasons a `spm_data_changed` event may fire. Keep in sync with persistence helpers. */
export type DataChangedType =
  | 'all'
  | 'venues'
  | 'tableSpecs'
  | 'fixtureTypes'
  | 'guidelines'
  | 'templates'
  | 'chairs'
  | 'chairSpecs'
  | 'linenColors'
  | 'wallStyles'
  | 'spacing'
  | 'alignment'
  | 'indoorTemplates'
  | 'outdoorTemplates'
  | 'decorItems'
  | 'decorCategories'
  | 'decorArrangements'
  | 'decorPackages'
  // Allow ad-hoc string types for future domains without breaking the build.
  | (string & {});


/** Payload for the `spm_storage_error` event emitted by the versioned storage layer. */
export interface StorageErrorDetail {
  /** localStorage key that triggered the error. */
  key: string;
  /** Human-readable error message. */
  error: string;
  /** Whether the failure happened during a `save` or `load` operation. */
  action: 'save' | 'load';
  /** ISO 8601 timestamp of the failure. */
  timestamp: string;
}

/** Snapshot pushed by the layout to the undo/redo stack. */
export interface UndoSnapshot {
  tables: unknown[];
  fixtures: unknown[];
  decor: unknown[];
  timestamp: number;
}

/**
 * The single source of truth for every `spm_*` event flowing through `window`.
 * Add new events here; the compiler will then guide every emitter & subscriber.
 */
export interface AppEventMap {
  /** Open the floating Vendor panel modal. */
  spm_open_vendors: void;
  /** Open the floating Timeline panel modal. */
  spm_open_timeline: void;
  /** Open the Decor Designer; optionally preload an existing arrangement. */
  spm_open_decor_designer: { arrangementId?: string } | void;
  /** Open the workspace help / shortcuts modal. */
  spm_open_workspace_help: void;
  /** Some persisted store mutated; subscribers should refresh from `localStorage`. */
  spm_data_changed: { type: DataChangedType } | void;
  /** A new undo snapshot is available for the undo/redo stack. */
  spm_push_undo_snapshot: UndoSnapshot;
  /**
   * The versioned storage layer hit a save/load error (e.g. quota exceeded,
   * corrupt JSON). Subscribers (e.g. a global toast) should surface it to the user.
   */
  spm_storage_error: StorageErrorDetail;
}

export type AppEventName = keyof AppEventMap;

/**
 * Strongly-typed dispatcher. The compiler verifies that the payload shape
 * matches what {@link AppEventMap} declares for the given event name.
 *
 * @example
 *   emit('spm_open_decor_designer', { arrangementId: 'abc' });
 *   emit('spm_open_vendors');
 */
export function emit<K extends AppEventName>(
  ...args: AppEventMap[K] extends void
    ? [name: K]
    : [name: K, detail: AppEventMap[K]]
): void {
  const [name, detail] = args as [K, AppEventMap[K] | undefined];
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(name, { detail }));
}

/**
 * Strongly-typed subscriber. Returns an unsubscribe function — useful inside
 * `useEffect` cleanups to avoid `removeEventListener` boilerplate.
 *
 * @example
 *   useEffect(() => on('spm_open_decor_designer', (detail) => {
 *     setEditingArrangementId(detail?.arrangementId);
 *     setShowDecorDesigner(true);
 *   }), []);
 */
export function on<K extends AppEventName>(
  name: K,
  handler: (detail: AppEventMap[K] extends void ? undefined : AppEventMap[K]) => void,
): () => void {
  if (typeof window === 'undefined') return () => {};
  const listener = (event: Event) => {
    const detail = (event as CustomEvent).detail;
    handler(detail as never);
  };
  window.addEventListener(name, listener);
  return () => window.removeEventListener(name, listener);
}

/**
 * Convenience wrapper for the most common `spm_data_changed` pattern.
 * Equivalent to `emit('spm_data_changed', { type })` but reads better at the
 * many call sites in `useLayoutState.ts` / `data/venueData.ts`.
 */
export function emitDataChanged(type: DataChangedType = 'all'): void {
  emit('spm_data_changed', { type });
}
