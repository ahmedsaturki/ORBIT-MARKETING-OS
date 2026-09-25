import { describe, expect, it } from "vitest";
import { TaskQueue } from "./taskQueue.js";
import type { Task } from "../types/index.js";

const task = (overrides: Partial<Task> = {}): Task => ({
  id: "task-1",
  workspaceId: "ws-1",
  campaignId: "campaign-1",
  accountId: "account-1",
  platform: "facebook",
  kind: "publish",
  priority: 10,
  status: "pending",
  attempts: 0,
  maxAttempts: 3,
  availableAt: "2026-09-24T00:00:00.000Z",
  idempotencyKey: "idem-1",
  createdAt: "2026-09-24T00:00:00.000Z",
  ...overrides,
});

describe("TaskQueue", () => {
  it("rejects duplicate task ids", () => {
    const queue = new TaskQueue({
      retryPolicy: { maxAttempts: 3, baseDelayMs: 100, maxDelayMs: 1000 },
    });
    queue.enqueue(task());
    expect(() => queue.enqueue(task())).toThrow("Task already exists");
  });

  it("claims only eligible pending tasks", () => {
    const queue = new TaskQueue({
      retryPolicy: { maxAttempts: 3, baseDelayMs: 100, maxDelayMs: 1000 },
    });
    queue.enqueue(task());
    queue.enqueue(
      task({
        id: "future",
        idempotencyKey: "idem-2",
        availableAt: "2026-09-25T00:00:00.000Z",
        priority: 99,
      }),
    );
    expect(queue.claimNext("2026-09-24T01:00:00.000Z")?.id).toBe("task-1");
    expect(queue.claimNext("2026-09-24T01:00:00.000Z")).toBeUndefined();
  });

  it("retries with exponential delay and eventually fails", () => {
    const queue = new TaskQueue({
      retryPolicy: { maxAttempts: 3, baseDelayMs: 100, maxDelayMs: 1000 },
    });
    queue.enqueue(task());
    queue.claimNext("2026-09-24T01:00:00.000Z");
    const retry = queue.fail("task-1", "2026-09-24T01:00:00.000Z");
    expect(retry.status).toBe("pending");
    expect(retry.attempts).toBe(1);
    queue.claimNext("2026-09-24T01:00:01.000Z");
    queue.fail("task-1", "2026-09-24T01:00:01.000Z");
    queue.claimNext("2026-09-24T01:00:02.000Z");
    const failed = queue.fail("task-1", "2026-09-24T01:00:02.000Z");
    expect(failed.status).toBe("failed");
    expect(failed.attempts).toBe(3);
  });
});
