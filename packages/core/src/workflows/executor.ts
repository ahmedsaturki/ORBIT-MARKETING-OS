import type { Approval, Campaign, SocialAccount, Task } from "../types/index.js";
import { createAuditEvent, AuditLog } from "../audit/auditLog.js";
import {
  ConnectorRegistry,
  assertSupportedTask,
  type ConnectorOutcome,
} from "../connectors/index.js";
import { TaskQueue } from "../queue/index.js";
import { evaluateExecutionPolicy, type ExecutionPolicyContext } from "./executionPolicy.js";

export interface ExecutionRunContext extends Omit<
  ExecutionPolicyContext,
  "task"
> {
  readonly approval?: Approval;
}

export type TaskExecutionResult =
  | {
      readonly status: "succeeded";
      readonly taskId: string;
      readonly externalId?: string;
      readonly message: string;
    }
  | {
      readonly status: "blocked";
      readonly taskId: string;
      readonly reason: string;
      readonly message: string;
    }
  | {
      readonly status: "failed";
      readonly taskId: string;
      readonly message: string;
      readonly retryScheduled: boolean;
    };

export interface TaskExecutorDependencies {
  readonly queue: TaskQueue;
  readonly connectors: ConnectorRegistry;
  readonly audit: AuditLog;
  readonly loadContext: (
    task: Task,
  ) => Promise<ExecutionRunContext>;
}

function audit(
  log: AuditLog,
  task: Task,
  outcome: "success" | "failure" | "blocked",
  action: string,
  metadata: Readonly<Record<string, string | number | boolean>>,
): void {
  log.append(
    createAuditEvent({
      timestamp: new Date().toISOString(),
      workspaceId: task.workspaceId,
      category: "task",
      action,
      outcome,
      actor: "system",
      entityId: task.id,
      metadata,
    }),
  );
}

function mapOutcome(
  queue: TaskQueue,
  log: AuditLog,
  task: Task,
  outcome: ConnectorOutcome,
  now: string,
): TaskExecutionResult {
  switch (outcome.status) {
    case "succeeded": {
      queue.succeed(task.id);
      audit(log, task, "success", "execution.succeeded", {
        message: outcome.message,
      });
      return {
        status: "succeeded",
        taskId: task.id,
        externalId: outcome.externalId,
        message: outcome.message,
      };
    }
    case "blocked": {
      queue.block(task.id);
      audit(log, task, "blocked", "execution.blocked", {
        reason: outcome.reason,
        message: outcome.message,
      });
      return {
        status: "blocked",
        taskId: task.id,
        reason: outcome.reason,
        message: outcome.message,
      };
    }
    case "failed": {
      const next = queue.fail(task.id, now);
      audit(log, task, "failure", "execution.failed", {
        message: outcome.message,
        retryScheduled: next.status === "pending",
      });
      return {
        status: "failed",
        taskId: task.id,
        message: outcome.message,
        retryScheduled: next.status === "pending",
      };
    }
  }
}

/**
 * Execute one already-claimed task through every local safety gate.
 *
 * This orchestrator is deliberately connector-agnostic: platform adapters are
 * injected through ConnectorRegistry, while approvals and operating limits are
 * evaluated before the adapter receives an external-action command.
 */
export async function executeClaimedTask(
  dependencies: TaskExecutorDependencies,
  task: Task,
  userConfirmed: boolean,
  now: string,
): Promise<TaskExecutionResult> {
  if (task.status !== "running") {
    throw new Error("Only claimed running tasks may be executed.");
  }

  const context = await dependencies.loadContext(task);
  const decision = evaluateExecutionPolicy({ ...context, task });

  if (!decision.allowed) {
    dependencies.queue.block(task.id);
    audit(dependencies.audit, task, "blocked", "execution.policy_blocked", {
      reason: decision.reason,
      message: decision.message,
    });
    return {
      status: "blocked",
      taskId: task.id,
      reason: decision.reason,
      message: decision.message,
    };
  }

  if (task.kind !== "sync" && !userConfirmed) {
    dependencies.queue.block(task.id);
    audit(dependencies.audit, task, "blocked", "execution.confirmation_required", {
      reason: "confirmation_required",
    });
    return {
      status: "blocked",
      taskId: task.id,
      reason: "confirmation_required",
      message: "Explicit user confirmation is required before an external action.",
    };
  }

  const connector = dependencies.connectors.get(task.platform);
  if (!connector) {
    dependencies.queue.block(task.id);
    audit(dependencies.audit, task, "blocked", "execution.connector_missing", {
      reason: "connector_missing",
    });
    return {
      status: "blocked",
      taskId: task.id,
      reason: "connector_missing",
      message: "No connector is registered for the task platform.",
    };
  }

  try {
    if (task.kind === "sync") {
      const outcome = await connector.sync({
        accountId: task.accountId,
        userConfirmed,
      });
      return mapOutcome(
        dependencies.queue,
        dependencies.audit,
        task,
        outcome,
        now,
      );
    }

    assertSupportedTask(connector, task);
    const outcome = await connector.execute(task, {
      accountId: task.accountId,
      userConfirmed,
    });
    return mapOutcome(
      dependencies.queue,
      dependencies.audit,
      task,
      outcome,
      now,
    );
  } catch (error: unknown) {
    dependencies.queue.block(task.id);
    const message =
      error instanceof Error ? error.message : "Connector execution failed.";
    audit(dependencies.audit, task, "blocked", "execution.connector_rejected", {
      message,
    });
    return {
      status: "blocked",
      taskId: task.id,
      reason: "connector_rejected",
      message,
    };
  }
}
