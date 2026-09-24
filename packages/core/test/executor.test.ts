import { describe, expect, it } from "vitest";
import type { Campaign, SocialAccount, Task } from "../src/types/index.js";
import { AuditLog } from "../src/audit/auditLog.js";
import { ConnectorRegistry, FixtureConnector } from "../src/connectors/index.js";
import { TaskQueue } from "../src/queue/index.js";
import { executeClaimedTask } from "../src/workflows/executor.js";

const account: SocialAccount = {
  id: "account-1",
  workspaceId: "workspace-1",
  platform: "facebook",
  displayName: "Test",
  status: "connected",
  healthScore: 100,
  createdAt: "2026-09-24T00:00:00.000Z",
};

const campaign: Campaign = {
  id: "campaign-1",
  workspaceId: "workspace-1",
  name: "Test",
  status: "scheduled",
  accountIds: ["account-1"],
  contentIds: ["content-1"],
  taskCount: 1,
  createdAt: "2026-09-24T00:00:00.000Z",
};

function makeTask(kind: Task["kind"] = "publish"): Task {
  return {
    id: "task-1",
    workspaceId: "workspace-1",
    campaignId: "campaign-1",
    accountId: "account-1",
    platform: "facebook",
    kind,
    contentId: kind === "sync" ? undefined : "content-1",
    priority: 10,
    status: "pending",
    attempts: 0,
    maxAttempts: 3,
    availableAt: "2026-09-24T00:00:00.000Z",
    idempotencyKey: "task-1-" + kind,
    createdAt: "2026-09-24T00:00:00.000Z",
  };
}

function queue(task: Task): TaskQueue {
  const value = new TaskQueue({
    retryPolicy: { maxAttempts: 3, baseDelayMs: 1000, maxDelayMs: 8000 },
  });
  value.enqueue(task);
  return value;
}

function context(task: Task) {
  return {
    account,
    campaign,
    approval: {
      id: "approval-1",
      workspaceId: "workspace-1",
      contentId: "content-1",
      requestedBy: "user-1",
      reviewerIds: ["user-2"],
      status: "approved" as const,
    },
    actionsToday: 0,
    dailyLimit: 10,
    consecutiveFailures: 0,
    circuitBreakerThreshold: 3,
  };
}

describe("task execution orchestrator", () => {
  it("refuses to execute an unclaimed pending task", async () => {
    const task = makeTask();
    const taskQueue = queue(task);
    const registry = new ConnectorRegistry();
    registry.register(new FixtureConnector({ platform: "facebook" }));
    await expect(
      executeClaimedTask(
        {
          queue: taskQueue,
          connectors: registry,
          audit: new AuditLog(),
          loadContext: async () => context(task),
        },
        task,
        true,
        "2026-09-24T00:00:01.000Z",
      ),
    ).rejects.toThrow("Only claimed running tasks may be executed.");
  });


  it("runs a confirmed external task through policy, connector, queue, and audit", async () => {
    const task = makeTask();
    const taskQueue = queue(task);
    const claimed = taskQueue.claimNext("2026-09-24T00:00:01.000Z");
    expect(claimed).toBeDefined();

    const registry = new ConnectorRegistry();
    registry.register(new FixtureConnector({ platform: "facebook" }));
    const audit = new AuditLog();

    const result = await executeClaimedTask(
      {
        queue: taskQueue,
        connectors: registry,
        audit,
        loadContext: async () => context(task),
      },
      claimed!,
      true,
      "2026-09-24T00:00:01.000Z",
    );

    expect(result.status).toBe("succeeded");
    expect(taskQueue.get(task.id)?.status).toBe("succeeded");
    expect(audit.list()[0]?.action).toBe("execution.succeeded");
  });

  it("retries when execution context loading fails", async () => {
    const task = makeTask();
    const taskQueue = queue(task);
    const claimed = taskQueue.claimNext("2026-09-24T00:00:01.000Z");
    expect(claimed).toBeDefined();

    const result = await executeClaimedTask(
      {
        queue: taskQueue,
        connectors: new ConnectorRegistry(),
        audit: new AuditLog(),
        loadContext: async () => {
          throw new Error("temporary context failure");
        },
      },
      claimed!,
      true,
      "2026-09-24T00:00:01.000Z",
    );

    expect(result).toMatchObject({
      status: "failed",
      taskId: task.id,
      retryScheduled: true,
      message: "temporary context failure",
    });
    expect(taskQueue.get(task.id)?.status).toBe("pending");
    expect(taskQueue.get(task.id)?.attempts).toBe(1);
  });

  it("blocks before connector execution when approval is missing", async () => {
    const task = makeTask();
    const taskQueue = queue(task);
    const claimed = taskQueue.claimNext("2026-09-24T00:00:01.000Z");
    expect(claimed).toBeDefined();

    let executeCalls = 0;
    const registry = new ConnectorRegistry();
    registry.register({
      platform: "facebook",
      capabilities: {
        publish: true,
        messaging: true,
        comments: true,
        inbox: true,
        analytics: true,
        media: true,
      },
      connect: async () => ({ status: "succeeded", message: "ok" }),
      disconnect: async () => ({ status: "succeeded", message: "ok" }),
      execute: async () => {
        executeCalls += 1;
        return { status: "succeeded", message: "must not run" };
      },
      sync: async () => ({ status: "succeeded", message: "ok" }),
    });

    const result = await executeClaimedTask(
      {
        queue: taskQueue,
        connectors: registry,
        audit: new AuditLog(),
        loadContext: async () => {
          const { approval: _approval, ...withoutApproval } = context(task);
          return withoutApproval;
        },
      },
      claimed!,
      true,
      "2026-09-24T00:00:01.000Z",
    );

    expect(result.status).toBe("blocked");
    expect(result.reason).toBe("approval_required");
    expect(executeCalls).toBe(0);
    expect(taskQueue.get(task.id)?.status).toBe("awaiting_approval");
  });

  it("defers daily-limit work until the next UTC day", async () => {
    const task = makeTask();
    const taskQueue = queue(task);
    const claimed = taskQueue.claimNext("2026-09-24T23:30:00.000Z");
    expect(claimed).toBeDefined();

    const result = await executeClaimedTask(
      {
        queue: taskQueue,
        connectors: new ConnectorRegistry(),
        audit: new AuditLog(),
        loadContext: async () => ({
          ...context(task),
          actionsToday: 10,
          dailyLimit: 10,
        }),
      },
      claimed!,
      true,
      "2026-09-24T23:30:00.000Z",
    );

    expect(result).toMatchObject({
      status: "blocked",
      reason: "daily_limit_reached",
    });
    expect(taskQueue.get(task.id)?.status).toBe("pending");
    expect(taskQueue.get(task.id)?.availableAt).toBe("2026-09-25T00:00:00.000Z");
  });

  it("releases a task when user confirmation is missing", async () => {
    const task = makeTask();
    const taskQueue = queue(task);
    const claimed = taskQueue.claimNext("2026-09-24T00:00:01.000Z");
    expect(claimed).toBeDefined();

    const result = await executeClaimedTask(
      {
        queue: taskQueue,
        connectors: new ConnectorRegistry(),
        audit: new AuditLog(),
        loadContext: async () => context(task),
      },
      claimed!,
      false,
      "2026-09-24T00:00:01.000Z",
    );

    expect(result).toMatchObject({
      status: "blocked",
      reason: "confirmation_required",
    });
    expect(taskQueue.get(task.id)?.status).toBe("awaiting_user_action");
  });

  it("blocks external execution before the connector when confirmation is missing", async () => {
    const task = makeTask();
    const taskQueue = queue(task);
    const claimed = taskQueue.claimNext("2026-09-24T00:00:01.000Z");
    const registry = new ConnectorRegistry();
    registry.register(new FixtureConnector({ platform: "facebook" }));
    const result = await executeClaimedTask(
      {
        queue: taskQueue,
        connectors: registry,
        audit: new AuditLog(),
        loadContext: async () => context(task),
      },
      claimed!,
      false,
      "2026-09-24T00:00:01.000Z",
    );

    expect(result).toMatchObject({
      status: "blocked",
      reason: "confirmation_required",
    });
    expect(taskQueue.get(task.id)?.status).toBe("pending");
  });

  it("stops on a platform challenge and records a blocked audit event", async () => {
    const task = makeTask();
    const taskQueue = queue(task);
    const claimed = taskQueue.claimNext("2026-09-24T00:00:01.000Z");
    const registry = new ConnectorRegistry();
    registry.register(new FixtureConnector({ platform: "facebook", challengeOnExecute: true }));
    const audit = new AuditLog();

    const result = await executeClaimedTask(
      {
        queue: taskQueue,
        connectors: registry,
        audit,
        loadContext: async () => context(task),
      },
      claimed!,
      true,
      "2026-09-24T00:00:01.000Z",
    );

    expect(result).toMatchObject({
      status: "blocked",
      reason: "platform_challenge",
    });
    expect(taskQueue.get(task.id)?.status).toBe("blocked");
    expect(audit.list()[0]?.outcome).toBe("blocked");
  });

  it("uses the connector sync path without content approval", async () => {
    const task = makeTask("sync");
    const taskQueue = queue(task);
    const claimed = taskQueue.claimNext("2026-09-24T00:00:01.000Z");
    const registry = new ConnectorRegistry();
    registry.register(new FixtureConnector({ platform: "facebook" }));

    const result = await executeClaimedTask(
      {
        queue: taskQueue,
        connectors: registry,
        audit: new AuditLog(),
        loadContext: async () => {
          const { approval: _approval, ...withoutApproval } = context(task);
          return withoutApproval;
        },
      },
      claimed!,
      false,
      "2026-09-24T00:00:01.000Z",
    );

    expect(result.status).toBe("succeeded");
    expect(taskQueue.get(task.id)?.status).toBe("succeeded");
  });
});
