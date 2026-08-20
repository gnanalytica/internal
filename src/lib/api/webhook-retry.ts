/**
 * Retry policy for outbound webhook delivery — pure, so it is testable without
 * a network.
 *
 * `dispatchWebhook` was fire-and-forget: one fetch, 5s timeout, record the
 * status. A receiver that is mid-redeploy loses the event permanently, which
 * pushes the burden onto every consumer's poll-back fallback.
 */
export const MAX_ATTEMPTS = 3;

/**
 * Retry on transport failure (`status === null`) and on 5xx — the receiver is
 * broken or absent, so the same request may well succeed later.
 *
 * Never retry a 4xx: the receiver understood the request and rejected it, so
 * repeating it just repeats the rejection (and a 410 is an explicit "stop").
 */
export function shouldRetry(status: number | null, attempt: number): boolean {
  if (attempt >= MAX_ATTEMPTS - 1) return false;
  if (status === null) return true;
  return status >= 500;
}

/** Backoff before the attempt at `index` (0 = the first retry). */
export function backoffMs(index: number): number {
  return [1000, 4000][index] ?? 4000;
}
