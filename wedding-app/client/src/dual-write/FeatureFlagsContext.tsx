/**
 * React context + provider for feature flags.
 *
 * Wrap your app in <FeatureFlagsProvider> once. Then components use
 * `useFeatureFlag('guests')` to get the current mode, and the admin
 * control panel uses `useSetFeatureFlag` to flip flags at runtime.
 */
import {
  createContext, useCallback, useContext, useMemo, useState,
  type ReactNode,
} from 'react';
import {
  ALL_DOMAINS, loadFlags, saveFlags,
  type Domain, type DomainMode, type FeatureFlags,
} from './featureFlags.js';

interface Ctx {
  flags: FeatureFlags;
  setFlag: (domain: Domain, mode: DomainMode) => void;
  setAll: (mode: DomainMode) => void;
  reset: () => void;
}

const FeatureFlagsContext = createContext<Ctx | null>(null);

export function FeatureFlagsProvider({ children }: { children: ReactNode }) {
  const [flags, setFlags] = useState<FeatureFlags>(() => loadFlags());

  const setFlag = useCallback((domain: Domain, mode: DomainMode) => {
    setFlags((prev) => {
      const next = { ...prev, [domain]: mode };
      saveFlags(next);
      return next;
    });
  }, []);

  const setAll = useCallback((mode: DomainMode) => {
    setFlags((prev) => {
      const next = { ...prev };
      for (const d of ALL_DOMAINS) next[d] = mode;
      saveFlags(next);
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    setFlags(loadFlags());
  }, []);

  const value = useMemo(() => ({ flags, setFlag, setAll, reset }), [flags, setFlag, setAll, reset]);

  return (
    <FeatureFlagsContext.Provider value={value}>
      {children}
    </FeatureFlagsContext.Provider>
  );
}

export function useFeatureFlags(): Ctx {
  const ctx = useContext(FeatureFlagsContext);
  if (!ctx) throw new Error('useFeatureFlags must be inside FeatureFlagsProvider');
  return ctx;
}

export function useFeatureFlag(domain: Domain): DomainMode {
  return useFeatureFlags().flags[domain];
}
