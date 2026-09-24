import { describe, expect, it } from "vitest";
import { ConnectorRegistry } from "../src/connectors/registry.js";
import { FixtureConnector } from "../src/connectors/fixture.js";
import { ExecutionRunner } from "../src/workflows/executionRunner.js";
import type { Campaign, SocialAccount, Task } from "../src/types/index.js";

const account: SocialAccount = {
  id: "account-1",
  workspaceId: "workspace-1",
  platform: "facebook",
  displayName: "Test account",
  status: "connected",
  healthScore: 100,
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

function runner(challengeOnExecute = false): ExecutionRunner {
  const registry = new ConnectorRegistry();
  registry.register(new FixtureConnector({ platform: "facebook", challengeOnExecute }));
  return new ExecutionRunner(registry);
}

describe("ExecutionRunner", () => {
  it("blocks tasks that have not been claimed", async () => {
    const result = await runner().run({
      account,
      campaign,
      task,
      actionsToday: 0,
      dailyLimit: 10,
      consecutiveFailures: 0,
      circuitBreakerThreshold: 3,
      userConfirmed: true,
    });
    expect(result).toMatchObject({
      status: "blocked",
      reason: "policy",
    });
  });

  it("blocks before connector execution when approval is missing", async () => {
    const result = await runner().run({
      account,
      campaign,
      task: { ...task, status: "running" },
      actionsToday: 0,
      dailyLimit: 10,
      consecutiveFailures: 0,
      circuitBreakerThreshold: 3,
      userConfirmed: true,
    });
    expect(result).toMatchObject({
      status: "blocked",
      reason: "policy",
    });
  });

  it("requires explicit confirmation before connector side effects", async () => {
    const result = await runner().run({
      account,
      campaign,
      task,
      approval: {
        id: "approval-1",
        workspaceId: "workspace-1",
        contentId: "content-1",
        requestedBy: "user-1",
        reviewerIds: ["user-2"],
        status: "approved",
      },
      actionsToday: 0,
      dailyLimit: 10,
      consecutiveFailures: 0,
      circuitBreakerThreshold: 3,
      userConfirmed: false,
    });
    expect(result).toMatchObject({ status: "blocked", reason: "authorization_required" });
  });

  it("returns a safe blocked state for connector challenges", async () => {
    const result = await runner(true).run({
      account,
      campaign,
      task,
      approval: {
        id: "approval-1",
        workspaceId: "workspace-1",
        contentId: "content-1",
        requestedBy: "user-1",
        reviewerIds: ["user-2"],
        status: "approved",
      },
      actionsToday: 0,
      dailyLimit: 10,
      consecutiveFailures: 0,
      circuitBreakerThreshold: 3,
      userConfirmed: true,
    });
    expect(result).toMatchObject({
      status: "blocked",
      reason: "platform_challenge",
    });
  });

  it("runs sync tasks without content approval or user confirmation", async () => {
    const result = await runner().run({
      account,
      campaign,
      task: { ...task, kind: "sync" },
      actionsToday: 0,
      dailyLimit: 10,
      consecutiveFailures: 0,
      circuitBreakerThreshold: 3,
      userConfirmed: false,
    });
    expect(result.status).toBe("succeeded");
  });

  it("executes a supported approved task through the registered connector", async () => {
    const result = await runner().run({
      account,
      campaign,
      task,
      approval: {
        id: "approval-1",
        workspaceId: "workspace-1",
        contentId: "content-1",
        requestedBy: "user-1",
        reviewerIds: ["user-2"],
        status: "approved",
      },
      actionsToday: 0,
      dailyLimit: 10,
      consecutiveFailures: 0,
      circuitBreakerThreshold: 3,
      userConfirmed: true,
    });
    expect(result.status).toBe("succeeded");
  });
});
