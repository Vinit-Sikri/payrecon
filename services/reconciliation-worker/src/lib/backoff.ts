/** Exponential backoff with jitter, capped at maxMs, for transient reconciliation failures. */
export function computeBackoffMs(attempt: number, baseMs = 1000, maxMs = 60_000): number {
  const exp = Math.min(maxMs, baseMs * 2 ** Math.max(0, attempt - 1));
  const jitter = Math.random() * exp * 0.2;
  return Math.round(exp + jitter);
}
