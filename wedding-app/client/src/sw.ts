import { clientsClaim } from 'workbox-core';
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { NetworkFirst, CacheFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { BackgroundSyncPlugin } from 'workbox-background-sync';

// @ts-nocheck
declare let self: any;

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST || []);
self.skipWaiting();
clientsClaim();

// 1. Static Assets Cache (Google Fonts)
registerRoute(
  /^https:\/\/(fonts\.googleapis\.com|fonts\.gstatic\.com)\/.*/i,
  new CacheFirst({
    cacheName: 'google-fonts',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 20,
        maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
      }),
    ],
  })
);

// 2. Network First for Public Portal Read APIs (Offline Fallback)
registerRoute(
  /\/api\/portal\/.*/i,
  new NetworkFirst({
    cacheName: 'api-portal-cache',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 60 * 60 * 24, // 1 day
      }),
    ],
    networkTimeoutSeconds: 5,
  })
);

// 3. BACKGROUND SYNC (Offline Check-Ins / Operations)
// When a staff member is checking in vendors on an iPad in the parking lot and loses WiFi,
// the requests are caught by this BackgroundSync plugin. When WiFi returns, Workbox automatically replays them.
const bgSyncPlugin = new BackgroundSyncPlugin('wvi-offline-queue', {
  maxRetentionTime: 24 * 60, // Retry for max of 24 Hours
});

registerRoute(
  /\/api\/staff\/tasks\/.*/i,
  new NetworkFirst({
    plugins: [bgSyncPlugin]
  }),
  'PATCH'
);

registerRoute(
  /\/api\/events\/.*\/checkins/i,
  new NetworkFirst({
    plugins: [bgSyncPlugin]
  }),
  'POST'
);


// 4. PUSH NOTIFICATIONS API
self.addEventListener('push', (event: any) => {
  if (!event.data) return;
  
  try {
    const data = event.data.json();
    const title = data.title || 'WVI Alert';
    const options = {
      body: data.body || 'You have a new notification.',
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      data: data.url ? { url: data.url } : undefined,
      vibrate: [100, 50, 100],
      tag: data.tag || 'wvi-general',
      renotify: true,
    };
    
    event.waitUntil(self.registration.showNotification(title, options));
  } catch (err) {
    // Fallback if payload isn't JSON
    event.waitUntil(
      self.registration.showNotification('WVI Alert', {
        body: event.data.text(),
        icon: '/pwa-192x192.png'
      })
    );
  }
});

self.addEventListener('notificationclick', (event: any) => {
  event.notification.close();
  
  // If the push notification payload included a specific URL (like a specific event detail page)
  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients: any[]) => {
      // If we already have the app open, focus it and navigate
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(urlToOpen);
          return client.focus();
        }
      }
      // Otherwise open a new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(urlToOpen);
      }
    })
  );
});
