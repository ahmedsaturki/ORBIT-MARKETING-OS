import type { PolicyContext, PolicyDecision, QueueTask } from "../types/index.js";

export interface RetryPolicy {
  readonly maxRetries: number;
  readonly baseDelayMs: number;
  readonly maxDelayMs: number;
  readonly jitterRatio: number;
}

export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxRetries: 3,
  baseDelayMs: 2000,
  maxDelayMs: 60000,
  jitterRatio: 0.2,
};

export function computeBackoffMs(
  attempt: number,
  policy: RetryPolicy = DEFAULT_RETRY_POLICY,
  random: () => number = Math.random,
): number {
  if (attempt < 1) return 0;
  const exp = policy.baseDelayMs * Math.pow(2, attempt - 1);
  const capped = Math.min(exp, policy.maxDelayMs);
  const jitter = capped * policy.jitterRatio * (random() * 2 - 1);
  return Math.max(0, Math.round(capped + jitter));
}

export function shouldRetry(
  task: Pick<QueueTask, "retries" | "maxRetries" | "status">,
  policy: RetryPolicy = DEFAULT_RETRY_POLICY,
): boolean {
  if (task.status === "cancelled" || task.status === "completed") return false;
  const limit = Math.min(task.maxRetries, policy.maxRetries);
  return task.retries < limit;
}

export function scheduleRetry(task: QueueTask, error: string, now: string): QueueTask {
  return {
    ...task,
    status: "retrying",
    retries: task.retries + 1,
    lastError: error,
    executedTime: now,
  };
}

export function completeTask(task: QueueTask, now: string, delaySeconds?: number): QueueTask {
  return {
    ...task,
    status: "completed",
    executedTime: now,
    delayAppliedSeconds: delaySeconds,
    lastError: undefined,
  };
}

export function failTerminal(task: QueueTask, error: string, now: string): QueueTask {
  return {
    ...task,
    status: "failed",
    lastError: error,
    executedTime: now,
  };
}

export type EvaluateFn = (ctx: PolicyContext) => PolicyDecision;

/**
 * Fail-closed task gate: a task is dispatched only when policy explicitly allows it.
 * Unknown or missing policy evaluation blocks execution.
 */
export function gateTaskForExecution(
  task: QueueTask,
  ctx: PolicyContext,
  evaluate: EvaluateFn | undefined,
): { readonly dispatch: boolean; readonly decision: PolicyDecision } {
  if (!evaluate) {
    return {
      dispatch: false,
      decision: { allowed: false, reason: "approval_required", detail: "no_policy_evaluator" },
    };
  }
  const decision = evaluate(ctx);
  return { dispatch: decision.allowed, decision };
}
