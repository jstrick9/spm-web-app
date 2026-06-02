/**
 * useReducedMotion — WCAG 2.1 SC 2.3.3 compliance hook.
 *
 * Returns true when the user has enabled "Reduce motion" in their OS or
 * browser accessibility settings. Components should skip or minimise
 * animations when this is true.
 *
 * Usage:
 *   const reduced = useReducedMotion();
 *   <div className={cn('hero', !reduced && 'animate-fade-in-up')}>…</div>
 */
import { useEffect, useState } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

export function useReducedMotion(): boolean {
  const [prefersReduced, setPrefersReduced] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(QUERY).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mql = window.matchMedia(QUERY);
    const handler = (e: MediaQueryListEvent) => setPrefersReduced(e.matches);
    // Use addEventListener (modern) with addEventListener fallback
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  return prefersReduced;
}
