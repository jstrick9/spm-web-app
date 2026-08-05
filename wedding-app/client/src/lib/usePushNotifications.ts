/**
 * usePushNotifications — browser push subscription lifecycle.
 *
 * This is the missing client half of the platform's push notifications
 * (the server API and service worker already exist):
 *
 *   enable()  → request permission → subscribe via the service worker
 *               PushManager (VAPID) → register the endpoint server-side
 *   disable() → unregister server-side (DELETE with the endpoint) → drop
 *               the local subscription
 *
 * The hook degrades gracefully:
 *   - unsupported browser / denied permission / missing server VAPID keys
 *     all produce a friendly `error` instead of an uncaught exception.
 *   - `enabled` reflects the real subscription on this browser, so the
 *     toggle stays in sync across reloads.
 */
import { useCallback, useEffect, useState } from 'react';
import { pushSdk } from '../sdk/push';

export interface PushNotificationState {
  /** PushManager + service worker available in this browser. */
  supported: boolean;
  /** This browser is subscribed right now. */
  enabled: boolean;
  /** Whether the server has VAPID keys (null while unknown). */
  serverConfigured: boolean | null;
  permission: NotificationPermission | 'unsupported';
  busy: boolean;
  error: string | null;
  enable: () => Promise<void>;
  disable: () => Promise<void>;
}

/** Base64url (as delivered by VAPID) → Uint8Array for pushManager.subscribe. */
function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const base64WithPadding = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64WithPadding);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) arr[i] = raw.charCodeAt(i);
  return arr;
}

export function usePushNotifications(orgId?: string): PushNotificationState {
  const [supported, setSupported] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [serverConfigured, setServerConfigured] = useState<boolean | null>(null);
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('unsupported');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
      setPermission('unsupported');
      return;
    }
    setSupported(true);
    setPermission(Notification.permission);

    let cancelled = false;
    (async () => {
      try {
        const s = await pushSdk.status();
        if (!cancelled) setServerConfigured(s.configured);
      } catch { /* offline etc — leave null */ }
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        const sub = reg ? await reg.pushManager.getSubscription() : null;
        if (!cancelled && sub) setEnabled(true);
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, []);

  const enable = useCallback(async () => {
    setError(null);
    if (!supported) { setError('Browser push isn\u2019t supported in this browser.'); return; }
    if (serverConfigured === false) { setError('Push isn\u2019t configured on this server yet — ask your admin to add VAPID keys.'); return; }
    if (!orgId) { setError('No organization selected — push needs an organization.'); return; }

    let perm: NotificationPermission;
    try {
      perm = await Notification.requestPermission();
    } catch { setError('Could not ask for notification permission.'); return; }
    setPermission(perm);
    if (perm !== 'granted') { setError('Notifications were blocked. Allow notifications for this site in your browser settings, then try again.'); return; }

    setBusy(true);
    try {
      const vapid = await pushSdk.getVapidKey();
      if (!vapid.publicKey) { setError('Push isn\u2019t configured on this server yet — ask your admin to add VAPID keys.'); return; }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapid.publicKey),
      });
      await pushSdk.subscribe({
        endpoint: sub.endpoint,
        keys: { p256dh: btoa(String.fromCharCode(...new Uint8Array(sub.getKey('p256dh')!))), auth: btoa(String.fromCharCode(...new Uint8Array(sub.getKey('auth')!))) },
        organizationId: orgId,
      });
      setEnabled(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not enable push notifications.');
    } finally {
      setBusy(false);
    }
  }, [supported, serverConfigured, orgId]);

  const disable = useCallback(async () => {
    setError(null);
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        // Unregister server-side first (best-effort), then drop locally.
        try { await pushSdk.unsubscribe(sub.endpoint); } catch { /* endpoint may already be gone */ }
        await sub.unsubscribe();
      }
      setEnabled(false);
      setPermission(Notification.permission);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not disable push notifications.');
    } finally {
      setBusy(false);
    }
  }, []);

  return { supported, enabled, serverConfigured, permission, busy, error, enable, disable };
}
