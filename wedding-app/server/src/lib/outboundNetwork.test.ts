import { describe, expect, it } from 'vitest';
import { assertPublicWebhookTarget } from './outboundNetwork.js';
describe('outbound network guard', () => {
  it('rejects private literal webhook targets before network delivery', async () => {
    await expect(assertPublicWebhookTarget('http://127.0.0.1/hook')).rejects.toThrow('private address');
    await expect(assertPublicWebhookTarget('http://[::1]/hook')).rejects.toThrow('private address');
  });
});
