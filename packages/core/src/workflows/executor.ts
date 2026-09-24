import type { Approval, Campaign, SocialAccount, Task } from "../types/index.js";
import { createAuditEvent, AuditLog } from "../audit/auditLog.js";
import { ConnectorRegistry } from "../connectors/index.js";
import { TaskQueue } from "../queue/index.js";
import type { ExecutionPolicyContext } from "./executionPolicy.js";
import { ExecutionRunner } from "./executionRunner.js";

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

function mapRunnerResult(
  queue: TaskQueue,
  log: AuditLog,
  task: Task,
  result: Awaited<ReturnType<ExecutionRunner["run"]>>,
  now: string,
): TaskExecutionResult {
  if (result.status === "succeeded") {
    queue.succeed(task.id);
    audit(log, task, "success", "execution.succeeded", {
      message: result.message,
    });
    return {
      status: "succeeded",
      taskId: task.id,
      ...(result.externalId ? { externalId: result.externalId } : {}),
      message: result.message,
    };
  }

  if (result.status === "failed") {
    const next = queue.fail(task.id, now);
    audit(log, task, "failure", "execution.failed", {
      message: result.message,
      retryScheduled: next.status === "pending",
    });
    return {
      status: "failed",
      taskId: task.id,
      message: result.message,
      retryScheduled: next.status === "pending",
    };
  }

  if (result.reason === "approval_required") {
    queue.awaitApproval(task.id);
  } else if (result.reason === "daily_limit_reached") {
    const nextDay = new Date(now);
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);
    nextDay.setUTCHours(0, 0, 0, 0);
    queue.defer(task.id, nextDay.toISOString());
  } else if (
    result.reason === "account_not_connected" ||
    result.reason === "authorization_required" ||
    result.reason === "platform_challenge" ||
    result.reason === "user_confirmation_required" ||
    result.reason === "delivery_status_unknown"
  ) {
    queue.awaitUserAction(task.id);
  } else {
    queue.block(task.id);
  }

  audit(log, task, "blocked", "execution.blocked", {
    reason: result.reason,
    message: result.message,
  });

  return {
    status: "blocked",
    taskId: task.id,
    reason: result.reason,
    message: result.message,
  };
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

  let context: ExecutionRunContext;
  try {
    context = await dependencies.loadContext(task);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Execution context could not be loaded.";
    const next = dependencies.queue.fail(task.id, now);
    audit(dependencies.audit, task, "failure", "execution.context_load_failed", {
      message,
      retryScheduled: next.status === "pending",
    });
    return {
      status: "failed",
      taskId: task.id,
      message,
      retryScheduled: next.status === "pending",
    };
  }

  const runner = new ExecutionRunner(dependencies.connectors);
  const result = await runner.run({
    account: context.account,
    campaign: context.campaign,
    task,
    ...(context.approval ? { approval: context.approval } : {}),
    actionsToday: context.actionsToday,
    dailyLimit: context.dailyLimit,
    consecutiveFailures: context.consecutiveFailures,
    circuitBreakerThreshold: context.circuitBreakerThreshold,
    userConfirmed,
  });

  return mapRunnerResult(dependencies.queue, dependencies.audit, task, result, now);
}

