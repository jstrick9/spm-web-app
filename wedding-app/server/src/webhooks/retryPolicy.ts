export interface RetryDecision { retry: boolean; delayMs: number | null; terminalReason: string | null; }
/** Classifies outbound webhook responses without retrying permanent client errors. */
export function webhookRetryDecision(input: { attempt: number; status?: number; retryAfter?: string | null }): RetryDecision {
  const { attempt, status, retryAfter } = input;
  const retryable = status === undefined || status === 408 || status === 425 || status === 429 || status >= 500;
  if (!retryable) return { retry: false, delayMs: null, terminalReason: `non-retryable-http-${status}` };
  if (attempt >= 3) return { retry: false, delayMs: null, terminalReason: 'retry-exhausted' };
  const retryAfterSeconds = retryAfter && /^\d+$/.test(retryAfter) ? Number(retryAfter) : null;
  return { retry: true, delayMs: retryAfterSeconds !== null ? Math.min(retryAfterSeconds * 1000, 60_000) : 1_000 * 2 ** (attempt - 1), terminalReason: null };
}
