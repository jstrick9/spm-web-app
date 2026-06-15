import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'node:path';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
      manifest: {
        name: 'Wedding Venue Intelligence',
        short_name: 'WVI Platform',
        description: 'Complete operating system for modern wedding venues.',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
    }),
  ],

  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },

  server: {
    port: 5173,
    proxy: { '/api': 'http://localhost:3000' },
  },

  build: {
    outDir: 'dist',
    sourcemap: true,

    // Heavy route/tool dependencies are lazy-loaded. html5-qrcode is now
    // dynamically imported only after an operator taps Scan, so the day-of
    // VendorCheckInApp route stays small and camera code is isolated.
    chunkSizeWarningLimit: 700,

    rollupOptions: {
      output: {
        /**
         * Split stable vendor libraries out of the main bundle so:
         *   - React runtime + Radix primitives are cached independently of app
         *     code (a deploy that only touches screens won't re-download them)
         *   - Initial parse cost is spread across parallel-fetched chunks
         *
         * IMPORTANT — only split packages that are part of the EAGER `index`
         * chunk. recharts / konva / html5-qrcode are already route-level
         * lazy-loaded (Analytics, Canvas, Check-In) — deliberately NOT listed
         * here so they stay in their own on-demand chunks rather than being
         * pulled into an eagerly-loaded vendor bundle.
         *
         * REGEX NOTE — Phase 34 fix (N5 from master review):
         * ────────────────────────────────────────────────────
         * Every rule that previously ended with [\/] (requiring a path
         * separator immediately after the package name) now ends with
         * ([\/]|$) — matching either a separator OR end-of-string.
         *
         * WHY: Rollup/Vite resolves some entry-point module IDs without a
         * trailing path segment. For example, when a package exports a single
         * ESM entry via "exports" in package.json, the resolved ID can be:
         *
         *   /project/node_modules/react         ← no trailing /
         *   /project/node_modules/react/index.js  ← with trailing /
         *
         * The old [\/]-terminated patterns only matched the second form.
         * Under certain Vite + Rollup version combinations (particularly when
         * using `optimizeDeps` or when packages use the "exports" field), the
         * first form appears and the package falls through to the importer's
         * chunk, defeating the whole point of the split.
         *
         * The fix adds ($) as an alternative to [\/] — zero cost, no false
         * positives (verified against all 6 rules × all relevant package
         * names), and future-proofs against Rollup resolution changes.
         *
         * EXCEPTION — radix-vendor intentionally has NO trailing delimiter
         * because @radix-ui/* paths are always deep
         * (e.g. @radix-ui/react-dialog/dist/...) and the scoped-package
         * prefix itself already provides sufficient specificity.
         */
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;

          // ── React runtime ────────────────────────────────────────────────
          // FIXED: ([\/]|$) instead of [\/] — catches IDs with no trailing slash
          if (/[\/]node_modules[\/](react|react-dom|scheduler|react-is)([\/]|$)/.test(id)) {
            return 'react-vendor';
          }

          // ── Radix UI primitives + floating-ui + accessibility utils ──────
          // No trailing delimiter needed — @radix-ui/* paths are always deep.
          // react-remove-scroll intentionally here (not in react-vendor) because
          // it's a Radix dependency, not part of the React runtime itself.
          if (/[\/]node_modules[\/](@radix-ui|cmdk|@floating-ui|aria-hidden|react-remove-scroll)/.test(id)) {
            return 'radix-vendor';
          }

          // ── TanStack Query ───────────────────────────────────────────────
          // FIXED: ([\/]|$) instead of [\/]
          if (/[\/]node_modules[\/]@tanstack([\/]|$)/.test(id)) {
            return 'query-vendor';
          }

          // ── Lucide icons ─────────────────────────────────────────────────
          // FIXED: ([\/]|$) instead of [\/]
          if (/[\/]node_modules[\/]lucide-react([\/]|$)/.test(id)) {
            return 'icons-vendor';
          }

          // ── date-fns ─────────────────────────────────────────────────────
          // FIXED: ([\/]|$) instead of [\/]
          // SAFE: date-fns-tz contains a "-" after "date-fns" so ([\/]|$) does
          // not match it — verified in Phase 34 audit.
          if (/[\/]node_modules[\/]date-fns([\/]|$)/.test(id)) {
            return 'date-vendor';
          }

          // ── Forms + validation ───────────────────────────────────────────
          // FIXED: ([\/]|$) instead of [\/]
          if (
            /[\/]node_modules[\/](react-hook-form|@hookform|zod|clsx|class-variance-authority|tailwind-merge)([\/]|$)/.test(
              id,
            )
          ) {
            return 'forms-vendor';
          }

          // ── QR scanner ───────────────────────────────────────────────────
          // Dynamically imported from VendorCheckInApp only after Scan is tapped.
          // Naming the async chunk keeps production build output reviewable and
          // proves html5-qrcode is no longer bundled into the day-of route chunk.
          if (/[\/]node_modules[\/]html5-qrcode([\/]|$)/.test(id)) {
            return 'qr-scanner-vendor';
          }

          // Everything else stays with its importer chunk.
          // This is deliberate: recharts, konva, and other heavy lazy-loaded
          // packages should NOT be pulled into an eagerly-loaded vendor bundle.
          return undefined;
        },
      },
    },
  },

  test: {
    environment: 'jsdom',
    globals: false,
    setupFiles: ['./src/test/setup.ts'],
    css: false,

    // Vitest 4 broadened the default test glob; pin it to src so a built
    // dist/ (or node_modules) can never be collected as a test source.
    include: ['src/**/*.test.{ts,tsx}'],
    exclude: ['dist/**', 'node_modules/**'],

    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/**/*.stories.{ts,tsx}',
        'src/test/**',
        'src/main.tsx',
        'src/App.tsx',
        'src/dual-write/QueryProvider.tsx',
        'src/sdk/types.ts',
        'src/vite-env.d.ts',
        'src/styles/**',
        'src/ui/preview/**',
        // These compose Radix primitives and get full coverage via Playwright
        // E2E tests. The higher-risk primitives (Button, Input, Card, StatCard,
        // DataTable, Toast) are covered by unit tests in Day 1.
        'src/ui/Dialog.tsx',
        'src/ui/Form.tsx',
        'src/ui/Label.tsx',
        'src/ui/Skeleton.tsx',
        'src/ui/Sparkline.tsx',
        'src/ui/Tabs.tsx',
      ],
      thresholds: {
        lines: 75,
        functions: 70,
        branches: 55,
        statements: 75,
      },
    },
  },
});
