import { describe, expect, it } from "vitest";
import { evaluateExecutionPolicy } from "../src/workflows/executionPolicy.js";
import type { Campaign, SocialAccount, Task } from "../src/types/index.js";

const account: SocialAccount = {
  id: "account-1",
  workspaceId: "workspace-1",
  platform: "facebook",
  displayName: "Test account",
  status: "connected",
  healthScore: 90,
  createdAt: "2026-09-24T00:00:00.000Z",
};

const campaign: Campaign = {
  id: "campaign-1",
  workspaceId: "workspace-1",
  name: "Launch",
  status: "scheduled",
  accountIds: ["account-1"],
  contentIds: ["content-1"],
  taskCount: 1,
  createdAt: "2026-09-24T00:00:00.000Z",
};

const task: Task = {
  id: "task-1",
  workspaceId: "workspace-1",
  campaignId: "campaign-1",
  accountId: "account-1",
  platform: "facebook",
  kind: "publish",
  contentId: "content-1",
  priority: 10,
  status: "pending",
  attempts: 0,
  maxAttempts: 3,
  availableAt: "2026-09-24T00:00:00.000Z",
  idempotencyKey: "task-1",
  createdAt: "2026-09-24T00:00:00.000Z",
};

const context = {
  account,
  campaign,
  task,
  actionsToday: 0,
  dailyLimit: 10,
  consecutiveFailures: 0,
  circuitBreakerThreshold: 3,
};

describe("execution policy", () => {
  it("blocks cross-workspace execution", () => {
    const decision = evaluateExecutionPolicy({
      ...context,
      task: { ...task, workspaceId: "other-workspace" },
    });
    expect(decision.reason).toBe("workspace_mismatch");
  });

  it("blocks task/account reference mismatches", () => {
    const decision = evaluateExecutionPolicy({
      ...context,
      task: { ...task, accountId: "other-account" },
    });
    expect(decision.reason).toBe("account_mismatch");
  });

  it("blocks task/platform mismatches", () => {
    const decision = evaluateExecutionPolicy({
      ...context,
      task: { ...task, platform: "instagram" },
    });
    expect(decision.reason).toBe("task_platform_mismatch");
  });

  it("requires content linkage for publish tasks", () => {
    const decision = evaluateExecutionPolicy({
      ...context,
      approval: {
        id: "approval-1",
        workspaceId: "workspace-1",
        contentId: "content-1",
        requestedBy: "user-1",
        reviewerIds: ["user-2"],
        status: "approved",
      },
      task: { ...task, contentId: undefined },
    });
    expect(decision.reason).toBe("content_required");
  });

  it("blocks content outside the campaign", () => {
    const decision = evaluateExecutionPolicy({
      ...context,
      approval: {
        id: "approval-1",
        workspaceId: "workspace-1",
        contentId: "content-2",
        requestedBy: "user-1",
        reviewerIds: ["user-2"],
        status: "approved",
      },
      task: { ...task, contentId: "content-2" },
    });
    expect(decision.reason).toBe("content_scope_mismatch");
  });

  it("fails closed without approval", () => {
    const decision = evaluateExecutionPolicy(context);
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("approval_required");
  });

  it("allows an explicitly approved external task", () => {
    const decision = evaluateExecutionPolicy({
      ...context,
      approval: {
        id: "approval-1",
        workspaceId: "workspace-1",
        contentId: "content-1",
        requestedBy: "user-1",
        reviewerIds: ["user-2"],
        status: "approved",
      },
    });
    expect(decision.allowed).toBe(true);
  });

  it("blocks approvals from another workspace", () => {
    const decision = evaluateExecutionPolicy({
      ...context,
      approval: {
        id: "approval-foreign",
        workspaceId: "other-workspace",
        contentId: "content-1",
        requestedBy: "user-1",
        reviewerIds: ["user-2"],
        status: "approved",
      },
    });
    expect(decision.reason).toBe("approval_scope_mismatch");
  });

  it("blocks approvals for content outside the campaign", () => {
    const decision = evaluateExecutionPolicy({
      ...context,
      approval: {
        id: "approval-foreign-content",
        workspaceId: "workspace-1",
        contentId: "content-other",
        requestedBy: "user-1",
        reviewerIds: ["user-2"],
        status: "approved",
      },
    });
    expect(decision.reason).toBe("approval_scope_mismatch");
  });

  it("blocks disconnected accounts before approval evaluation", () => {
    const decision = evaluateExecutionPolicy({ ...context, account: { ...account, status: "needs_refresh" } });
    expect(decision.reason).toBe("account_not_connected");
  });

  it("opens the circuit breaker at the configured threshold", () => {
    const decision = evaluateExecutionPolicy({ ...context, consecutiveFailures: 3 });
    expect(decision.reason).toBe("circuit_breaker_open");
  });

  it("blocks when the daily action budget is exhausted", () => {
    const decision = evaluateExecutionPolicy({ ...context, actionsToday: 10 });
    expect(decision.reason).toBe("daily_limit_reached");
  });

  it("does not require content approval for a synchronization task", () => {
    const decision = evaluateExecutionPolicy({
      ...context,
      task: { ...task, kind: "sync" },
    });
    expect(decision.allowed).toBe(true);
  });
});
