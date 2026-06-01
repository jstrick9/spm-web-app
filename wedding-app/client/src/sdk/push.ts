import { api } from './client.js';

export const pushSdk = {
  getVapidKey(): Promise<{ publicKey: string }> {
    return api.get('/api/push/vapid-key', { auth: false });
  },

  subscribe(input: {
    endpoint: string;
    keys: { p256dh: string; auth: string };
    organizationId: string;
  }): Promise<{ subscription: { id: string } }> {
    return api.post('/api/push/subscribe', input);
  },

  unsubscribe(endpoint: string): Promise<{ ok: boolean }> {
    return api.delete('/api/push/subscribe', { body: { endpoint } } as any);
  },

  listSubscriptions(): Promise<{ subscriptions: Array<{ id: string; endpoint: string; createdAt: string }> }> {
    return api.get('/api/push/subscriptions');
  },
};
