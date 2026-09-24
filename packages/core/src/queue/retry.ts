export interface RetryPolicy {
  readonly maxAttempts: number;
  readonly baseDelayMs: number;
  readonly maxDelayMs: number;
}

function validateRetryPolicy(policy: RetryPolicy): void {
  if (
    !Number.isInteger(policy.maxAttempts) ||
    policy.maxAttempts < 1 ||
    policy.maxAttempts > 10 ||
    !Number.isFinite(policy.baseDelayMs) ||
    policy.baseDelayMs < 0 ||
    !Number.isFinite(policy.maxDelayMs) ||
    policy.maxDelayMs < policy.baseDelayMs
  ) {
    throw new RangeError("retryPolicy.maxAttempts must be an integer between 1 and 10");
  }
}

export function calculateRetryDelay(
  attempt: number,
  policy: RetryPolicy,
): number {
  if (!Number.isInteger(attempt) || attempt < 1) {
    throw new RangeError("attempt must be a positive integer");
  }
  validateRetryPolicy(policy);

  const exponential = policy.baseDelayMs * 2 ** (attempt - 1);
  return Math.min(exponential, policy.maxDelayMs);
}

export function shouldRetry(attempt: number, policy: RetryPolicy): boolean {
  if (!Number.isInteger(attempt) || attempt < 0) {
    throw new RangeError("attempt must be a non-negative integer");
  }
  validateRetryPolicy(policy);
  return attempt < policy.maxAttempts;
}
