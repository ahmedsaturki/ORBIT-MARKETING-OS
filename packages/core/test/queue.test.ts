import { describe, expect, it } from "vitest";
import { TaskQueue } from "../src/queue/taskQueue.js";
import type { Task } from "../src/types/index.js";

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: "task-1",
    workspaceId: "workspace-1",
    campaignId: "camp-1",
    accountId: "acc-1",
    platform: "facebook",
    kind: "publish",
    priority: 5,
    status: "pending",
    attempts: 0,
    maxAttempts: 3,
    availableAt: "2026-09-24T10:00:00.000Z",
    idempotencyKey: "task-1",
    createdAt: "2026-09-24T09:00:00.000Z",
    ...overrides,
  };
}

describe("TaskQueue", () => {
  it("claims highest priority ready work", () => {
    const queue = new TaskQueue({
      retryPolicy: { maxAttempts: 3, baseDelayMs: 100, maxDelayMs: 1000 },
    });
    queue.enqueue(task({ id: "low", priority: 1 }));
    queue.enqueue(task({ id: "high", priority: 9 }));

    const claimed = queue.claimNext("2026-09-24T10:01:00.000Z");
    expect(claimed?.id).toBe("high");
    expect(claimed?.status).toBe("running");
  });

  it("requeues failed tasks with exponential backoff", () => {
    const queue = new TaskQueue({
      retryPolicy: { maxAttempts: 3, baseDelayMs: 1000, maxDelayMs: 5000 },
    });
    queue.enqueue(task());

    queue.claimNext("2026-09-24T10:00:00.000Z");
    const retried = queue.fail("task-1", "2026-09-24T10:00:00.000Z");

    expect(retried.status).toBe("pending");
    expect(retried.attempts).toBe(1);
    expect(retried.availableAt).toBe("2026-09-24T10:00:01.000Z");
  });

  it("marks terminal failure after the task attempt budget", () => {
    const queue = new TaskQueue({
      retryPolicy: { maxAttempts: 3, baseDelayMs: 100, maxDelayMs: 1000 },
    });
    queue.enqueue(task({ attempts: 2 }));

    queue.claimNext("2026-09-24T10:00:00.000Z");
    const failed = queue.fail("task-1", "2026-09-24T10:00:00.000Z");

    expect(failed.status).toBe("failed");
    expect(failed.attempts).toBe(3);
  });

  it("reports accurate queue statistics", () => {
    const queue = new TaskQueue({
      retryPolicy: { maxAttempts: 3, baseDelayMs: 100, maxDelayMs: 1000 },
    });
    queue.enqueue(task({ id: "one", priority: 1, idempotencyKey: "one" }));
    queue.enqueue(task({ id: "two", priority: 9, idempotencyKey: "two" }));

    queue.claimNext("2026-09-24T10:00:00.000Z");
    queue.succeed("two");
    queue.claimNext("2026-09-24T10:00:00.000Z");
    queue.block("one");

    expect(queue.stats()).toEqual({
      pending: 0,
      awaiting_approval: 0,
      awaiting_user_action: 0,
      running: 0,
      succeeded: 1,
      failed: 0,
      blocked: 1,
      cancelled: 0,
    });
  });
});
