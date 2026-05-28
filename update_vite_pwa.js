const fs = require('fs');

const path = 'spm-web-app/wedding-app/client/vite.config.ts';
let code = fs.readFileSync(path, 'utf8');

const pwaConfig = `VitePWA({
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
    })`;

code = code.replace(/VitePWA\(\{[\s\S]*?\}\)\]/, pwaConfig + "],");

fs.writeFileSync(path, code);
