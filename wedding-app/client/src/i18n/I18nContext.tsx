import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { translations, type PortalLanguage } from './translations';

export const I18N_STORAGE_KEY = 'wvi_guest_language';

export interface I18nApi {
  lang: PortalLanguage;
  /** Switch the portal language (persists locally; caller may also persist server-side). */
  setLang: (lang: PortalLanguage) => void;
  /** Translate a key with optional {var} interpolation. Falls back to en, then the key. */
  t: (key: string, vars?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nApi | null>(null);

function isPortalLanguage(value: string | null | undefined): value is PortalLanguage {
  return value === 'en' || value === 'es' || value === 'fr' || value === 'zh';
}

function readStoredLanguage(): PortalLanguage {
  try {
    const saved = localStorage.getItem(I18N_STORAGE_KEY);
    if (isPortalLanguage(saved)) return saved;
  } catch {
    /* storage unavailable — default to en */
  }
  return 'en';
}

function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    vars[key] !== undefined ? String(vars[key]) : match,
  );
}

/**
 * Guest portal i18n provider. Language resolution order:
 *   1. `initialLang` (server-saved preference from the portal info payload)
 *   2. localStorage (`wvi_guest_language`)
 *   3. 'en'
 * Every language change persists to localStorage immediately and notifies
 * the caller through `onLangChange` (used to sync to the guest record).
 */
export function I18nProvider({
  initialLang,
  onLangChange,
  children,
}: {
  initialLang?: PortalLanguage;
  onLangChange?: (lang: PortalLanguage) => void;
  children: ReactNode;
}) {
  const [lang, setLangState] = useState<PortalLanguage>(() =>
    isPortalLanguage(initialLang) ? initialLang : readStoredLanguage(),
  );

  // The server preference may arrive AFTER first render (portal info is
  // fetched async) — adopt it once, unless the guest already switched
  // languages locally in this session.
  useEffect(() => {
    if (isPortalLanguage(initialLang)) {
      setLangState((current) => {
        const stored = readStoredLanguage();
        // If the user explicitly chose a language in this session it wins
        // over the stale server value (they may be on a shared device).
        return current;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setLang = useCallback(
    (next: PortalLanguage) => {
      if (!isPortalLanguage(next)) return;
      setLangState(next);
      try {
        localStorage.setItem(I18N_STORAGE_KEY, next);
      } catch {
        /* ignore */
      }
      onLangChange?.(next);
    },
    [onLangChange],
  );

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>): string => {
      const table = translations[lang] ?? translations.en;
      const template = table[key] ?? translations.en[key] ?? key;
      return interpolate(template, vars);
    },
    [lang],
  );

  const value = useMemo<I18nApi>(() => ({ lang, setLang, t }), [lang, setLang, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nApi {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within an I18nProvider');
  return ctx;
}
