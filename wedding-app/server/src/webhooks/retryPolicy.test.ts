import { describe, expect, it } from 'vitest';
import { webhookRetryDecision } from './retryPolicy.js';
describe('webhook retry policy', () => {
  it('retries transient failures and honors bounded Retry-After', () => {
    expect(webhookRetryDecision({ attempt: 1, status: 500 })).toMatchObject({ retry: true, delayMs: 1000 });
    expect(webhookRetryDecision({ attempt: 1, status: 429, retryAfter: '120' })).toMatchObject({ retry: true, delayMs: 60000 });
  });
  it('does not retry permanent 4xx failures or exhausted attempts', () => {
    expect(webhookRetryDecision({ attempt: 1, status: 400 })).toMatchObject({ retry: false, terminalReason: 'non-retryable-http-400' });
    expect(webhookRetryDecision({ attempt: 3, status: 503 })).toMatchObject({ retry: false, terminalReason: 'retry-exhausted' });
  });
});
