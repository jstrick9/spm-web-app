import { describe, it, expect } from 'vitest';
import { translations, PORTAL_LANGUAGES } from './translations';

/**
 * i18n dictionary integrity: every locale must define EXACTLY the same key
 * set as English. A missing key silently falls back to English (a guest in
 * Spanish would see an English string mixed into their UI); an extra key is
 * dead weight. This guards future edits from drifting.
 */
describe('translations dictionary parity', () => {
  const enKeys = Object.keys(translations.en).sort();

  it('exposes the same four locales the selector offers', () => {
    expect(PORTAL_LANGUAGES).toEqual(['en', 'es', 'fr', 'zh']);
    expect(Object.keys(translations).sort()).toEqual(['en', 'es', 'fr', 'zh']);
  });

  it('every locale defines exactly the same keys as English', () => {
    for (const lang of PORTAL_LANGUAGES) {
      const keys = Object.keys(translations[lang]).sort();
      expect(keys, `${lang} must define the same key set as en`).toEqual(enKeys);
    }
  });

  it('every English value is non-empty and contains no unresolved braces', () => {
    for (const [key, value] of Object.entries(translations.en)) {
      expect(value.trim().length, `en.${key} must not be empty`).toBeGreaterThan(0);
      // '{' must pair with '}' — interpolation placeholders like {count}
      const opens = (value.match(/\{/g) || []).length;
      const closes = (value.match(/\}/g) || []).length;
      expect(opens, `en.${key} has unbalanced braces`).toBe(closes);
    }
  });

  it('translated values that contain placeholders keep the SAME placeholder names as English', () => {
    const placeholder = (v: string) => [...v.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    for (const [key, enValue] of Object.entries(translations.en)) {
      const enPlaceholders = placeholder(enValue);
      if (enPlaceholders.length === 0) continue;
      for (const lang of ['es', 'fr', 'zh'] as const) {
        const translated = translations[lang][key];
        expect(
          placeholder(translated),
          `${lang}.${key} must keep the same placeholders as en (${enPlaceholders.join(',')})`,
        ).toEqual(enPlaceholders);
      }
    }
  });
});
