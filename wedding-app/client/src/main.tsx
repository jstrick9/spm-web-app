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
