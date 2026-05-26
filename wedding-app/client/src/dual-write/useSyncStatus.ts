/** React hook wrapping subscribeSyncStatus. */
import { useEffect, useState } from 'react';
import { getSyncStatus, subscribeSyncStatus, type SyncStatus } from './syncMonitor.js';

export function useSyncStatus(): SyncStatus {
  const [s, setS] = useState<SyncStatus>(() => getSyncStatus());
  useEffect(() => subscribeSyncStatus(setS), []);
  return s;
}
