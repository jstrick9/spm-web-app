import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/global.css';
import { QueryProvider } from './dual-write/QueryProvider';
import { FeatureFlagsProvider } from './dual-write/FeatureFlagsContext';
import { startSyncMonitor } from './dual-write/syncMonitor';
import { startAutoReplay } from './dual-write/writeQueue';
import { ToastProvider } from './ui/Toast';

startSyncMonitor();
startAutoReplay();

/**
 * Register the service worker explicitly.
 *
 * vite-plugin-pwa's `virtual:pwa-register` client module compiled to a
 * no-op stub in this build (injectManifest strategy), so the SW never
 * registered and the PWA had NO offline shell, NO push, and NO update
 * prompt in production. Deterministic registration fixes all three.
 * sw.ts calls skipWaiting() + clientsClaim(), so it activates and takes
 * control immediately after install.
 */
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { type: 'module' }).catch((err) => {
      console.error('Service worker registration failed:', err);
    });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryProvider showDevtools={import.meta.env.DEV}>
      <FeatureFlagsProvider>
        <ToastProvider>
          <App />
        </ToastProvider>
      </FeatureFlagsProvider>
    </QueryProvider>
  </StrictMode>
);
