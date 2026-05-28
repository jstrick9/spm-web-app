import React from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';

import { RefreshCw } from 'lucide-react';

export function ReloadPrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      // Periodically check for updates
      if (r) {
        setInterval(() => {
          r.update();
        }, 60 * 60 * 1000); // 1 hour
      }
    },
    onRegisterError(error) {
      console.error('SW registration error', error);
    },
  });

  if (!needRefresh) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[200] max-w-sm rounded-lg border border-border bg-surface p-4 shadow-elev-2 animate-in slide-in-from-bottom-4">
      <div className="flex gap-4 items-start">
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-fg">Update Available</h3>
          <p className="text-sm text-fg-muted mt-1">A new version of the app is ready. Reload to update.</p>
        </div>
        <button 
          onClick={() => updateServiceWorker(true)}
          className="shrink-0 flex items-center justify-center bg-brand text-brand-fg hover:bg-brand-strong rounded-md text-sm font-medium px-3 h-8"
        >
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" /> Reload
        </button>
      </div>
      <button 
        onClick={() => setNeedRefresh(false)}
        className="absolute top-2 right-2 text-fg-subtle hover:text-fg text-xs underline"
      >
        Dismiss
      </button>
    </div>
  );
}
