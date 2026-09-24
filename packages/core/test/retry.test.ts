import { describe, expect, it } from "vitest";
import { calculateRetryDelay, shouldRetry, type RetryPolicy } from "../src/queue/retry.js";

const policy: RetryPolicy = {
  maxAttempts: 3,
  baseDelayMs: 1_000,
  maxDelayMs: 8_000,
};

describe("retry policy", () => {
  it("calculates bounded exponential delays", () => {
    expect(calculateRetryDelay(1, policy)).toBe(1_000);
    expect(calculateRetryDelay(2, policy)).toBe(2_000);
    expect(calculateRetryDelay(3, policy)).toBe(4_000);
  });

  it("stops retrying at the configured attempt budget", () => {
    expect(shouldRetry(0, policy)).toBe(true);
    expect(shouldRetry(2, policy)).toBe(true);
    expect(shouldRetry(3, policy)).toBe(false);
  });

  it("rejects unsafe retry policies consistently", () => {
    const unsafe = { ...policy, maxAttempts: 11 };
    expect(() => calculateRetryDelay(1, unsafe)).toThrow("invalid retry policy");
    expect(() => shouldRetry(0, unsafe)).toThrow("invalid retry policy");
  });

  it("rejects non-finite delay configuration", () => {
    const unsafe = { ...policy, maxDelayMs: Number.POSITIVE_INFINITY };
    expect(() => calculateRetryDelay(1, unsafe)).toThrow("invalid retry policy");
  });
});
