import type { Task } from "../types/index.js";

/**
 * Persistence boundary for the queue. Implementations must enforce the same
 * idempotency and workspace invariants as the in-memory TaskQueue.
 */
export interface TaskQueueStore {
  insert(task: Task): Promise<void>;
  get(taskId: string, workspaceId: string): Promise<Task | undefined>;
  getByIdempotencyKey(key: string, workspaceId: string): Promise<Task | undefined>;
  claimNext(workspaceId: string, now: string): Promise<Task | undefined>;
  save(task: Task): Promise<void>;
  list(workspaceId: string): Promise<readonly Task[]>;
}

export function assertTaskWorkspace(task: Task, workspaceId: string): void {
  if (task.workspaceId !== workspaceId) {
    throw new Error("Cross-workspace task access is forbidden");
  }
}
