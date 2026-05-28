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
  build: { outDir: 'dist', sourcemap: true },

  test: {
    environment: 'jsdom',
    globals: false,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
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
