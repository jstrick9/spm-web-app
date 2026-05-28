const fs = require('fs');

const path = 'spm-web-app/wedding-app/client/vite.config.ts';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(
  "import tailwindcss from '@tailwindcss/vite';",
  "import tailwindcss from '@tailwindcss/vite';\nimport { VitePWA } from 'vite-plugin-pwa';"
);

const pwaPlugin = `VitePWA({
      registerType: 'autoUpdate',
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
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\\/\\/fonts\\.(?:googleapis|gstatic)\\.com\\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /\\/api\\/portal\\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-portal-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 // 1 day
              },
              networkTimeoutSeconds: 10
            }
          }
        ]
      }
    })`;

code = code.replace(
  "plugins: [react(), tailwindcss()],",
  `plugins: [react(), tailwindcss(), ${pwaPlugin}],`
);

fs.writeFileSync(path, code);
