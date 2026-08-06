# CSP-FONTS-THEME-FIX-1 — brand fonts were blocked; dark-mode flash

Found via console inspection during e2e runs: the production server's CSP
(`style-src 'self' 'unsafe-inline'`, `script-src 'self'`) was silently
breaking two things on every page load:

## 1. Google Fonts never loaded (brand typography missing)
`index.html` referenced `fonts.googleapis.com/css2?family=Inter|Fraunces|JetBrains+Mono`,
but the CSP blocked the stylesheet (`style-src 'self'`) AND the font files
(`font-src` fell back to `default-src 'self'`). Inter / Fraunces / JetBrains
Mono **never loaded in production** — every screen fell back to system
fonts. The service worker even precached a dead `google-fonts` CacheFirst
route for it.

**Fix — self-host the fonts** (`client/public/fonts/`):
- Downloaded the latin + latin-ext woff2 subsets for all 3 families
  (18 files, ~1 MB; same OFL-licensed files Google serves).
- `fonts/fonts.css` declares the same @font-face rules with same-origin
  relative URLs → CSP-clean (`font-src 'self'`), precached by the SW, and
  fully offline-capable (external fonts would break offline anyway).
- `index.html` now links `/fonts/fonts.css`; preconnects + external link
  removed.
- Removed the dead `google-fonts` CacheFirst SW route (+ unused imports).

## 2. Dark-mode pre-paint script was blocked (theme flash)
The inline `<script>` in `index.html` that applies the `dark` class before
first paint was **blocked by `script-src 'self'`** (console: "Executing
inline script violates CSP"). Dark-mode users saw a light flash on every
load, and `html.dark` applied late (if at all).

**Fix** — moved it to `client/public/theme-init.js` (external, same-origin,
CSP-clean, precached, still runs before paint from `<head>`).

## Regression coverage
New `e2e/fonts.e2e.spec.ts`:
- zero CSP violation console errors on load;
- `document.fonts.load()` succeeds for Fraunces, Inter, JetBrains Mono
  (honest assertion — `check()` is false for declared-but-unused faces);
- `.font-display` computed font-family resolves to Fraunces;
- `html.dark` applied by theme-init.js when the theme preference is dark;
- `/theme-init.js` and `/fonts/fonts.css` served 200.

Also caught en route: removing the `ExpirationPlugin` import while the
`api-portal-cache` route still used it would have broken SW registration —
the pwa e2e spec caught it (SW never became ready); import restored.

## Verification
- e2e: 11 tests (10 prior + fonts) — full suite green except a known
  pre-existing tour-modal flake in happy-path (passes in isolation).
- Client unit suite: 935 passed. Server: 684 passed.
