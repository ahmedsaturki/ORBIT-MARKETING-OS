export type OperationalEntityType =
  | "objective"
  | "strategy"
  | "campaign"
  | "content"
  | "task"
  | "conversation"
  | "contact"
  | "opportunity"
  | "insight"
  | "agent_run";

export type WorkItemStatus =
  | "backlog"
  | "ready"
  | "in_progress"
  | "blocked"
  | "waiting"
  | "done"
  | "cancelled";

export interface WorkItem {
  readonly id: string;
  readonly workspaceId: string;
  readonly type: OperationalEntityType;
  readonly title: string;
  readonly status: WorkItemStatus;
  readonly ownerId?: string;
  readonly priority: number;
  readonly dueAt?: string;
  readonly sourceId?: string;
  readonly targetId?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface WorkDependency {
  readonly workspaceId: string;
  readonly predecessorId: string;
  readonly successorId: string;
  readonly kind: "blocks" | "requires" | "follows";
}

export interface OperationalLink {
  readonly workspaceId: string;
  readonly fromType: OperationalEntityType;
  readonly fromId: string;
  readonly toType: OperationalEntityType;
  readonly toId: string;
  readonly relation: string;
}

export function canStartWork(
  item: WorkItem,
  blockingDependencies: readonly WorkDependency[],
): boolean {
  if (item.status !== "ready") return false;
  return blockingDependencies.length === 0;
}
