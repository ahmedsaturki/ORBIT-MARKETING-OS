import type { Task } from "../types/index.js";
import { calculateRetryDelay, shouldRetry, type RetryPolicy } from "./retry.js";

export interface QueueStats {
  readonly pending: number;
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

  public constructor(private readonly options: TaskQueueOptions) {
    if (options.retryPolicy.maxAttempts < 1) {
      throw new RangeError("retryPolicy.maxAttempts must be at least 1");
    }
  }

  /** Adds a task exactly once. */
  public enqueue(task: Task): void {
    if (this.tasks.has(task.id)) throw new Error("Task already exists: " + task.id);
    this.tasks.set(task.id, task);
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
}
