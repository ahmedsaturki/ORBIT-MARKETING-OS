import { describe, expect, it } from "vitest";
import {
  DEFAULT_RETRY_POLICY,
  completeTask,
  computeBackoffMs,
  failTerminal,
  gateTaskForExecution,
  scheduleRetry,
  shouldRetry,
} from "../src/queue/index.js";
import { evaluatePolicy } from "../src/policy/index.js";
import type { PolicyContext, QueueTask } from "../src/types/index.js";

const task: QueueTask = {
  id: "task-1",
  workspaceId: "ws-1",
  platform: "facebook",
  accountId: "acc-1",
  actionType: "post_group",
  target: "group-1",
  payload: { text: "hello" },
  status: "queued",
  priority: "normal",
  retries: 0,
  maxRetries: 3,
  scheduledTime: "2026-09-24T10:00:00.000Z",
};

const baseCtx: PolicyContext = {
  workspaceId: "ws-1",
  accountId: "acc-1",
  platform: "facebook",
  actionType: "post_group",
  now: "2026-09-24T10:00:00.000Z",
  dailyActionsDone: 5,
  dailyLimit: 35,
  accountStatus: "active",
  challengeActive: false,
  breakerOpen: false,
  approvalAllowed: true,
};

describe("queue retry policy", () => {
  it("computes exponential backoff within bounds", () => {
    const d1 = computeBackoffMs(1, DEFAULT_RETRY_POLICY, () => 0);
    const d3 = computeBackoffMs(3, DEFAULT_RETRY_POLICY, () => 0);
    expect(d1).toBeGreaterThan(0);
    expect(d3).toBeGreaterThan(d1);
    expect(d3).toBeLessThanOrEqual(DEFAULT_RETRY_POLICY.maxDelayMs);
  });

  it("respects max retries and terminal states", () => {
    expect(shouldRetry({ retries: 0, maxRetries: 2, status: "queued" })).toBe(true);
    expect(shouldRetry({ retries: 2, maxRetries: 2, status: "retrying" })).toBe(false);
    expect(shouldRetry({ retries: 0, maxRetries: 5, status: "cancelled" })).toBe(false);
    expect(shouldRetry({ retries: 0, maxRetries: 5, status: "completed" })).toBe(false);
  });

  it("retries increment counter and preserve error", () => {
    const next = scheduleRetry(task, "element not found", "2026-09-24T10:01:00.000Z");
    expect(next.status).toBe("retrying");
    expect(next.retries).toBe(1);
    expect(next.lastError).toBe("element not found");
  });

  it("completes and fails tasks deterministically", () => {
    const done = completeTask(task, "2026-09-24T10:02:00.000Z", 6.2);
    expect(done.status).toBe("completed");
    expect(done.delayAppliedSeconds).toBe(6.2);
    const failed = failTerminal(task, "boom", "2026-09-24T10:03:00.000Z");
    expect(failed.status).toBe("failed");
    expect(failed.lastError).toBe("boom");
  });
});

describe("fail-closed execution gate", () => {
  it("blocks when no policy evaluator is provided", () => {
    const result = gateTaskForExecution(task, baseCtx, undefined);
    expect(result.dispatch).toBe(false);
    expect(result.decision.allowed).toBe(false);
  });

  it("dispatches when policy allows", () => {
    const result = gateTaskForExecution(task, baseCtx, evaluatePolicy);
    expect(result.dispatch).toBe(true);
    expect(result.decision.reason).toBe("allowed");
  });

  it("blocks on daily limit", () => {
    const ctx = { ...baseCtx, dailyActionsDone: 35 };
    const result = gateTaskForExecution(task, ctx, evaluatePolicy);
    expect(result.dispatch).toBe(false);
    expect(result.decision.reason).toBe("daily_limit");
  });

  it("blocks on challenge", () => {
    const ctx = { ...baseCtx, challengeActive: true };
    const result = gateTaskForExecution(task, ctx, evaluatePolicy);
    expect(result.dispatch).toBe(false);
    expect(result.decision.reason).toBe("challenge_active");
  });

  it("blocks on open circuit", () => {
    const ctx = { ...baseCtx, breakerOpen: true };
    const result = gateTaskForExecution(task, ctx, evaluatePolicy);
    expect(result.dispatch).toBe(false);
    expect(result.decision.reason).toBe("circuit_open");
  });

  it("blocks without approval", () => {
    const ctx = { ...baseCtx, approvalAllowed: false };
    const result = gateTaskForExecution(task, ctx, evaluatePolicy);
    expect(result.dispatch).toBe(false);
    expect(result.decision.reason).toBe("approval_required");
  });
});
