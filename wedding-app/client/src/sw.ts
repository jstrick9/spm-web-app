import { sanitizeNotificationUrl } from './lib/swUrl';
import { clientsClaim } from 'workbox-core';
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { NetworkFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { BackgroundSyncPlugin } from 'workbox-background-sync';

// @ts-nocheck
declare let self: any;

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST || []);
self.skipWaiting();
clientsClaim();

// 1. Network First for Public Portal READ APIs (Offline Fallback)
// GET-only: POST endpoints (RSVP submit, help requests, privacy requests,
// memory submissions, guest feedback) must reach the server and are handled
// by the app's own offline write queue — never intercepted or cached here.
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
  }),
  'GET'
);

// 2. BACKGROUND SYNC (staff task updates)
// Staff-task PATCHes are queued by the service worker when the network is
// down. NOTE: vendor check-ins are deliberately NOT routed here — the app's
// own persistent write queue (dual-write/writeQueue.ts) owns those, because
// it gives the user visible feedback ("Saved on this device") and replays
// deterministically on reconnect. Two queues for the same writes would
// double-replay and silently swallow the app's offline UX.
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
  /\/api\/portal\/vendors\/.*\/questionnaire/i,
  new NetworkFirst({
    plugins: [bgSyncPlugin]
  }),
  'POST'
);

registerRoute(
  /\/api\/portal\/vendors\/.*\/messages/i,
  new NetworkFirst({
    plugins: [bgSyncPlugin]
  }),
  'POST'
);


// 3. PUSH NOTIFICATIONS API
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

  // If the push notification payload included a specific URL (like a specific
  // event detail page), sanitize it: only same-origin paths or app hash routes
  // are allowed. A crafted push payload must never navigate the browser to an
  // arbitrary origin (open-redirect / phishing surface).
  const urlToOpen = sanitizeNotificationUrl(event.notification.data?.url, self.location.origin);

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
