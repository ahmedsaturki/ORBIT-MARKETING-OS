import { describe, expect, it } from "vitest";
import { validateCampaign, validateTask } from "../src/campaigns/validation.js";
import { calculateRetryDelay, shouldRetry } from "../src/queue/retry.js";
import { redactRecord } from "../src/security/redaction.js";

describe("campaign validation", () => {
  it("accepts a valid campaign", () => {
    const result = validateCampaign({
      id: "camp-1",
      workspaceId: "workspace-1",
      name: "Launch",
      status: "draft",
      accountIds: ["acc-1"],
      taskCount: 4,
      createdAt: new Date(0).toISOString(),
    });

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("rejects campaigns without accounts", () => {
    const result = validateCampaign({
      id: "camp-1",
      name: "Launch",
      status: "draft",
      accountIds: [],
      taskCount: 4,
      createdAt: new Date(0).toISOString(),
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("at least one account is required");
  });
});

describe("retry policy", () => {
  it("caps exponential backoff", () => {
    const policy = { maxAttempts: 5, baseDelayMs: 500, maxDelayMs: 4000 };
    expect(calculateRetryDelay(1, policy)).toBe(500);
    expect(calculateRetryDelay(4, policy)).toBe(4000);
    expect(calculateRetryDelay(5, policy)).toBe(4000);
  });

  it("stops after the configured attempt budget", () => {
    const policy = { maxAttempts: 3, baseDelayMs: 250, maxDelayMs: 2000 };
    expect(shouldRetry(1, policy)).toBe(true);
    expect(shouldRetry(3, policy)).toBe(false);
  });
});

describe("redaction", () => {
  it("removes credential values recursively", () => {
    const result = redactRecord({
      username: "demo",
      token: "sensitive",
      nested: { password: "secret", value: 42 },
    });

    expect(result).toEqual({
      username: "demo",
      token: "[REDACTED]",
      nested: { password: "[REDACTED]", value: 42 },
    });
  });
});
