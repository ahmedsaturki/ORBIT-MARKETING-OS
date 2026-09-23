import type { Task } from "../types/index.js";
import { calculateRetryDelay, type RetryPolicy } from "./retry.js";

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

export class TaskQueue {
  private readonly tasks = new Map<string, Task>();

  public constructor(private readonly options: TaskQueueOptions) {}

  public enqueue(task: Task): void {
    if (this.tasks.has(task.id)) throw new Error("Task already exists: " + task.id);
    this.tasks.set(task.id, task);
  }

  public get(id: string): Task | undefined {
    return this.tasks.get(id);
  }

  public claimNext(now: string): Task | undefined {
    const candidates = [...this.tasks.values()]
      .filter((task) => task.status === "pending" && task.availableAt <= now)
      .sort((a, b) => b.priority - a.priority || a.availableAt.localeCompare(b.availableAt));

    const task = candidates[0];
    if (!task) return undefined;

    const claimed: Task = {
      ...task,
      status: "running",
    };
    this.tasks.set(claimed.id, claimed);
    return claimed;
  }

  public succeed(id: string): Task {
    return this.transition(id, "succeeded");
  }

  public block(id: string): Task {
    return this.transition(id, "blocked");
  }

  public cancel(id: string): Task {
    return this.transition(id, "cancelled");
  }

  public fail(id: string, now: string): Task {
    const task = this.requireTask(id);
    const nextAttempt = task.attempts + 1;

    if (nextAttempt >= task.maxAttempts || !this.options.retryPolicy.maxAttempts) {
      return this.setTask({ ...task, attempts: nextAttempt, status: "failed" });
    }

    const retryDelay = calculateRetryDelay(nextAttempt, this.options.retryPolicy);
    const availableAt = new Date(new Date(now).getTime() + retryDelay).toISOString();
    return this.setTask({
      ...task,
      attempts: nextAttempt,
      status: "pending",
      availableAt,
    });
  }

  public stats(): QueueStats {
    const result: QueueStats = {
      pending: 0,
      running: 0,
      succeeded: 0,
      failed: 0,
      blocked: 0,
      cancelled: 0,
    };
    for (const task of this.tasks.values()) {
      result[task.status] += 1;
    }
    return result;
  }

  public snapshot(): readonly Task[] {
    return [...this.tasks.values()];
  }

  private transition(id: string, status: Task["status"]): Task {
    const task = this.requireTask(id);
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
