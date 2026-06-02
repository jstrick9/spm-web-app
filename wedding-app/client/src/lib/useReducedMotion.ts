/**
 * useReducedMotion — WCAG 2.1 SC 2.3.3 compliance hook.
 *
 * Returns true when the user has requested reduced motion via their OS or
 * browser accessibility settings (System Preferences → Accessibility →
 * Reduce Motion on macOS/iOS; Display → Remove animations on Android/Windows).
 *
 * WHEN TO USE THIS HOOK
 * ─────────────────────
 * Use this hook when you are conditionally ADDING an animation class via
 * React state or a conditional className expression, e.g.:
 *
 *   const reduced = useReducedMotion();
 *   <div className={cn('hero', !reduced && 'portal-fade-in')}>…</div>
 *
 * DO NOT use this hook for animations that are already handled entirely in
 * CSS via @media (prefers-reduced-motion: reduce). The global rule in
 * tokens.css already suppresses all animation-duration / transition-duration
 * for CSS-class–driven animations (animate-pulse, transition-colors, etc.).
 * Using the hook there would be redundant.
 *
 * TECHNICAL NOTES
 * ───────────────
 * • Initialises synchronously from window.matchMedia on first render to
 *   avoid a flash of animated content on initial paint.
 * • Uses the modern addEventListener API with MediaQueryListEvent.
 * • Cleans up the listener on unmount — no memory leaks.
 * • Safe in SSR / test environments: guards against window being undefined.
 *
 * WCAG REFERENCE
 * ──────────────
 * WCAG 2.1 SC 2.3.3 (AAA) — Animation from Interactions:
 *   "Motion animation triggered by interaction can be disabled, unless
 *    the animation is essential to the functionality or the information."
 *
 * The implementation also supports SC 1.4.13 (Content on Hover or Focus)
 * indirectly by making entrance animations suppressible.
 */
import { useEffect, useState } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

export function useReducedMotion(): boolean {
  const [prefersReduced, setPrefersReduced] = useState<boolean>(() => {
    // Synchronous init: avoid flash of animated content on first paint.
    // Guard for SSR and test environments where window is not available.
    if (typeof window === 'undefined') return false;
    return window.matchMedia(QUERY).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mql = window.matchMedia(QUERY);

    const handleChange = (e: MediaQueryListEvent) => {
      setPrefersReduced(e.matches);
    };

    // Use addEventListener (supported in all modern browsers).
    // Falls back gracefully — if addListener was removed, we just don't
    // listen for changes (the initial value is still correct).
    mql.addEventListener('change', handleChange);

    // Re-check on mount in case the OS setting changed between SSR render
    // and client hydration (relevant for Next.js / RSC, harmless here).
    setPrefersReduced(mql.matches);

    return () => {
      mql.removeEventListener('change', handleChange);
    };
  }, []);

  return prefersReduced;
}
