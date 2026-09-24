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

function cloneTask(task: Task): Task {
  return structuredClone(task);
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
  private readonly executingTaskIds = new Set<string>();

  private idempotencyKey(task: Task): string {
    return `${task.workspaceId}\u0000${task.idempotencyKey}`;
  }

  public constructor(private readonly options: TaskQueueOptions) {
    if (
      !Number.isInteger(options.retryPolicy.maxAttempts) ||
      options.retryPolicy.maxAttempts < 1 ||
      options.retryPolicy.maxAttempts > 10
    ) {
      throw new RangeError("retryPolicy.maxAttempts must be an integer between 1 and 10");
    }
    if (
      !Number.isFinite(options.retryPolicy.baseDelayMs) ||
      options.retryPolicy.baseDelayMs < 0 ||
      !Number.isFinite(options.retryPolicy.maxDelayMs) ||
      options.retryPolicy.maxDelayMs < options.retryPolicy.baseDelayMs
    ) {
      throw new RangeError("invalid retry policy");
    }
  }

  /** Adds a task exactly once. */
  public enqueue(task: Task): void {
    this.validateTask(task);
    if (this.tasks.has(task.id)) throw new Error("Task already exists: " + task.id);
    const scopedIdempotencyKey = this.idempotencyKey(task);
    if (this.idempotencyKeys.has(scopedIdempotencyKey)) {
      throw new Error("Task idempotency key already exists: " + task.idempotencyKey);
    }
    const stored = cloneTask({
      ...task,
      availableAt: this.normalizeTimestamp(task.availableAt, "availableAt"),
      createdAt: this.normalizeTimestamp(task.createdAt, "createdAt"),
    });
    this.tasks.set(task.id, stored);
    this.idempotencyKeys.add(scopedIdempotencyKey);
  }

  /** Returns a task without mutating queue state. */
  public get(id: string): Task | undefined {
    const task = this.tasks.get(id);
    return task ? cloneTask(task) : undefined;
  }

  /** Claims the highest-priority eligible task and atomically marks it running. */
  public claimNext(now: string): Task | undefined {
    const normalizedNow = this.normalizeTimestamp(now, "now");
    const candidates = [...this.tasks.values()]
      .filter((task) => task.status === "pending" && task.availableAt <= normalizedNow)
      .sort(
        (a, b) =>
          b.priority - a.priority ||
          a.availableAt.localeCompare(b.availableAt) ||
          a.createdAt.localeCompare(b.createdAt) ||
          a.id.localeCompare(b.id),
      );

    const task = candidates[0];
    if (!task) return undefined;

    const claimed: Task = { ...task, status: "running" };
    this.tasks.set(claimed.id, cloneTask(claimed));
    return cloneTask(claimed);
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
    const normalizedAvailableAt = this.normalizeTimestamp(availableAt, "availableAt");
    const task = this.requireTask(id);
    if (task.status !== "running") {
      throw new Error("Only running tasks can defer: " + id);
    }
    return this.setTask({ ...task, status: "pending", availableAt: normalizedAvailableAt });
  }

  /** Cancels a task so workers cannot claim it again. */
  public cancel(id: string): Task {
    return this.transition(id, "cancelled");
  }

  /** Records a failed attempt and either schedules a retry or terminally fails the task. */
  public fail(id: string, now: string): Task {
    const normalizedNow = this.normalizeTimestamp(now, "now");
    const task = this.requireTask(id);
    if (task.status !== "running") {
      throw new Error(`Only running tasks can fail: ${id}`);
    }

    const nextAttempt = task.attempts + 1;
    const effectiveMaxAttempts = Math.min(task.maxAttempts, this.options.retryPolicy.maxAttempts);
    if (!shouldRetry(nextAttempt, { ...this.options.retryPolicy, maxAttempts: effectiveMaxAttempts })) {
      return { ...this.setTask({ ...task, attempts: nextAttempt, status: "failed" }) };
    }

    const retryDelay = calculateRetryDelay(nextAttempt, this.options.retryPolicy);
    const availableAt = new Date(new Date(normalizedNow).getTime() + retryDelay).toISOString();
    return { ...this.setTask({ ...task, attempts: nextAttempt, status: "pending", availableAt }) };
  }

  /** Atomically reserves a running task for one execution orchestrator. */
  public tryBeginExecution(id: string): boolean {
    const task = this.requireTask(id);
    if (task.status !== "running") {
      throw new Error("Only running tasks may begin execution: " + id);
    }
    if (this.executingTaskIds.has(id)) return false;
    this.executingTaskIds.add(id);
    return true;
  }

  /** Releases a previously acquired execution reservation. */
  public endExecution(id: string): void {
    this.executingTaskIds.delete(id);
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
    return [...this.tasks.values()].map(cloneTask);
  }

  private transition(id: string, status: Task["status"]): Task {
    const task = this.requireTask(id);
    if (task.status !== "running") {
      throw new Error(`Only running tasks can transition: ${id}`);
    }
    return { ...this.setTask({ ...task, status }) };
  }

  private requireTask(id: string): Task {
    const task = this.tasks.get(id);
    if (!task) throw new Error("Task not found: " + id);
    return task;
  }

  private setTask(task: Task): Task {
    const stored = cloneTask(task);
    this.tasks.set(stored.id, stored);
    return cloneTask(stored);
  }

  private normalizeTimestamp(value: string, field: string): string {
    const parsed = Date.parse(value);
    if (Number.isNaN(parsed)) {
      throw new RangeError(field + " must be a valid ISO timestamp");
    }
    return new Date(parsed).toISOString();
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
    if (!Number.isInteger(task.maxAttempts) || task.maxAttempts < 1 || task.maxAttempts > 10) {
      throw new RangeError("maxAttempts must be an integer between 1 and 10");
    }
    this.normalizeTimestamp(task.availableAt, "availableAt");
    this.normalizeTimestamp(task.createdAt, "createdAt");
    if (task.status !== "pending") {
      throw new Error("New queue tasks must start in pending state");
    }
  }
}
