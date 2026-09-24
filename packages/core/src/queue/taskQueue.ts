import type { Task } from "../types/index.js";
import { calculateRetryDelay, shouldRetry, type RetryPolicy } from "./retry.js";

export interface QueueStats {
  readonly pending: number;
  readonly awaiting_approval: number;
  readonly awaiting_user_action: number;
  readonly running: number;
  readonly succeeded: number;
  readonly failed: number;
  readonly blocked: number;
  readonly cancelled: number;
}

export interface TaskQueueOptions {
  readonly retryPolicy: RetryPolicy;
}

/**
 * Deterministic in-memory queue contract used by the core domain layer.
 * Persistence and worker transport are intentionally supplied by adapters.
 */
export class TaskQueue {
  private readonly tasks = new Map<string, Task>();
  private readonly idempotencyKeys = new Set<string>();

  public constructor(private readonly options: TaskQueueOptions) {
    if (options.retryPolicy.maxAttempts < 1) {
      throw new RangeError("retryPolicy.maxAttempts must be at least 1");
    }
  }

  /** Adds a task exactly once. */
  public enqueue(task: Task): void {
    this.validateTask(task);
    if (this.tasks.has(task.id)) throw new Error("Task already exists: " + task.id);
    if (this.idempotencyKeys.has(task.idempotencyKey)) {
      throw new Error("Task idempotency key already exists: " + task.idempotencyKey);
    }
    this.tasks.set(task.id, task);
    this.idempotencyKeys.add(task.idempotencyKey);
  }

  /** Returns a task without mutating queue state. */
  public get(id: string): Task | undefined {
    return this.tasks.get(id);
  }

  /** Claims the highest-priority eligible task and atomically marks it running. */
  public claimNext(now: string): Task | undefined {
    const candidates = [...this.tasks.values()]
      .filter((task) => task.status === "pending" && task.availableAt <= now)
      .sort((a, b) => b.priority - a.priority || a.availableAt.localeCompare(b.availableAt));

    const task = candidates[0];
    if (!task) return undefined;

    const claimed: Task = { ...task, status: "running" };
    this.tasks.set(claimed.id, claimed);
    return claimed;
  }

  /** Marks a running task successful. */
  public succeed(id: string): Task {
    return this.transition(id, "succeeded");
  }

  /** Blocks a task so workers cannot claim it again. */
  public block(id: string): Task {
    return this.transition(id, "blocked");
  }

  /** Releases a claimed task back to pending without consuming an attempt. */
  public release(id: string): Task {
    return this.transition(id, "pending");
  }

  /** Parks a claimed external task until an approval decision exists. */
  public awaitApproval(id: string): Task {
    return this.transition(id, "awaiting_approval");
  }

  /** Resumes an approval-gated task once approval is present. */
  public resume(id: string): Task {
    const task = this.requireTask(id);
    if (task.status !== "awaiting_approval" && task.status !== "awaiting_user_action") {
      throw new Error("Only waiting tasks can resume: " + id);
    }
    return this.setTask({ ...task, status: "pending" });
  }

  /** Parks a running task until a user/challenge intervention is completed. */
  public awaitUserAction(id: string): Task {
    return this.transition(id, "awaiting_user_action");
  }

  /** Defers a claimed task without consuming an attempt. */
  public defer(id: string, availableAt: string): Task {
    if (Number.isNaN(Date.parse(availableAt))) {
      throw new RangeError("availableAt must be a valid ISO timestamp");
    }
    const task = this.requireTask(id);
    if (task.status !== "running") {
      throw new Error("Only running tasks can defer: " + id);
    }
    return this.setTask({ ...task, status: "pending", availableAt });
  }

  /** Cancels a task so workers cannot claim it again. */
  public cancel(id: string): Task {
    return this.transition(id, "cancelled");
  }

  /** Records a failed attempt and either schedules a retry or terminally fails the task. */
  public fail(id: string, now: string): Task {
    const task = this.requireTask(id);
    if (task.status !== "running") {
      throw new Error(`Only running tasks can fail: ${id}`);
    }

    const nextAttempt = task.attempts + 1;
    if (!shouldRetry(nextAttempt, this.options.retryPolicy) || nextAttempt >= task.maxAttempts) {
      return this.setTask({ ...task, attempts: nextAttempt, status: "failed" });
    }

    const retryDelay = calculateRetryDelay(nextAttempt, this.options.retryPolicy);
    const availableAt = new Date(new Date(now).getTime() + retryDelay).toISOString();
    return this.setTask({ ...task, attempts: nextAttempt, status: "pending", availableAt });
  }

  /** Returns a point-in-time count of all queue states. */
  public stats(): QueueStats {
    const result: Record<keyof QueueStats, number> = {
      pending: 0,
      awaiting_approval: 0,
      awaiting_user_action: 0,
      running: 0,
      succeeded: 0,
      failed: 0,
      blocked: 0,
      cancelled: 0,
    };
    for (const task of this.tasks.values()) {
      if (task.status in result) {
        const status = task.status as keyof QueueStats;
        result[status] += 1;
      }
    }
    return result;
  }

  /** Returns a point-in-time copy of current queue tasks. */
  public snapshot(): readonly Task[] {
    return [...this.tasks.values()];
  }

  private transition(id: string, status: Task["status"]): Task {
    const task = this.requireTask(id);
    if (task.status !== "running") {
      throw new Error(`Only running tasks can transition: ${id}`);
    }
    return this.setTask({ ...task, status });
  }

  private requireTask(id: string): Task {
    const task = this.tasks.get(id);
    if (!task) throw new Error("Task not found: " + id);
    return task;
  }

  private setTask(task: Task): Task {
    this.tasks.set(task.id, task);
    return task;
  }

  private validateTask(task: Task): void {
    if (!task.id.trim() || !task.workspaceId.trim() || !task.campaignId.trim() || !task.accountId.trim()) {
      throw new Error("Task identifiers are required");
    }
    if (!task.idempotencyKey.trim()) {
      throw new Error("Task idempotency key is required");
    }
    if (task.priority < 0 || !Number.isInteger(task.priority)) {
      throw new RangeError("priority must be a non-negative integer");
    }
    if (task.attempts < 0 || !Number.isInteger(task.attempts) || task.attempts > task.maxAttempts) {
      throw new RangeError("attempts must be a non-negative integer within maxAttempts");
    }
    if (!Number.isInteger(task.maxAttempts) || task.maxAttempts < 1) {
      throw new RangeError("maxAttempts must be a positive integer");
    }
    if (Number.isNaN(Date.parse(task.availableAt)) || Number.isNaN(Date.parse(task.createdAt))) {
      throw new RangeError("task timestamps must be valid ISO timestamps");
    }
    if (task.status !== "pending") {
      throw new Error("New queue tasks must start in pending state");
    }
  }
}
