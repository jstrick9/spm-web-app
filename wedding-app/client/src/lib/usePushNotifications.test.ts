import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { usePushNotifications } from './usePushNotifications';

vi.mock('../sdk/push', () => ({
  pushSdk: {
    status: vi.fn().mockResolvedValue({ configured: true }),
    getVapidKey: vi.fn().mockResolvedValue({ publicKey: 'vapid-public-key' }),
    subscribe: vi.fn().mockResolvedValue({ subscription: { id: 'sub-1' } }),
    unsubscribe: vi.fn().mockResolvedValue({ ok: true }),
  },
}));

import { pushSdk } from '../sdk/push';

function makeBrowserMocks(overrides: { existingSub?: boolean; permission?: NotificationPermission } = {}) {
  const subscription = {
    endpoint: 'https://push.example.com/endpoint-1',
    getKey: (name: string) => new TextEncoder().encode(`key-${name}`),
    unsubscribe: vi.fn().mockResolvedValue(true),
  };
  const pushManager = {
    getSubscription: vi.fn().mockResolvedValue(overrides.existingSub ? subscription : null),
    subscribe: vi.fn().mockResolvedValue(subscription),
  };
  const registration = { pushManager, active: {} as ServiceWorkerRegistration };
  const sw = {
    getRegistration: vi.fn().mockResolvedValue(registration),
    ready: Promise.resolve(registration),
  };
  Object.defineProperty(navigator, 'serviceWorker', { value: sw, configurable: true, writable: true });
  (globalThis as any).Notification = class {
    static permission: NotificationPermission = overrides.permission ?? 'default';
    static requestPermission = vi.fn().mockResolvedValue(overrides.permission ?? 'granted');
  };
  (globalThis as any).PushManager = class {};
  return { subscription, pushManager, sw };
}

beforeEach(() => {
  vi.clearAllMocks();
  delete (globalThis as any).Notification;
  delete (globalThis as any).PushManager;
  delete (navigator as any).serviceWorker;
});

describe('usePushNotifications', () => {
  it('reports unsupported browsers and never calls the SDK', () => {
    const { result } = renderHook(() => usePushNotifications('org-1'));
    expect(result.current.supported).toBe(false);
    expect(result.current.permission).toBe('unsupported');
    expect(result.current.enabled).toBe(false);
    expect(pushSdk.status).not.toHaveBeenCalled();
  });

  it('detects an existing subscription on mount', async () => {
    makeBrowserMocks({ existingSub: true });
    const { result } = renderHook(() => usePushNotifications('org-1'));
    await waitFor(() => expect(result.current.enabled).toBe(true));
    expect(result.current.supported).toBe(true);
  });

  it('enable() subscribes via the push manager and registers server-side', async () => {
    makeBrowserMocks();
    const { result } = renderHook(() => usePushNotifications('org-1'));
    await act(async () => {
      await result.current.enable();
    });
    expect(pushSdk.subscribe).toHaveBeenCalledTimes(1);
    const args = (pushSdk.subscribe as any).mock.calls[0][0];
    expect(args.organizationId).toBe('org-1');
    expect(args.endpoint).toBe('https://push.example.com/endpoint-1');
    expect(args.keys.p256dh).toBeTruthy();
    expect(args.keys.auth).toBeTruthy();
    expect(result.current.enabled).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it('enable() with denied permission shows a friendly error and stays off', async () => {
    makeBrowserMocks({ permission: 'denied' });
    const { result } = renderHook(() => usePushNotifications('org-1'));
    await act(async () => {
      await result.current.enable();
    });
    expect(result.current.enabled).toBe(false);
    expect(result.current.error).toMatch(/blocked/i);
    expect(pushSdk.subscribe).not.toHaveBeenCalled();
  });

  it('enable() without server VAPID keys explains the admin step', async () => {
    makeBrowserMocks();
    (pushSdk.status as any).mockResolvedValueOnce({ configured: false });
    const { result } = renderHook(() => usePushNotifications('org-1'));
    await waitFor(() => expect(result.current.serverConfigured).toBe(false));
    await act(async () => {
      await result.current.enable();
    });
    expect(result.current.error).toMatch(/VAPID/i);
    expect(result.current.enabled).toBe(false);
  });

  it('enable() without an org tells the user', async () => {
    makeBrowserMocks();
    const { result } = renderHook(() => usePushNotifications(undefined));
    await act(async () => {
      await result.current.enable();
    });
    expect(result.current.error).toMatch(/organization/i);
  });

  it('disable() unregisters server-side then locally', async () => {
    makeBrowserMocks({ existingSub: true });
    const { result } = renderHook(() => usePushNotifications('org-1'));
    await waitFor(() => expect(result.current.enabled).toBe(true));
    await act(async () => {
      await result.current.disable();
    });
    expect(pushSdk.unsubscribe).toHaveBeenCalledWith('https://push.example.com/endpoint-1');
    expect(result.current.enabled).toBe(false);
  });
});
