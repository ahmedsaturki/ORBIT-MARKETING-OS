import { describe, expect, it } from "vitest";
import { TaskQueue } from "../src/queue/taskQueue.js";
import type { Task } from "../src/types/index.js";

const baseTask: Task = {
  id: "task-1",
  workspaceId: "workspace-1",
  campaignId: "campaign-1",
  accountId: "account-1",
  platform: "facebook",
  kind: "publish",
  priority: 10,
  status: "pending",
  attempts: 0,
  maxAttempts: 3,
  availableAt: "2026-09-24T00:00:00.000Z",
  idempotencyKey: "campaign-1:account-1:content-1",
  createdAt: "2026-09-24T00:00:00.000Z",
};

const queue = () =>
  new TaskQueue({
    retryPolicy: { maxAttempts: 3, baseDelayMs: 1000, maxDelayMs: 8000 },
  });

describe("TaskQueue", () => {
  it("claims the highest-priority ready task", () => {
    const instance = queue();
    instance.enqueue(baseTask);
    instance.enqueue({ ...baseTask, id: "task-2", priority: 20, idempotencyKey: "task-2" });

    expect(instance.claimNext("2026-09-24T00:00:01.000Z")?.id).toBe("task-2");
    expect(instance.get("task-2")?.status).toBe("running");
  });

  it("normalizes queue scheduling timestamps to UTC", () => {
    const instance = queue();
    instance.enqueue({
      ...baseTask,
      availableAt: "2026-09-24T03:00:00+03:00",
      createdAt: "2026-09-24T03:00:00+03:00",
    });

    expect(instance.get("task-1")?.availableAt).toBe("2026-09-24T00:00:00.000Z");
    expect(instance.get("task-1")?.createdAt).toBe("2026-09-24T00:00:00.000Z");
    expect(instance.claimNext("2026-09-24T00:00:01.000Z")?.id).toBe("task-1");
  });

  it("does not claim tasks scheduled for the future", () => {
    const instance = queue();
    instance.enqueue(baseTask);

    expect(instance.claimNext("2026-09-23T23:59:59.000Z")).toBeUndefined();
  });

  it("reschedules a failed running task with exponential backoff", () => {
    const instance = queue();
    instance.enqueue(baseTask);
    instance.claimNext("2026-09-24T00:00:01.000Z");

    const failed = instance.fail("task-1", "2026-09-24T00:00:01.000Z");
    expect(failed.status).toBe("pending");
    expect(failed.attempts).toBe(1);
    expect(failed.availableAt).toBe("2026-09-24T00:00:02.000Z");
  });

  it("terminally fails after the task-specific attempt limit", () => {
    const instance = queue();
    instance.enqueue({ ...baseTask, maxAttempts: 1 });
    instance.claimNext("2026-09-24T00:00:01.000Z");

    const failed = instance.fail("task-1", "2026-09-24T00:00:01.000Z");
    expect(failed.status).toBe("failed");
    expect(failed.attempts).toBe(1);
  });

  it("rejects invalid state transitions", () => {
    const instance = queue();
    instance.enqueue(baseTask);

    expect(() => instance.succeed("task-1")).toThrow("Only running tasks can transition");
    expect(() => instance.fail("task-1", "2026-09-24T00:00:01.000Z")).toThrow(
      "Only running tasks can fail",
    );
  });

  it("releases a running task without consuming an attempt", () => {
    const instance = queue();
    instance.enqueue(baseTask);
    instance.claimNext("2026-09-24T00:00:01.000Z");

    const released = instance.release("task-1");
    expect(released.status).toBe("pending");
    expect(released.attempts).toBe(0);
  });

  it("parks running tasks for user intervention and resumes safely", () => {
    const instance = queue();
    instance.enqueue(baseTask);
    instance.claimNext("2026-09-24T00:00:01.000Z");

    expect(instance.awaitUserAction("task-1").status).toBe("awaiting_user_action");
    expect(instance.claimNext("2026-09-24T00:00:02.000Z")).toBeUndefined();
    expect(instance.resume("task-1").status).toBe("pending");
  });

  it("parks running tasks awaiting approval", () => {
    const instance = queue();
    instance.enqueue(baseTask);
    instance.claimNext("2026-09-24T00:00:01.000Z");

    expect(instance.awaitApproval("task-1").status).toBe("awaiting_approval");
    expect(instance.claimNext("2026-09-24T00:00:02.000Z")).toBeUndefined();
    expect(instance.resume("task-1").status).toBe("pending");
  });

  it("defers a running task without consuming an attempt", () => {
    const instance = queue();
    instance.enqueue(baseTask);
    instance.claimNext("2026-09-24T00:00:01.000Z");

    const deferred = instance.defer("task-1", "2026-09-25T00:00:00.000Z");
    expect(deferred.status).toBe("pending");
    expect(deferred.availableAt).toBe("2026-09-25T00:00:00.000Z");
    expect(deferred.attempts).toBe(0);
  });

  it("rejects duplicate task identifiers", () => {
    const instance = queue();
    instance.enqueue(baseTask);

    expect(() => instance.enqueue(baseTask)).toThrow("Task already exists");
  });

  it("rejects duplicate idempotency keys even when task ids differ", () => {
    const instance = queue();
    instance.enqueue(baseTask);

    expect(() =>
      instance.enqueue({
        ...baseTask,
        id: "task-2",
      }),
    ).toThrow("Task idempotency key already exists");
  });

  it("allows the same idempotency key in different workspaces", () => {
    const instance = queue();
    instance.enqueue(baseTask);

    expect(() =>
      instance.enqueue({
        ...baseTask,
        id: "task-2",
        workspaceId: "workspace-2",
      }),
    ).not.toThrow();
  });

  it("parks and resumes approval-gated tasks", () => {
    const instance = queue();
    instance.enqueue(baseTask);
    instance.claimNext("2026-09-24T00:00:01.000Z");

    const waiting = instance.awaitApproval("task-1");
    expect(waiting.status).toBe("awaiting_approval");
    expect(instance.claimNext("2026-09-24T00:00:02.000Z")).toBeUndefined();

    const resumed = instance.resume("task-1");
    expect(resumed.status).toBe("pending");
    expect(instance.claimNext("2026-09-24T00:00:02.000Z")?.status).toBe("running");
  });

  it("parks user-action tasks and defers without consuming attempts", () => {
    const instance = queue();
    instance.enqueue(baseTask);
    instance.claimNext("2026-09-24T00:00:01.000Z");

    const waiting = instance.awaitUserAction("task-1");
    expect(waiting.status).toBe("awaiting_user_action");
    expect(waiting.attempts).toBe(0);

    const resumed = instance.resume("task-1");
    expect(resumed.status).toBe("pending");
    const claimed = instance.claimNext("2026-09-24T00:00:02.000Z");
    expect(claimed?.status).toBe("running");

    const deferred = instance.defer("task-1", "2026-09-24T00:00:05.000Z");
    expect(deferred.status).toBe("pending");
    expect(deferred.availableAt).toBe("2026-09-24T00:00:05.000Z");
    expect(deferred.attempts).toBe(0);
  });

  it("reports waiting states in queue statistics", () => {
    const instance = queue();
    instance.enqueue({ ...baseTask, id: "approval", idempotencyKey: "approval" });
    instance.enqueue({ ...baseTask, id: "action", idempotencyKey: "action" });
    instance.claimNext("2026-09-24T00:00:01.000Z");
    instance.awaitApproval("approval");
    instance.claimNext("2026-09-24T00:00:01.000Z");
    instance.awaitUserAction("action");

    expect(instance.stats()).toMatchObject({
      pending: 0,
      awaiting_approval: 1,
      awaiting_user_action: 1,
      running: 0,
    });
  });

  it("rejects malformed queue timestamps", () => {
    const instance = queue();
    instance.enqueue(baseTask);
    expect(() => instance.claimNext("not-a-timestamp")).toThrow(
      "now must be a valid ISO timestamp",
    );
    instance.claimNext("2026-09-24T00:00:01.000Z");
    expect(() => instance.fail("task-1", "not-a-timestamp")).toThrow(
      "now must be a valid ISO timestamp",
    );
  });

  it("does not expose mutable internal task state", () => {
    const instance = queue();
    instance.enqueue(baseTask);

    const read = instance.get(baseTask.id);
    expect(read).toBeDefined();
    (read as { status: Task["status"] }).status = "succeeded";
    expect(instance.get(baseTask.id)?.status).toBe("pending");

    const snapshot = instance.snapshot();
    (snapshot[0] as { status: Task["status"] }).status = "cancelled";
    expect(instance.get(baseTask.id)?.status).toBe("pending");
  });

  it("does not expose mutable internal queue state", () => {
    const instance = queue();
    instance.enqueue(baseTask);

    const claimed = instance.claimNext("2026-09-24T00:00:01.000Z");
    expect(claimed).toBeDefined();
    const returned = instance.get("task-1");
    if (!returned) throw new Error("task should exist");
    (returned as { status: Task["status"] }).status = "succeeded";

    expect(instance.get("task-1")?.status).toBe("running");
    expect(instance.snapshot()[0]?.status).toBe("running");
  });

  it("does not retry past the lower of policy and task attempt budgets", () => {
    const instance = new TaskQueue({
      retryPolicy: { maxAttempts: 2, baseDelayMs: 100, maxDelayMs: 1000 },
    });
    instance.enqueue({ ...baseTask, maxAttempts: 5 });
    instance.claimNext("2026-09-24T00:00:01.000Z");
    const retried = instance.fail("task-1", "2026-09-24T00:00:01.000Z");
    expect(retried.status).toBe("pending");
    instance.claimNext("2026-09-24T00:00:03.000Z");
    const terminal = instance.fail("task-1", "2026-09-24T00:00:03.000Z");
    expect(terminal.status).toBe("failed");
    expect(terminal.attempts).toBe(2);
  });

  it("rejects malformed queue tasks", () => {
    const instance = queue();
    expect(() => instance.enqueue({ ...baseTask, idempotencyKey: " " })).toThrow(
      "Task idempotency key is required",
    );
    expect(() => instance.enqueue({ ...baseTask, priority: -1 })).toThrow(
      "priority must be a non-negative integer",
    );
  });
});
