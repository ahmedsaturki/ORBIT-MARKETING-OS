export interface RetryPolicy {
  readonly maxAttempts: number;
  readonly baseDelayMs: number;
  readonly maxDelayMs: number;
}

export function calculateRetryDelay(
  attempt: number,
  policy: RetryPolicy,
): number {
  if (!Number.isInteger(attempt) || attempt < 1) {
    throw new RangeError("attempt must be a positive integer");
  }
  if (policy.maxAttempts < 1 || policy.baseDelayMs < 0 || policy.maxDelayMs < policy.baseDelayMs) {
    throw new RangeError("invalid retry policy");
  }

  const exponential = policy.baseDelayMs * 2 ** (attempt - 1);
  return Math.min(exponential, policy.maxDelayMs);
}

export function shouldRetry(attempt: number, policy: RetryPolicy): boolean {
  if (!Number.isInteger(attempt) || attempt < 0) {
    throw new RangeError("attempt must be a non-negative integer");
  }
  return attempt < policy.maxAttempts;
}
