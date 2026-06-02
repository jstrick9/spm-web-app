import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'node:path';

export default defineConfig({
  plugins: [react(), tailwindcss(), VitePWA({
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
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    })],
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
    // The only chunk above the default 500 kB is VendorCheckInApp (it bundles
    // the html5-qrcode scanner) — and that chunk is route-level lazy-loaded, so
    // it never blocks initial page load. Eager chunks (index + vendor splits)
    // are all well under this after the manualChunks split below.
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        /**
         * Split the large, stable vendor libraries out of the main bundle so:
         *   - the React runtime + Radix primitives are cached independently of
         *     app code (a deploy that only touches screens won't re-download them)
         *   - the initial parse cost is spread across parallel-fetched chunks
         *
         * IMPORTANT: only split packages that are part of the EAGER `index`
         * chunk. recharts / konva / html5-qrcode are already route-level
         * lazy-loaded (Analytics, Canvas, Check-In) — deliberately NOT listed
         * here so they stay in their own on-demand chunks rather than being
         * pulled into an eagerly-loaded vendor bundle.
         */
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (/[\\/]node_modules[\\/](react|react-dom|scheduler|react-is)[\\/]/.test(id)) {
            return 'react-vendor';
          }
          if (/[\\/]node_modules[\\/](@radix-ui|cmdk|@floating-ui|aria-hidden|react-remove-scroll)/.test(id)) {
            return 'radix-vendor';
          }
          if (/[\\/]node_modules[\\/]@tanstack[\\/]/.test(id)) {
            return 'query-vendor';
          }
          if (/[\\/]node_modules[\\/]lucide-react[\\/]/.test(id)) {
            return 'icons-vendor';
          }
          if (/[\\/]node_modules[\\/]date-fns[\\/]/.test(id)) {
            return 'date-vendor';
          }
          if (/[\\/]node_modules[\\/](react-hook-form|@hookform|zod|clsx|class-variance-authority|tailwind-merge)[\\/]/.test(id)) {
            return 'forms-vendor';
          }
          return undefined; // everything else stays with its importer (keeps lazy chunks intact)
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
        // Day 1: these compose Radix primitives. They get full coverage
        // via Playwright E2E tests in Day 10 when Forms + Tabs + Dialog
        // power actual screens. Day 1 tests cover the higher-risk
        // primitives (Button, Input, Card, StatCard, DataTable, Toast).
        'src/ui/Dialog.tsx',
        'src/ui/Form.tsx',
        'src/ui/Label.tsx',
        'src/ui/Skeleton.tsx',
        'src/ui/Sparkline.tsx',
        'src/ui/Tabs.tsx',
      ],
      thresholds: {
        lines:      75,
        functions:  70,
        branches:   55,
        statements: 75,
      },
    },
  },
});
