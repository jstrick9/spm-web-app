import React, { useEffect, useState } from 'react';

import { RefreshCw } from 'lucide-react';

/**
 * "Update available" prompt driven by the service worker's own lifecycle
 * events. The SW is registered explicitly in main.tsx (the plugin's
 * virtual:pwa-register module compiled to a no-op stub in this build), so
 * this component listens to `updatefound`/`controllerchange` directly
 * instead of depending on the plugin's client.
 *
 * Flow: a new SW installs in the background → `waiting` state → prompt →
 * user clicks Reload → `messageSkipWaiting()` → `controllerchange` fires →
 * reload the page onto the new version.
 *
 * NOTE: the reload is ALWAYS user-initiated. An automatic reload on
 * `controllerchange` turned out to be dangerous: on first install the SW
 * takes control mid-session and a naive handler reloads the page out from
 * under the user (and in edge cases — e.g. the SW re-activating on refresh
 * — it produced a reload loop that burned the API rate budget). We only
 * show the banner; the user decides when to apply the update.
 */
export function ReloadPrompt() {
  const [needRefresh, setNeedRefresh] = useState(false);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    const onUpdateFound = (registration: ServiceWorkerRegistration) => {
      const sw = registration.waiting;
      if (!sw) return;
      sw.addEventListener('statechange', () => {
        // installed but not yet active → a new version is ready to take over.
        if (sw.state === 'installed' && navigator.serviceWorker.controller) {
          setNeedRefresh(true);
        }
      });
    };

    navigator.serviceWorker.getRegistration().then((reg) => {
      if (reg) {
        reg.addEventListener('updatefound', () => onUpdateFound(reg));
        // Also catch an update that already finished installing.
        if (reg.waiting && navigator.serviceWorker.controller) setNeedRefresh(true);
      }
    });

    return () => {
      // no-op cleanup (listeners die with the registration)
    };
  }, []);

  const reloadToLatest = async () => {
    const reg = await navigator.serviceWorker.getRegistration();
    if (reg?.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' });
    // Reload once the new SW has taken control (or immediately as a fallback).
    const onControllerChange = () => window.location.reload();
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange, { once: true });
    setTimeout(() => window.location.reload(), 2500);
    setNeedRefresh(false);
  };

  if (!needRefresh) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[200] max-w-sm rounded-lg border border-border bg-surface p-4 shadow-elev-2 animate-in slide-in-from-bottom-4">
      <div className="flex-1">
        <h3 className="text-sm font-semibold text-fg">Update Available</h3>
        <p className="text-sm text-fg-muted mt-1">A new version of the app is ready. Reload to update.</p>
      </div>
      <div className="mt-3 flex gap-2">
        <button
          onClick={() => void reloadToLatest()}
          className="shrink-0 flex items-center justify-center bg-brand text-brand-fg hover:bg-brand-strong rounded-md text-sm font-medium px-3 h-8"
        >
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Reload
        </button>
        <button
          onClick={() => setNeedRefresh(false)}
          className="shrink-0 text-fg-subtle hover:text-fg text-xs underline"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
