/**
 * ThemeProvider — applies the resolved theme by writing CSS variables onto
 * <html>. This is HOT-RELOADABLE: change a single token in the config,
 * and every component that uses the var updates instantly (no remount).
 *
 * This is what makes the live-preview Theme Studio work.
 *
 *   <ThemeProvider config={resolved}>{children}</ThemeProvider>
 *
 * Sibling responsibilities:
 *   - ConfigProvider holds the resolved config in React context
 *   - ThemeProvider only writes DOM (so it can be used standalone in
 *     the live-preview pane without rerendering the whole app)
 */
import { useEffect } from 'react';
import type { ThemeConfig } from './schema.js';

function loadGoogleFont(font: string) {
  if (typeof document === 'undefined') return;
  // Ignore standard system fonts
  const systemFonts = ['Inter', 'system-ui', 'sans-serif', 'serif', 'Georgia', 'system-sans', 'system-mono', 'system-serif'];
  if (systemFonts.includes(font)) return;
  const id = `gfont-${font.toLowerCase().replace(/\s+/g, '-')}`;
  if (document.getElementById(id)) return;

  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(font)}:wght@300;400;500;600;700;800&display=swap`;
  document.head.appendChild(link);
}

/** Apply theme variables to a root element (default <html>). */
export function applyTheme(theme: ThemeConfig, root: HTMLElement = document.documentElement): void {
  const setVar = (name: string, value: string) => root.style.setProperty(name, value);

  // Dynamic Google Font Injection
  if (theme.fontDisplay) loadGoogleFont(theme.fontDisplay);
  if (theme.fontBody) loadGoogleFont(theme.fontBody);

  // Colors
  setVar('--color-brand',         theme.brand);
  setVar('--color-brand-strong',  theme.brandStrong);
  setVar('--color-brand-soft',    theme.brandSoft);
  setVar('--color-accent',        theme.accent);
  setVar('--color-accent-soft',   theme.accentSoft);
  setVar('--color-bg',            theme.bg);
  setVar('--color-surface',       theme.surface);
  setVar('--color-surface-2',     theme.surface2);
  setVar('--color-border',        theme.border);
  setVar('--color-fg',            theme.fg);
  setVar('--color-fg-muted',      theme.fgMuted);

  // Density → spacing scale (we override the DEFAULT control height)
  const densityHeight = { compact: '32', comfortable: '40', spacious: '48' }[theme.density];
  setVar('--height-control', `${densityHeight}px`);
  const densityGap = { compact: '8', comfortable: '12', spacious: '16' }[theme.density];
  setVar('--gap-default', `${densityGap}px`);

  // Radius
  const radiusValue = { sharp: '4', soft: '12', pill: '24' }[theme.radius];
  setVar('--radius-card', `${radiusValue}px`);

  // Motion
  const motionScale = { minimal: '0.5', standard: '1', expressive: '1.4' }[theme.motion];
  setVar('--motion-scale', motionScale);

  // Color scheme: 'system' lets the inline script in index.html decide; we
  // only flip the class if the admin explicitly picks light or dark.
  if (theme.colorScheme === 'dark')        root.classList.add('dark');
  else if (theme.colorScheme === 'light')  root.classList.remove('dark');
  // 'system' → don't touch; respect whatever the inline script set.

  // Typography — write to a CSS var; global.css consumes it.
  setVar('--font-display', `'${theme.fontDisplay}', Georgia, serif`);
  setVar('--font-body',    `'${theme.fontBody}', system-ui, sans-serif`);
  setVar('--font-mono',    `'${theme.fontMono}', ui-monospace, monospace`);
}

/**
 * React wrapper for the imperative applyTheme. Drop this near the
 * top of the tree. On unmount it does nothing (themes don't clear).
 */
export function ThemeProvider({ theme, children }: { theme: ThemeConfig; children: React.ReactNode }) {
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);
  return <>{children}</>;
}
